## Goal
Fix why **Connect Gmail** still opens a blank tab and then shows a failure toast.

## Plan
1. Reproduce the issue from the authenticated `/admin/settings#gmail` page in the live preview.
2. Inspect the exact `gmail-oauth-init` request/response and any browser console errors during the click.
3. Verify whether the failure is still happening before Google opens (edge function error) or during Google OAuth redirect/callback.
4. If the edge function is failing, patch the root cause only:
   - secret/env pickup issue
   - redirect URI/state sanitization issue
   - popup/message handling issue
5. Re-test the full Gmail connect flow end-to-end after the fix.

## What I already confirmed
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` now exist in project secrets.
- The preview session I can access is currently unauthenticated, so I cannot inspect the admin flow until you log in.

## Likely next checks once logged in
- Whether `gmail-oauth-init` is still returning a 500 even after secrets were added.
- Whether Google Cloud OAuth client has the exact callback URI registered.
- Whether the popup is being opened but never navigated because the init response is failing.

## Technical notes
Relevant files already identified:
- `src/pages/AdminSettingsPage.tsx`
- `supabase/functions/gmail-oauth-init/index.ts`
- `supabase/functions/gmail-oauth-callback/index.ts`
- `supabase/functions/send-gmail-email/index.ts`

Most likely remaining cause if secrets were added recently: the edge functions may still need to pick up the updated secrets before `gmail-oauth-init` can build the Google auth URL.