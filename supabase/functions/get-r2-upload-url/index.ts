import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.600.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.600.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT") || "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "";
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL") || "";

function sanitizeFilename(filename: string): string {
  const ext = filename.lastIndexOf(".") >= 0 ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
  const name = filename.slice(0, filename.length - ext.length);
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (safe || "video") + ext;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { filename, contentType, title, fileSize, purpose = "video-asset" } = await req.json();
    if (!filename || !contentType) {
      return new Response(
        JSON.stringify({ error: "Missing filename or content type." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!["video-asset", "academy-video", "academy-thumbnail"].includes(purpose)) {
      return new Response(
        JSON.stringify({ error: "Invalid upload purpose." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isAcademyVideo = purpose === "academy-video";
    const isAcademyThumbnail = purpose === "academy-thumbnail";

    // Server-side file size cap. Mirrors the client's 500 MB limit so a
    // tampered client cannot presign uploads larger than the platform allows.
    const ABSOLUTE_MAX_BYTES = 500 * 1024 * 1024;
    if (!isAcademyVideo && typeof fileSize === "number" && fileSize > 0 && fileSize > ABSOLUTE_MAX_BYTES) {
      const sizeMb = Math.round(fileSize / (1024 * 1024));
      return new Response(
        JSON.stringify({
          error: `That file is ${sizeMb} MB — uploads are capped at 500 MB. Compress it and try again.`,
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // C3 — Server-side per-plan storage quota enforcement.
    // The client also gates this via useStorageUsage, but a tampered client
    // could bypass it. Here we re-derive the user's plan tier and storage cap
    // from authoritative tables and reject the presign if this upload would
    // push them over their quota.
    if (!isAcademyVideo && !isAcademyThumbnail && typeof fileSize === "number" && fileSize > 0) {
      try {
        // 1) Resolve active plan tier (default free).
        const { data: sub } = await serviceClient
          .from("user_subscriptions")
          .select("tier, status, expires_at")
          .eq("user_id", user.id)
          .in("status", ["active", "payment_failed", "pending"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const now = Date.now();
        const expired = sub?.expires_at ? new Date(sub.expires_at).getTime() < now : false;
        const rawTier = sub?.status === "active" && !expired ? (sub?.tier || "free") : "free";
        const planName = rawTier === "trial" ? "pro" : rawTier;

        // 2) Storage limit for this plan (fallback 1 GB for free).
        const { data: planRow } = await serviceClient
          .from("plan_config")
          .select("max_storage_mb")
          .eq("plan_name", planName)
          .maybeSingle();
        const limitMb = (planRow?.max_storage_mb && planRow.max_storage_mb > 0)
          ? planRow.max_storage_mb
          : 1024;
        const limitBytes = limitMb * 1024 * 1024;

        // 3) Sum existing usage.
        const { data: usageRows } = await serviceClient
          .from("video_assets")
          .select("file_size_bytes")
          .eq("owner_id", user.id);
        const usedBytes = (usageRows || []).reduce(
          (sum: number, r: { file_size_bytes: number | null }) => sum + (r.file_size_bytes || 0),
          0,
        );

        if (usedBytes + fileSize > limitBytes) {
          const usedMb = Math.round(usedBytes / (1024 * 1024));
          return new Response(
            JSON.stringify({
              error: `Storage quota exceeded. You've used ${usedMb} MB of your ${limitMb} MB limit. Delete some videos or upgrade your plan.`,
              code: "QUOTA_EXCEEDED",
              usedBytes,
              limitBytes,
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (quotaErr) {
        // Fail-open on quota lookup errors so a transient DB hiccup doesn't
        // block legitimate uploads. The client gate still ran, and we'll
        // surface real errors via the upload itself.
        console.error("Quota check failed (allowing upload):", quotaErr);
      }
    }

    const safeFilename = sanitizeFilename(filename);

    if (isAcademyThumbnail) {
      const r2Key = `academy/thumbnails/${user.id}/${crypto.randomUUID()}-${safeFilename}`;

      const s3 = new S3Client({
        region: "auto",
        endpoint: R2_ENDPOINT,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      });

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${r2Key}` : null;

      return new Response(JSON.stringify({
        uploadUrl,
        r2Key,
        publicUrl,
        confirmRequired: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (isAcademyVideo) {
      const r2Key = `academy/videos/${user.id}/${crypto.randomUUID()}-${safeFilename}`;

      const s3 = new S3Client({
        region: "auto",
        endpoint: R2_ENDPOINT,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      });

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${r2Key}` : null;

      return new Response(JSON.stringify({
        uploadUrl,
        r2Key,
        publicUrl,
        confirmRequired: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: video, error: dbErr } = await serviceClient.from("video_assets").insert({
      owner_id: user.id,
      title: title || filename,
      original_filename: filename,
      status: "uploading",
      upload_percent: 0,
      is_shared: true,
    }).select("id").single();

    if (dbErr) throw dbErr;

    const r2Key = `videos/${video.id}/${safeFilename}`;

    // Use official AWS SDK presigner
    const s3 = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    await serviceClient.from("video_assets").update({ r2_key: r2Key }).eq("id", video.id);

    return new Response(JSON.stringify({
      uploadUrl,
      videoId: video.id,
      r2Key,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("get-r2-upload-url error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
