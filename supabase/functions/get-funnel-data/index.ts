import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });

async function getCallerUserId(req: Request, supabaseUrl: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const authClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
  } = await authClient.auth.getUser();

  return user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let slug = url.searchParams.get("slug");
    if (!slug && req.method !== "GET") {
      try {
        const body = await req.json();
        slug = body?.slug ?? null;
      } catch (_) {
        slug = null;
      }
    }
    if (!slug) {
      return json({ error: "slug is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const publicProbeClient = createClient(supabaseUrl, publicKey);
    const callerUserId = await getCallerUserId(req, supabaseUrl);

    // Fetch funnel — explicit safe column list (NEVER include access_code_*
    // or password_hash; verification happens server-side only).
    const { data: funnel, error: funnelErr } = await supabase
      .from("funnels")
      .select(
        "id, owner_id, title, slug, description, video_asset_id, thumbnail_url, is_published, visibility, intent_type, allow_seek, allow_speed_change, cta_enabled, cta_text, cta_timing_seconds, cta_url, lock_cta, audio_note_url, audio_note_timing, audio_note_autoplay, audio_lock_video, show_contact_buttons, contact_whatsapp, contact_phone, contact_instagram, show_contact_after_cta, whatsapp_auto_message, whatsapp_message_template, payment_enabled, upi_id, qr_code_url, payment_instructions, total_views, funnel_mode, required_fields, speaker_mode, speaker_name, speaker_photo_url, speaker_about, video_topics_enabled, video_topics, video_topics_scope"
      )
      .eq("slug", slug)
      .maybeSingle();

    const { data: publicVisibleRow, error: publicProbeErr } = await publicProbeClient
      .from("funnels")
      .select("id, slug, is_published, visibility")
      .eq("slug", slug)
      .maybeSingle();

    let callerIsAdmin = false;
    if (callerUserId) {
      const { data } = await supabase.rpc("has_role", { _user_id: callerUserId, _role: "admin" });
      callerIsAdmin = data === true;
    }

    const logNotFoundDiagnostics = (reason: string) => {
      console.warn("[get-funnel-data] preview unavailable", {
        reason,
        requested_slug: slug,
        row_exists_ignoring_status: !!funnel,
        row_status: funnel
          ? {
              is_published: funnel.is_published ?? null,
              visibility: funnel.visibility ?? null,
            }
          : null,
        public_query_returned_zero_rows: !publicVisibleRow && !publicProbeErr,
        public_query_error: publicProbeErr?.message ?? null,
        caller_is_owner: !!callerUserId && funnel?.owner_id === callerUserId,
        caller_is_admin: callerIsAdmin,
      });
    };

    if (funnelErr || !funnel) {
      logNotFoundDiagnostics("no_row_for_slug");
      return json({ error: "Funnel not found" }, 404);
    }

    const canPreviewDraft = !!callerUserId && (callerUserId === funnel.owner_id || callerIsAdmin);
    if (funnel.is_published !== true && !canPreviewDraft) {
      logNotFoundDiagnostics("not_published_for_public");
      return json({ error: "Funnel not found" }, 404);
    }

    // View-limit gate (daily / monthly / both — driven by plan's view_limit_mode).
    // Returns blocked:true so the public viewer can render the calm "unavailable" gate.
    try {
      if (funnel.is_published !== true) throw new Error("skip_limit_check_for_draft_preview");
      const { data: overLimit } = await supabase.rpc("is_funnel_over_monthly_limit", { _funnel_id: funnel.id });
      if (overLimit === true) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", funnel.owner_id)
          .single();

        // Fire-and-forget creator notification, rate-limited to 1/hour via email_logs
        (async () => {
          try {
            if (!ownerProfile?.email) return;
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { data: recent } = await supabase
              .from("email_logs")
              .select("id")
              .eq("user_id", funnel.owner_id)
              .eq("email_type", "view_limit_reached")
              .gte("created_at", oneHourAgo)
              .limit(1)
              .maybeSingle();
            if (recent) return;

            const { data: stats } = await supabase.rpc("get_user_monthly_views", { _user_id: funnel.owner_id });
            const mode = (stats as any)?.mode || "monthly";
            const used = mode === "daily" ? (stats as any)?.daily_used : (stats as any)?.used;
            const lim  = mode === "daily" ? (stats as any)?.daily_limit : (stats as any)?.limit;

            const subject = `⚠️ Your nFlow funnel "${funnel.title}" has reached its view limit`;
            const html = `
              <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
                <h2 style="margin:0 0 12px">Your funnel reached its view limit</h2>
                <p>Hi ${ownerProfile.full_name || "there"},</p>
                <p>Your funnel <strong>"${funnel.title}"</strong> has reached its ${mode} view limit.
                New visitors are temporarily seeing a "currently unavailable" page.</p>
                <p style="background:#f1f5f9;padding:12px 16px;border-radius:8px">
                  ${used ?? 0} / ${lim ?? "—"} ${mode} views used
                </p>
                <p>To let prospects continue watching:</p>
                <ul>
                  <li>Upgrade your plan for a higher limit</li>
                  <li>Or buy extra views for this month</li>
                </ul>
                <p><a href="https://nflow.nevorai.com/billing" style="display:inline-block;background:#1D4ED8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open billing</a></p>
                <p style="color:#64748b;font-size:13px;margin-top:24px">Your existing leads and funnels are safe — only new views are paused.</p>
              </div>
            `;
            await supabase.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: { to: ownerProfile.email, subject, html, purpose: "transactional", template: "view_limit_reached" },
            });
            await supabase.from("email_logs").insert({
              user_id: funnel.owner_id,
              email_type: "view_limit_reached",
              metadata: { funnel_title: funnel.title, mode, used, limit: lim },
            });
          } catch (e) {
            console.warn("[get-funnel-data] limit-reached email failed:", e);
          }
        })();

        return new Response(
          JSON.stringify({
            blocked: true,
            reason: "view_limit_reached",
            creator: { full_name: ownerProfile?.full_name || null },
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
            },
          },
        );
      }
    } catch (_) {
      // Fail open — never block legit traffic on a transient RPC error
    }

    // Parallel fetches for related data
    const promises: Promise<{ key: string; data: unknown }>[] = [];

    // Video asset — only needed fields
    if (funnel.video_asset_id) {
      promises.push(
        supabase
          .from("video_assets")
          .select("id, title, public_url, thumbnail_url, duration_seconds, status, allow_copy_link, allow_seek, allow_playback_speed")
          .eq("id", funnel.video_asset_id)
          .single()
          .then((r) => ({ key: "video", data: r.data }))
      );
    } else {
      promises.push(Promise.resolve({ key: "video", data: null }));
    }

    // Creator profile — include trial/subscription fields so the public page
    // can show a friendly "temporarily unavailable" gate when the creator's
    // access has lapsed.
    promises.push(
      supabase
        .from("profiles")
        .select("full_name, city, instagram_url, avatar_url, kyc_status, bio, subscription_status, trial_start_date")
        .eq("id", funnel.owner_id)
        .single()
        .then((r) => ({ key: "creator", data: r.data }))
    );

    // Form config
    promises.push(
      supabase
        .from("funnel_lead_form_config")
        .select("capture_enabled, capture_timing, show_name, name_required, show_phone, phone_required, show_email, email_required, show_city, city_required, show_custom, custom_required, custom_field_label")
        .eq("funnel_id", funnel.id)
        .single()
        .then((r) => ({ key: "formConfig", data: r.data }))
    );

    // Price options
    promises.push(
      supabase
        .from("funnel_price_options")
        .select("id, label, amount, description, position")
        .eq("funnel_id", funnel.id)
        .order("position")
        .then((r) => ({ key: "priceOptions", data: r.data || [] }))
    );

    // Funnel steps (for multi-step mode) — include video asset resolution
    if (funnel.funnel_mode === "multi") {
      promises.push(
        (async () => {
          const { data: steps } = await supabase
            .from("funnel_steps")
            .select("id, step_order, title, description, step_type, video_asset_id, is_active, unlock_rule_type, unlock_rule_value, cta_text, cta_url, booking_url, access_code_enabled, access_code_plain, access_code_message, speaker_mode_step, speaker_name_custom, speaker_title, speaker_bio, speaker_photo_url_custom, time_delay_enabled, time_delay_minutes, timer_cta_enabled, timer_cta_text, timer_cta_url, timer_cta_style, video_topics_step_enabled, video_topics_step")
            .eq("funnel_id", funnel.id)
            .eq("is_active", true)
            .order("step_order");

          if (!steps || steps.length === 0) return { key: "steps", data: [] };

          const videoIds = steps
            .filter((s) => s.step_type === "video" && s.video_asset_id)
            .map((s) => s.video_asset_id!);

          let videoMap: Record<string, { public_url: string | null; thumbnail_url: string | null; allow_copy_link: boolean; allow_seek: boolean; allow_playback_speed: boolean }> = {};
          if (videoIds.length > 0) {
            const { data: videos } = await supabase
              .from("video_assets")
              .select("id, public_url, thumbnail_url, allow_copy_link, allow_seek, allow_playback_speed")
              .in("id", videoIds);
            if (videos) {
              for (const v of videos) {
                videoMap[v.id] = {
                  public_url: v.public_url,
                  thumbnail_url: v.thumbnail_url,
                  allow_copy_link: v.allow_copy_link !== false,
                  allow_seek: (v as any).allow_seek !== false,
                  allow_playback_speed: (v as any).allow_playback_speed !== false,
                };
              }
            }
          }

          const enrichedSteps = steps.map((s) => ({
            ...s,
            video_url: s.video_asset_id ? videoMap[s.video_asset_id]?.public_url || null : null,
            video_thumbnail: s.video_asset_id ? videoMap[s.video_asset_id]?.thumbnail_url || null : null,
            video_allow_copy_link: s.video_asset_id ? videoMap[s.video_asset_id]?.allow_copy_link !== false : false,
            video_allow_seek: s.video_asset_id ? videoMap[s.video_asset_id]?.allow_seek !== false : true,
            video_allow_playback_speed: s.video_asset_id ? videoMap[s.video_asset_id]?.allow_playback_speed !== false : true,
          }));

          return { key: "steps", data: enrichedSteps };
        })()
      );
    } else {
      promises.push(Promise.resolve({ key: "steps", data: [] }));
    }

    // Active subscription for the funnel owner — used to determine if the
    // creator still has access. Only need the bare minimum.
    promises.push(
      supabase
        .from("user_subscriptions")
        .select("tier, status, billing_type, expires_at")
        .eq("user_id", funnel.owner_id)
        .in("status", ["active", "payment_failed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => ({ key: "subscription", data: r.data }))
    );

    // Trial settings (platform-wide)
    promises.push(
      supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["trial_enabled", "trial_days"])
        .then((r) => ({ key: "trialSettings", data: r.data || [] }))
    );

    // Atomic view count increment — fire-and-forget, non-blocking
    if (funnel.is_published === true) {
      supabase.rpc("increment_funnel_views", { _funnel_id: funnel.id }).then(() => {});
    }

    const results = await Promise.all(promises);
    const resultMap: Record<string, any> = {};
    for (const r of results) resultMap[r.key] = r.data;

    // ─── Compute creatorActive flag ────────────────────────────
    // Active = paid sub still valid OR trial still within window.
    const creator = resultMap.creator || {};
    const sub = resultMap.subscription;
    const trialMap: Record<string, string> = {};
    for (const s of resultMap.trialSettings || []) trialMap[s.key] = s.value;
    const trialEnabled = trialMap.trial_enabled === "true";
    const trialDays = parseInt(trialMap.trial_days || "7", 10);

    const now = Date.now();
    const hasPaidSub =
      !!sub &&
      sub.status === "active" &&
      sub.tier !== "free" &&
      (!sub.expires_at || new Date(sub.expires_at).getTime() > now);

    let trialActive = false;
    if (trialEnabled && creator.subscription_status === "trial" && creator.trial_start_date) {
      const start = new Date(creator.trial_start_date).getTime();
      const elapsedDays = Math.floor((now - start) / 86_400_000);
      trialActive = elapsedDays < trialDays;
    }

    // Manual/free billing types are also treated as active (admin-granted).
    const manualGrant = !!sub && sub.status === "active" && sub.billing_type === "manual";

    // Default to ACTIVE unless we can prove the creator's access has lapsed.
    // Quota / view-limit gating is handled separately by is_funnel_over_monthly_limit
    // above, so we should never block legit free-tier or unsubscribed creators
    // here. Only an explicit "expired"/"cancelled" status counts as inactive.
    const explicitlyInactive =
      creator.subscription_status === "expired" ||
      creator.subscription_status === "cancelled" ||
      (sub && sub.status === "payment_failed");

    const creatorActive =
      hasPaidSub || trialActive || manualGrant || !explicitlyInactive;

    const payload = {
      funnel,
      video: resultMap.video,
      creator: resultMap.creator,
      formConfig: resultMap.formConfig,
      priceOptions: resultMap.priceOptions,
      steps: resultMap.steps,
      creatorActive,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // Shorter cache because creatorActive is time-sensitive
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
