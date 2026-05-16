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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const {
      landing_page_id, name, phone, email, age, city, state,
      occupation, custom_1_value, custom_2_value, honeypot, user_agent, attribution,
    } = body

    // Honeypot check — fake success
    if (honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!landing_page_id) {
      return new Response(JSON.stringify({ error: 'landing_page_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch landing page
    const { data: page, error: pageErr } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', landing_page_id)
      .eq('status', 'published')
      .single()

    if (pageErr || !page) {
      return new Response(JSON.stringify({ error: 'Landing page not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate required fields
    if (page.field_email_enabled && page.field_email_required && !email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (page.field_name_enabled && page.field_name_required && !name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (page.field_phone_enabled && page.field_phone_required && !phone) {
      return new Response(JSON.stringify({ error: 'Phone is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Email format validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rate limit: check recent submissions from same IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('landing_page_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('landing_page_id', landing_page_id)
      .eq('ip_address', ip)
      .gte('submitted_at', oneHourAgo)

    if ((count || 0) >= 5) {
      // Fake success to not reveal rate limiting
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const deviceType = user_agent && /Mobi/i.test(user_agent) ? 'mobile' : 'desktop'

    // Insert registration
    const { data: reg, error: insertErr } = await supabase
      .from('landing_page_registrations')
      .insert({
        landing_page_id,
        owner_id: page.owner_id,
        name: name || null,
        phone: phone || null,
        email: email || null,
        age: age || null,
        city: city || null,
        state: state || null,
        occupation: occupation || null,
        custom_1_value: custom_1_value || null,
        custom_2_value: custom_2_value || null,
        ip_address: ip,
        device_type: deviceType,
        user_agent: user_agent || null,
      })
      .select('id')
      .single()

    if (insertErr) throw insertErr

    // Update count
    await supabase.from('landing_pages').update({
      total_registrations: (page.total_registrations || 0) + 1,
    }).eq('id', landing_page_id)

    // Fire confirmation email — call synchronously so we know the real result.
    // Use service role key so the downstream function authenticates as backend
    // (anon key is rejected by send-gmail-email for security).
    let emailDelivery: { attempted: boolean; sent: boolean; reason?: string } = {
      attempted: false,
      sent: false,
    }

    if (page.send_confirmation_email && email) {
      emailDelivery.attempted = true
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      try {
        const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-landing-page-confirmation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            registration_id: reg.id,
            landing_page_id,
          }),
        })
        const emailJson = await emailRes.json().catch(() => ({}))
        emailDelivery.sent = !!emailJson?.sent
        if (!emailDelivery.sent) {
          emailDelivery.reason = emailJson?.reason || emailJson?.error || `status_${emailRes.status}`
          console.error('Confirmation email not sent:', emailDelivery.reason)
        }
      } catch (e: any) {
        emailDelivery.reason = e?.message || 'fetch_failed'
        console.error('Confirmation email request failed:', e)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      registration_id: reg.id,
      email_delivery: emailDelivery,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
