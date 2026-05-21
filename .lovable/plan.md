## Reality check (read first)

Your funnel system **already has** most of the schema you described — just under different names:

| You asked for | Already exists as |
|---|---|
| `funnel_steps.type` / `config` | `funnel_steps.step_type` + 30+ typed columns (video_asset_id, cta_url, booking_url, timer_*, access_code_*, etc.) |
| `funnel_leads` | `funnel_leads` (name/phone/email/status) ✅ |
| `step_submissions` | `funnel_step_progress` (per-lead per-step state, watch %, unlocked flags) ✅ |
| `manual_unlock_requests` | `funnel_step_progress.manually_unlocked` + `unlocked_by` ✅ |
| Payment | `funnel_payments` + `funnel_price_options` ✅ (you said "skip payment, mark coming soon") |

What's actually broken vs missing is **UI wiring**, not backend. Rebuilding the schema your way would delete working features (video analytics, access codes, between-step audio, timers, speaker per-step, privacy, etc.) and break every existing funnel.

**I will NOT do a full rewrite.** I'll fix the actual gaps on top of what exists.

---

## What I'll build (one phase at a time, you approve each)

### Phase 1 — Step Editor (the actual blocker you screenshotted)
The "Full step configuration UI will be ported in a later pass" placeholder → replace with real per-type editor.

**File:** `src/components/funnel/StepConfigPanel.tsx` (already exists, currently stub)

Per `step_type`, render:
- **video** — VideoPickerModal (already exists) + show selected thumbnail/title/duration after pick (fixes your bug) + unlock-after-percent slider
- **lead_form** — reuse existing `CustomFieldsBuilder.tsx` + submit-button label + success message
- **booking** — WhatsApp number + country code + message template with `{prospect_name}` `{funnel_title}` vars + instruction text
- **cta** (existing key, your "cta_link") — button label + URL (validated) + new_tab toggle + instruction
- **manual_approval** (existing key, your "manual_unlock") — instruction + WhatsApp contact + "notify me" toggle
- **payment** — locked card, "Coming Soon" badge, disable in `StepTypeSelector` ✅

Live right-side preview reuses existing `JourneyPreview`/`MultiStepViewer`.

### Phase 2 — Prospect view wiring
`PublicFunnel.tsx` + `MultiStepViewer.tsx` already render steps. Gaps to fix:
- booking step → render WhatsApp deep-link button, mark step complete on click (write `funnel_step_progress`)
- cta step → same (click → unlock)
- manual_approval → show "waiting" state, subscribe via Supabase realtime to `funnel_step_progress` for live unlock
- video step → already tracks; verify auto-advance fires at threshold

### Phase 3 — Creator unlock panel
In `LeadProgressTab.tsx` (already exists), add per-step "Unlock" button for `step_type='manual_approval'` rows where `manually_unlocked=false`. On click → update `funnel_step_progress` row.

### Phase 4 — Polish
Step reorder (drag), duplicate step menu item, preview-as-prospect button, lead count badge.

---

## What I'm NOT doing (and why)

- ❌ Creating new `step_submissions` / `manual_unlock_requests` tables — duplicates existing `funnel_step_progress`
- ❌ Renaming `step_type` → `type`, `config` columns → `jsonb` — would break every existing funnel + edge function + analytics query
- ❌ Auto-save every 30s — `FunnelEditor` already saves on blur; 30s timer adds race conditions
- ❌ Rebuilding `MultiStepViewer` — it works; I'll patch the missing step-type branches

---

## Credit-honest estimate

- Phase 1 alone: ~1 large message (it's the big one — 5 type-specific editor panels + preview)
- Phase 2: 1 medium message
- Phase 3: 1 small message
- Phase 4: optional, 1 medium

**Question for you before I start:** Approve this approach, or do you want me to do something different? Specifically:

1. ✅ Go phase by phase (recommended — safest, you see results each round)
2. ⚠️ Do Phase 1 + 2 in one shot (cheaper, riskier — more chance of a bug landing on you)
3. ❌ Full rewrite per your spec (will break existing funnels, not recommended)
