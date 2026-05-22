const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Helper: base64url encode for Gmail API
function base64url(str: string): string {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  let binary = ''
  for (const byte of data) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeMimeHeader(value: string): string {
  const needsEncoding = /[^\x20-\x7E]/.test(value)
  if (!needsEncoding) return value

  const utf8Bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of utf8Bytes) binary += String.fromCharCode(byte)
  return `=?UTF-8?B?${btoa(binary)}?=`
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null

  try {
    const payload = parts[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')

    return JSON.parse(atob(payload)) as Record<string, unknown>
  } catch {
    return null
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type AdminAccessResult =
  | { kind: 'error'; response: Response }
  | { kind: 'ok'; adminSupabase: any }

async function requireAdminAccess(
  authHeader: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<AdminAccessResult> {
  const userSupabase = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: userError } = await userSupabase.auth.getUser()
  if (userError || !user) {
    return { kind: 'error', response: jsonResponse({ error: 'Unauthorized' }, 401) }
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: isAdmin, error: roleError } = await adminSupabase.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin',
  })

  if (roleError || !isAdmin) {
    return { kind: 'error', response: jsonResponse({ error: 'Admin access required' }, 403) }
  }

  return { kind: 'ok', adminSupabase }
}

async function getLatestToken(supabase: any) {
  const { data: tokens, error: tokenErr } = await supabase
    .from('gmail_oauth_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)

  if (tokenErr) {
    throw new Error(tokenErr.message)
  }

  return tokens?.[0] ?? null
}

async function refreshAccessToken(supabase: any, tokenRow: any): Promise<string> {
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Token refresh failed: ${errText}`)
  }

  const data = await res.json()
  const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()

  await supabase.from('gmail_oauth_tokens').update({
    access_token: data.access_token,
    token_expiry: newExpiry,
  }).eq('id', tokenRow.id)

  return data.access_token
}

function parseGmailApiError(errText: string): {
  message: string
  code?: string
  activationUrl?: string | null
  googleProjectNumber?: string | null
} {
  try {
    const parsed = JSON.parse(errText)
    const topLevelMessage = typeof parsed?.error?.message === 'string' ? parsed.error.message : errText
    const topLevelReason = typeof parsed?.error?.errors?.[0]?.reason === 'string'
      ? parsed.error.errors[0].reason
      : undefined
    const details = Array.isArray(parsed?.error?.details) ? parsed.error.details : []
    const errorInfo = details.find((detail: any) => detail?.['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo')
    const help = details.find((detail: any) => detail?.['@type'] === 'type.googleapis.com/google.rpc.Help')
    const serviceDisabled = errorInfo?.reason === 'SERVICE_DISABLED' || topLevelReason === 'accessNotConfigured'

    if (serviceDisabled) {
      const activationUrl = typeof errorInfo?.metadata?.activationUrl === 'string'
        ? errorInfo.metadata.activationUrl
        : typeof help?.links?.[0]?.url === 'string'
          ? help.links[0].url
          : null
      const consumer = typeof errorInfo?.metadata?.consumer === 'string' ? errorInfo.metadata.consumer : null

      return {
        message: 'Gmail API is disabled in Google Cloud for this OAuth app. Enable Gmail API, wait a few minutes, then retry.',
        code: 'gmail_api_disabled',
        activationUrl,
        googleProjectNumber: consumer?.replace(/^projects\//, '') ?? null,
      }
    }

    return {
      message: topLevelMessage,
      code: topLevelReason,
    }
  } catch {
    return { message: errText }
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  try {
    const authHeader = req.headers.get('Authorization')

    if (req.method === 'GET') {
      if (!authHeader) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      const adminAccess = await requireAdminAccess(authHeader, supabaseUrl, serviceRoleKey)
      if (adminAccess.kind === 'error') {
        return adminAccess.response
      }

      const url = new URL(req.url)
      const action = url.searchParams.get('action')
      const adminSupabase = adminAccess.adminSupabase
      const tokenRow = await getLatestToken(adminSupabase)

      // Disconnect: delete all stored tokens
      if (action === 'disconnect') {
        if (tokenRow) {
          await adminSupabase.from('gmail_oauth_tokens').delete().eq('id', tokenRow.id)
        }
        return jsonResponse({ disconnected: true })
      }

      if (!tokenRow) {
        return jsonResponse({ connected: false, email: null, token_expiry: null, reason: 'no_token' })
      }

      // Probe Gmail to verify token actually works
      let accessToken = tokenRow.access_token
      const expiresAt = new Date(tokenRow.token_expiry).getTime()
      let probeReason: string | null = null

      try {
        if (Number.isFinite(expiresAt) && Date.now() > expiresAt - 5 * 60 * 1000) {
          accessToken = await refreshAccessToken(adminSupabase, tokenRow)
        }
      } catch (e: any) {
        console.error('Refresh failed during probe:', e?.message)
        probeReason = 'token_revoked'
      }

      // Probe with userinfo endpoint — only requires the userinfo.email scope
      // we actually have. Calling Gmail API endpoints would 403 due to
      // insufficient scope (we only requested gmail.send), which previously
      // caused false "token_revoked" reports.
      const PROBE_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
      let healthy = false
      if (!probeReason) {
        const probe = await fetch(PROBE_URL, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (probe.ok) {
          healthy = true
        } else if (probe.status === 401) {
          // Truly invalid access token — try one refresh + retry
          try {
            accessToken = await refreshAccessToken(adminSupabase, tokenRow)
            const retry = await fetch(PROBE_URL, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
            healthy = retry.ok
            if (!retry.ok) probeReason = 'token_revoked'
          } catch {
            probeReason = 'token_revoked'
          }
        } else {
          // 403 / 5xx etc — do NOT mark as revoked, log the status
          probeReason = `probe_status_${probe.status}`
          // Token is still considered usable for sending; trust DB state
          healthy = true
        }
      }

      return jsonResponse({
        connected: healthy,
        email: tokenRow.gmail_email,
        token_expiry: tokenRow.token_expiry,
        reason: healthy ? null : probeReason,
      })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: `Method ${req.method} not allowed` }, 405)
    }

    const apiKeyHeader = req.headers.get('apikey')

    if (!authHeader && !apiKeyHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
    const claims = token ? parseJwtClaims(token) : null

    // Internal backend callers (process-email-queue, send-landing-page-confirmation,
    // verify-nevorai-member, etc.) authenticate by sending the project's
    // SUPABASE_SERVICE_ROLE_KEY in the Authorization header. We accept this in two ways:
    //   1) The token JWT has role = service_role (legacy keys).
    //   2) The token equals the SUPABASE_SERVICE_ROLE_KEY exactly (covers new
    //      signing-keys system where the JWT may not parse with role claim
    //      that we expect).
    const isInternalServiceRole =
      claims?.role === 'service_role' ||
      (token && token === serviceRoleKey) ||
      (apiKeyHeader && apiKeyHeader === serviceRoleKey)

    let supabase: any
    if (isInternalServiceRole) {
      supabase = createClient(supabaseUrl, serviceRoleKey)
    } else {
      const adminAccess = await requireAdminAccess(authHeader, supabaseUrl, serviceRoleKey)
      if (adminAccess.kind === 'error') {
        return adminAccess.response
      }

      supabase = adminAccess.adminSupabase
    }

    const payload = await req.json().catch(() => null)
    const to = typeof payload?.to === 'string' ? payload.to.trim() : ''
    const subject = typeof payload?.subject === 'string' ? payload.subject.trim() : ''
    const html = typeof payload?.html === 'string' ? payload.html.trim() : ''
    const sender_name = typeof payload?.sender_name === 'string' ? payload.sender_name.trim() : undefined

    if (!to || !subject || !html) {
      return jsonResponse({ error: 'Missing required fields: to, subject, html' }, 400)
    }

    // Get the admin's Gmail tokens (pick the most recent)
    const tokenRow = await getLatestToken(supabase)

    if (!tokenRow) {
      console.error('No Gmail tokens found')
      return jsonResponse({ error: 'Gmail not connected. Please connect Gmail in admin settings.' }, 503)
    }

    let accessToken = tokenRow.access_token

    // Check if token is expired (with 5 min buffer)
    const expiresAt = new Date(tokenRow.token_expiry).getTime()
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt - 5 * 60 * 1000) {
      console.log('Access token expired, refreshing...')
      accessToken = await refreshAccessToken(supabase, tokenRow)
    }

    // Build MIME message
    const fromName = sender_name || 'nFlow'
    const fromEmail = tokenRow.gmail_email
    const mimeMessage = [
      `From: ${encodeMimeHeader(fromName)} <${fromEmail}>`,
      `To: ${to}`,
      `Subject: ${encodeMimeHeader(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      html,
    ].join('\r\n')

    const encodedMessage = base64url(mimeMessage)

    // Send via Gmail API
    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    })

    if (!gmailRes.ok) {
      const errBody = await gmailRes.text()
      const parsedError = parseGmailApiError(errBody)
      console.error(`Gmail API error [${gmailRes.status}]:`, errBody)

      // If 401, try refreshing token once more
      if (gmailRes.status === 401) {
        accessToken = await refreshAccessToken(supabase, tokenRow)
        const retryRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: encodedMessage }),
        })

        if (!retryRes.ok) {
          const retryErr = await retryRes.text()
          const retryParsedError = parseGmailApiError(retryErr)
          const retryError = new Error(retryParsedError.message) as Error & {
            status?: number
            code?: string
            activationUrl?: string | null
            googleProjectNumber?: string | null
          }
          retryError.status = retryRes.status
          retryError.code = retryParsedError.code
          retryError.activationUrl = retryParsedError.activationUrl
          retryError.googleProjectNumber = retryParsedError.googleProjectNumber
          throw retryError
        }

        const retryResult = await retryRes.json()
        console.log('Email sent via Gmail (after retry):', retryResult.id)
        return jsonResponse({ sent: true, message_id: retryResult.id })
      }

      const sendError = new Error(parsedError.message) as Error & {
        status?: number
        code?: string
        activationUrl?: string | null
        googleProjectNumber?: string | null
      }
      sendError.status = gmailRes.status
      sendError.code = parsedError.code
      sendError.activationUrl = parsedError.activationUrl
      sendError.googleProjectNumber = parsedError.googleProjectNumber
      throw sendError
    }

    const result = await gmailRes.json()
    console.log('Email sent via Gmail:', result.id)

    return jsonResponse({ sent: true, message_id: result.id })
  } catch (err: any) {
    console.error('Gmail email error:', err)
    return jsonResponse({
      error: err.message,
      sent: false,
      code: err.code ?? null,
      activation_url: err.activationUrl ?? null,
      google_project_number: err.googleProjectNumber ?? null,
    }, err.status ?? 500)
  }
})