## Apply whatsapp_leads migration

Run the SQL in `supabase/migrations/20260524205603_whatsapp_leads.sql` against the project's Supabase database to create the CRM lead-tracking table used by the WhatsApp bot.

### What gets created
- **Table** `public.whatsapp_leads` — one row per unknown WhatsApp phone, with progressive enrichment fields (name, email, business_type, interest, plan_interest), pipeline tracking (status, score, source), engagement metrics, conversion/handoff fields, notes, and timestamps. Unique on `phone_number`.
- **Indexes**: `(status, score, last_message_at DESC)`, `phone_number`, partial `assigned_to`, and `last_message_at DESC`.
- **RLS**: enabled, with two policies — admins (via `has_role(auth.uid(),'admin')`) and `service_role` get full access. No public/end-user access.
- **Trigger**: `whatsapp_leads_updated_at` calls `tg_whatsapp_leads_updated_at()` (SECURITY DEFINER, locked `search_path`) to bump `updated_at` on every update.

### Steps (in build mode)
1. Execute the migration via the Supabase migration tool (schema change, so migration — not insert tool).
2. Regenerate `src/integrations/supabase/types.ts` so the new table is typed for the upcoming Leads tab in `/admin/whatsapp`.

No application code changes in this task — the Leads tab UI is "coming in Phase 5" per the migration comment and is out of scope.

### Notes
- Migration is idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE FUNCTION`), so re-running is safe.
- Depends on `public.profiles` and `public.has_role(uuid, app_role)` — both already exist in the project.