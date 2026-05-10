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

    const { filename, contentType, title } = await req.json();
    if (!filename || !contentType) return new Response(JSON.stringify({ error: "Missing filename/contentType" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const safeFilename = sanitizeFilename(filename);

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
