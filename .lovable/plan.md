## Batch 1 — Lead capture polish

Goal: improve conversion + data quality on every public lead form by upgrading input semantics, preventing double-submits, surfacing inline errors, and adding a "WhatsApp same as phone" shortcut.

### Scope (files to touch)

Public-facing lead forms only — no admin/builder, no auth, no styling overhaul:

- `src/pages/PublicLandingPage.tsx`
- `src/pages/PublicFunnel.tsx`
- `src/pages/PublicLivePage.tsx`
- `src/components/funnel/PrivateLeadForm.tsx`
- `src/components/funnel/MultiStepViewer.tsx`

A tiny shared helper `src/lib/leadInputs.ts` will hold reusable normalizers (so all 5 forms behave identically).

### What changes

1. **Phone inputs** (#1)
   - `type="tel"`, `inputMode="numeric"`, `autoComplete="tel"`, `maxLength={14}`
   - On change: strip non-digits; remove leading `+91`, `91` (when length >10), or leading `0`
   - Validation still requires final 10 digits

2. **Email inputs** (#2)
   - Add `inputMode="email"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`, `autoComplete="email"`
   - Trim on blur

3. **Name / City inputs** (#3)
   - `autoCapitalize="words"`, `autoComplete="name"` / `"address-level2"`
   - Trim on blur, collapse internal double spaces

4. **Submit buttons** (#5)
   - Local `submitting` state, `disabled={submitting}`, swap label for inline `<Loader2 className="animate-spin" />` + "Submitting…"
   - Remove the duplicate-prevention reliance on toast

5. **Inline field errors** (#6)
   - Add a `fieldErrors` state ({ phone?, email?, name?, ... }) per form
   - Render small red text under each invalid field; clear on change
   - On submit failure, scroll to the first errored field via `ref.scrollIntoView({ behavior: "smooth", block: "center" })`
   - Keep toast only for network/server failures

6. **WhatsApp = phone shortcut** (#7)
   - When the form shows both `phone` and `whatsapp` fields, render a small checkbox under the WhatsApp input: "Same as phone number"
   - When checked: copy phone → whatsapp live, disable the WhatsApp input, show muted styling
   - Default state: checked when whatsapp is empty and phone has 10 digits (gentle nudge); user can uncheck

### Out of scope (explicitly not changing)

- Visual design, colors, spacing, fonts, container widths
- Admin builders (FunnelEditor, LandingPageEditor, LiveSessionWizard)
- Auth pages, KYC, payment, OTP, DOB (DOB already has padding from last turn)
- Toast styling overhaul (Batch 4)
- Backend, DB schema, RLS, server functions
- Translation strings beyond the two new labels ("Same as phone number", "Submitting…")

### Technical notes

- Helper module `src/lib/leadInputs.ts` exports:
  - `normalizePhone(raw: string): string` — digits only, strips +91/91/leading-0, caps at 10
  - `validatePhone(v): string | null`, `validateEmail(v): string | null`, `validateRequired(v, label): string | null`
  - `trimSmart(v): string` — trim + collapse spaces
- Reused across all 5 forms so behavior is identical.
- No new dependencies. No router or route changes.
- Build verification after edits.

### Acceptance check

- Typing `+919876543210` or `09876543210` in any phone field results in `9876543210` and passes validation.
- Mobile keyboards: phone shows numeric pad, email shows email pad, no auto-capitalization on email.
- Tapping Submit twice fires the request once; button is disabled during the in-flight request.
- Submitting an invalid form shows red text under the offending field (no toast for validation), and the page scrolls to it.
- "Same as phone number" checkbox mirrors phone into whatsapp live and prevents edits while checked.