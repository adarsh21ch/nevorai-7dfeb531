const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const slug = url.searchParams.get('slug')

    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Explicit safe column list — NEVER include access_code_hash or invite_code.
    // Code verification happens server-side via verify-landing-page-code.
    // Explicit safe column list — NEVER include access_code_hash or invite_code (secrets).
    const { data: page, error } = await supabase
      .from('landing_pages')
      .select(`
        id, owner_id, slug, status, title, description, sections,
        form_title, form_subtitle, form_button_text,
        field_name_enabled, field_name_required,
        field_phone_enabled, field_phone_required,
        field_email_enabled, field_email_required,
        field_age_enabled, field_age_required,
        field_city_enabled, field_city_required,
        field_state_enabled, field_state_required,
        field_occupation_enabled, field_occupation_required,
        field_custom_1_enabled, field_custom_1_label, field_custom_1_required,
        field_custom_2_enabled, field_custom_2_label, field_custom_2_required,
        field_dob_enabled, field_dob_required,
        min_age_enabled, min_age,
        post_submit_video_asset_id, post_submit_video_title, post_submit_video_description,
        linked_funnel_id, allow_login, allow_signup,
        invite_code_required, og_title, og_description, og_image_url,
        total_views, total_registrations, theme_color, background_style,
        speaker_name, speaker_role, speaker_bio, speaker_photo_url,
        sender_display_name,
        testimonials_enabled, testimonials_section_title, testimonials_display_position,
        access_code_enabled, access_code_message,
        faq_items, created_at, updated_at
      `)
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    if (error || !page) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch creator profile
    const { data: creator } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, kyc_status, instagram_url')
      .eq('id', page.owner_id)
      .single()

    // Fetch video if set
    let video = null
    if (page.post_submit_video_asset_id) {
      const { data: v } = await supabase
        .from('video_assets')
        .select('id, title, public_url, thumbnail_url')
        .eq('id', page.post_submit_video_asset_id)
        .single()
      video = v
    }

    // Increment views (fire and forget)
    supabase.rpc('increment_landing_page_views', { _landing_page_id: page.id }).then(() => {})

    // Insert view log
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    supabase.from('landing_page_view_logs').insert({
      landing_page_id: page.id,
      ip_address: ip,
    }).then(() => {})

    return new Response(JSON.stringify({ page, creator, video }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
