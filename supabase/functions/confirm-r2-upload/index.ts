import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL") || "";

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

    const { videoId, fileSizeBytes, durationSeconds, failed, errorMessage } = await req.json();
    if (!videoId) return new Response(JSON.stringify({ error: "Missing videoId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: video } = await serviceClient
      .from("video_assets")
      .select("owner_id,r2_key")
      .eq("id", videoId)
      .single();

    if (!video) return new Response(JSON.stringify({ error: "Video not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (video.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle failed upload marking
    if (failed) {
      await serviceClient.from("video_assets").update({
        status: "failed",
        error_message: errorMessage || "Upload failed",
      }).eq("id", videoId);
      return new Response(JSON.stringify({ success: true, status: "failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${video.r2_key}` : null;

    const { error } = await serviceClient.from("video_assets").update({
      status: "ready",
      upload_percent: 100,
      public_url: publicUrl,
      file_size_bytes: fileSizeBytes || null,
      duration_seconds: durationSeconds || null,
      is_shared: true,
    }).eq("id", videoId);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("confirm-r2-upload error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
