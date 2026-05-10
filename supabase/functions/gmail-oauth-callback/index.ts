import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function parseState(rawState: string | null): { userId: string | null; returnTo: string | null } {
  if (!rawState) return { userId: null, returnTo: null }

  try {
    const decoded = atob(rawState)
    const parsed = JSON.parse(decoded)
    return {
      userId: typeof parsed?.userId === 'string' ? parsed.userId : null,
      returnTo: typeof parsed?.returnTo === 'string' ? parsed.returnTo : null,
    }
  } catch {
    return { userId: rawState, returnTo: null }
  }
}

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' }

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const { userId, returnTo } = parseState(url.searchParams.get('state'))
    const error = url.searchParams.get('error')

    if (error) {
      return new Response(renderHtml('Authorization denied', `Error: ${error}`, false, returnTo, null), {
        headers: HTML_HEADERS,
      })
    }

    if (!code || !userId) {
      return new Response(renderHtml('Missing parameters', 'Authorization code or state missing.', false, returnTo, null), {
        headers: HTML_HEADERS,
      })
    }

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const redirectUri = `${SUPABASE_URL}/functions/v1/gmail-oauth-callback`

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error('Token exchange failed:', errText)
      return new Response(renderHtml('Token exchange failed', errText, false, returnTo, null), {
        headers: HTML_HEADERS,
      })
    }

    const tokens = await tokenRes.json()
    const { access_token, refresh_token, expires_in } = tokens

    if (!refresh_token) {
      return new Response(renderHtml('No refresh token', 'Please revoke access at myaccount.google.com/permissions and try again.', false, returnTo, null), {
        headers: HTML_HEADERS,
      })
    }

    // Get Gmail email
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const userInfo = await userInfoRes.json()
    const gmailEmail = userInfo.email

    const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()

    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Delete existing tokens for this user, then insert new
    await supabase.from('gmail_oauth_tokens').delete().eq('user_id', userId)
    const { error: insertErr } = await supabase.from('gmail_oauth_tokens').insert({
      user_id: userId,
      access_token,
      refresh_token,
      token_expiry: tokenExpiry,
      gmail_email: gmailEmail,
    })

    if (insertErr) {
      console.error('DB insert error:', insertErr)
      return new Response(renderHtml('Database error', insertErr.message, false, returnTo, null), {
        headers: HTML_HEADERS,
      })
    }

    return new Response(renderHtml('Gmail Connected!', `Successfully connected ${gmailEmail}.`, true, returnTo, gmailEmail), {
      headers: HTML_HEADERS,
    })
  } catch (err: any) {
    console.error('Callback error:', err)
    return new Response(renderHtml('Error', err.message, false, null, null), {
      headers: HTML_HEADERS,
    })
  }
})

function renderHtml(title: string, message: string, success: boolean, returnTo: string | null, email: string | null): string {
  const color = success ? '#22c55e' : '#ef4444'
  const safeReturnTo = returnTo ? JSON.stringify(returnTo) : 'null'
  const safeEmail = email ? JSON.stringify(email) : 'null'
  const messageType = success ? 'GMAIL_OAUTH_SUCCESS' : 'GMAIL_OAUTH_ERROR'
  const safeMessage = JSON.stringify(message)

  // Script: try popup postMessage first, then fallback to redirect, finally show button
  const script = `
<script>
(function() {
  var payload = { type: ${JSON.stringify(messageType)}, email: ${safeEmail}, message: ${safeMessage} };
  var returnTo = ${safeReturnTo};
  var didNotify = false;

  // 1) Popup case: notify opener and close
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, '*');
      didNotify = true;
      setTimeout(function() {
        try { window.close(); } catch (e) {}
      }, 600);
      return;
    }
  } catch (e) { /* cross-origin opener access can throw — ignore */ }

  // 2) Full-page fallback: redirect back to returnTo
  if (returnTo) {
    setTimeout(function() {
      try { window.location.href = returnTo; } catch (e) {}
    }, 800);
  }
})();
</script>`

  const fallbackButton = returnTo
    ? `<a href="${returnTo.replace(/"/g, '&quot;')}" style="display:inline-block;margin-top:18px;padding:10px 20px;background:${color};color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">Return to Settings</a>`
    : `<button onclick="window.close()" style="margin-top:18px;padding:10px 20px;background:${color};color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Close Window</button>`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0a0a0f;color:#fff;margin:0;">
<div style="text-align:center;max-width:420px;padding:40px;">
<div style="width:64px;height:64px;border-radius:50%;background:${color}20;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
<span style="font-size:28px;color:${color};">${success ? '✓' : '✗'}</span>
</div>
<h1 style="font-size:22px;margin:0 0 12px;color:${color};">${title}</h1>
<p style="font-size:14px;color:#94a3b8;line-height:1.6;margin:0;">${message}</p>
${fallbackButton}
</div>
${script}
</body>
</html>`
}
