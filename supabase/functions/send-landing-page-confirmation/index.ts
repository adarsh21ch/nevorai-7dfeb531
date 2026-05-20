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

    const { registration_id, landing_page_id } = await req.json()

    if (!registration_id || !landing_page_id) {
      return new Response(JSON.stringify({ error: 'Missing params' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: reg } = await supabase
      .from('landing_page_registrations')
      .select('*')
      .eq('id', registration_id)
      .single()

    if (!reg || !reg.email) {
      return new Response(JSON.stringify({ sent: false, reason: 'No email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: page } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', landing_page_id)
      .single()

    // Treat NULL as enabled — column default is true, NULL only on legacy
    // rows that pre-date the toggle. Only an explicit `false` opts out.
    if (!page || page.send_confirmation_email === false) {
      return new Response(JSON.stringify({ sent: false, reason: 'Email disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use sender_display_name from landing page settings; fall back to platform name
    const senderDisplayName = (page as any).sender_display_name || 'nFlow'
    const isPlatformSender = senderDisplayName === 'nFlow'
    const trustBadgeText = isPlatformSender ? 'Verified by nFlow' : 'Sent via nFlow'
    const trustBadgeIcon = isPlatformSender
      ? '&#10003;'  // checkmark
      : '&#9656;'   // arrow

    let emailBody = (page.email_body || '').replace(/\{\{name\}\}/g, reg.name || 'there')
      .replace(/\{\{email\}\}/g, reg.email || '')
      .replace(/\{\{phone\}\}/g, reg.phone || '')

    let subject = (page.email_subject || 'Registration Confirmed').replace(/\{\{name\}\}/g, reg.name || 'there')

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #ffffff; color: #1a1a1a; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e5e5;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #22c55e; font-size: 20px; margin: 0;">nFlow</h1>
    </div>
    <h2 style="font-size: 22px; margin: 0 0 16px; color: #1a1a1a;">${page.email_heading || 'You are registered!'}</h2>
    <div style="font-size: 15px; line-height: 1.7; color: #555555; white-space: pre-line;">${emailBody}</div>
    ${page.email_footer_text ? `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 13px; color: #999999;">${page.email_footer_text}</div>` : ''}
    <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f0f0f0; text-align: center;">
      <span style="display: inline-block; font-size: 11px; color: #b0b0b0; letter-spacing: 0.5px; font-weight: 500;">
        <span style="display: inline-block; width: 16px; height: 16px; line-height: 16px; text-align: center; background: #f5f5f5; border-radius: 50%; font-size: 9px; color: #22c55e; margin-right: 5px; vertical-align: middle;">${trustBadgeIcon}</span>
        ${trustBadgeText}
      </span>
    </div>
  </div>
</body>
</html>`

    // Send via Gmail edge function. Authenticate as backend by sending the
    // project's service role key in the Authorization header.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const gmailRes = await fetch(`${supabaseUrl}/functions/v1/send-gmail-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        to: reg.email,
        subject,
        html,
        sender_name: senderDisplayName,
      }),
    })

    const result = await gmailRes.json()

    if (!gmailRes.ok || !result.sent) {
      console.error('Gmail send error:', JSON.stringify(result))
      throw new Error(result.error || 'Failed to send email via Gmail')
    }

    console.log('Email sent result:', JSON.stringify(result))

    // Update registration
    await supabase.from('landing_page_registrations').update({
      confirmation_email_sent: true,
      confirmation_email_sent_at: new Date().toISOString(),
    }).eq('id', registration_id)

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Email error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})