import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.600.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT") || "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "";
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL") || "";

function sanitizeFilename(filename: string): string {
  const ext =
    filename.lastIndexOf(".") >= 0
      ? filename.slice(filename.lastIndexOf(".")).toLowerCase()
      : "";
  const name = filename.slice(0, filename.length - ext.length);
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (safe || "video") + ext;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const { filename, contentType, title, base64Data } = await req.json();

    if (!filename || !contentType || !base64Data) {
      return new Response(
        JSON.stringify({ error: "Missing filename, contentType, or base64Data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const safeFilename = sanitizeFilename(filename);

    // Create video_assets record
    const { data: video, error: dbErr } = await serviceClient
      .from("video_assets")
      .insert({
        owner_id: user.id,
        title: title || filename,
        original_filename: filename,
        status: "uploading",
        upload_percent: 0,
        is_shared: true,
      })
      .select("id")
      .single();

    if (dbErr) throw dbErr;

    const r2Key = `videos/${video.id}/${safeFilename}`;

    // Decode base64 to bytes
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Upload to R2 directly from server
    const s3 = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: bytes,
        ContentType: contentType,
      })
    );

    const publicUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${r2Key}`
      : null;

    // Mark as ready
    await serviceClient
      .from("video_assets")
      .update({
        status: "ready",
        upload_percent: 100,
        public_url: publicUrl,
        r2_key: r2Key,
        file_size_bytes: bytes.length,
        is_shared: true,
      })
      .eq("id", video.id);

    return new Response(
      JSON.stringify({ success: true, publicUrl, videoId: video.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("upload-testimonial-video error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
