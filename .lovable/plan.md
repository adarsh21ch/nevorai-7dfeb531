# Fix "Something went wrong" in Nev AI

## Diagnosis

- Endpoint is deployed (Supabase gateway responds, not 404).
- Migration ran (`nev_ai_usage` exists).
- `GEMINI_API_KEY` is set.
- The frontend's "Something went wrong" is the catch-all for any non-2xx with no `reply` body.

Most likely root cause: one of the Supabase queries inside the function throws because a table/column name in this project doesn't match what the function assumes (e.g. `funnels.owner_id` vs `user_id`, `user_daily_views`, `user_subscriptions`, `profiles.trial_start_date`). One throw inside the big `try` → falls into the fatal `catch` → returns 500 with a generic reply → frontend shows generic error.

## Plan

Edit only `supabase/functions/nev-ai-query/index.ts`:

1. **Wrap every Supabase query in its own try/catch** so a missing table/column doesn't kill the whole request. Default to `null` / `[]` / `0` and log the real error with `console.error`.

2. **Auto-detect the funnels owner column.** Try `owner_id` first; if Postgres returns "column does not exist" (code `42703`), retry with `user_id`. Cache the resolved name in a module variable.

3. **Same defensive fallback for `user_daily_views`** (try `user_id`, fall back to skipping if the table doesn't exist).

4. **Always return 200 with a usable `reply`.** Even when stats partially fail, we still call Gemini with whatever we have. Only return 5xx if Gemini itself fails or auth fails.

5. **Surface the real error to the chat during this debug phase**: add an optional `?debug=1` query param. When present, the assistant `reply` includes the underlying error string. (You can call it once from the chat to confirm the cause, then we remove it.)

6. **Always log structured error context** (`{ step, code, message }`) so future failures show up in the Supabase function logs.

No frontend changes, no schema changes, no new secrets.

## After the edit

You redeploy `nev-ai-query` once more (`supabase functions deploy nev-ai-query --project-ref dnyjlmtiliqkpxwsgqyn` or paste the file into the Dashboard). Then send a message in Nev AI — it should either work, or reply with the exact underlying error so we can fix the column name in one more pass.
