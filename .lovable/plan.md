## Remaining polish — what I found in a second pass

These are real gaps I noticed scanning the project after the 4 batches we shipped. Grouped by impact so you can pick.

---

### A. Destructive actions still use `window.confirm` (8 places)

Browser `confirm()` is jarring, blocks the thread, and can't be styled. Replace with a small shadcn `AlertDialog` wrapper.

Affected:
- Funnels list — delete funnel
- Live sessions — stop / cancel / delete
- Admin Videos — delete video (2 spots)
- Admin Refunds — approve refund (especially risky as a native confirm)
- Testimonials builder — delete testimonial
- Viewers analytics — revoke viewer access
- Admin View Tiers — delete tier

**Fix:** create one `<ConfirmDialog>` primitive, swap all 10 sites. Refund approval and viewer-revoke get an extra "type to confirm" step.

---

### B. Number inputs with no clamping / step / prefix

`type="number"` fields accept `e`, `-`, decimals, and don't display units. Examples:
- Live session duration / max attendees / payment amount
- Landing page min_age (1-120 — no live clamp)
- Admin view tier prices (₹ prefix missing)
- Override menu trial-days / view-limit

**Fix:** small `<NumberInput>` wrapper that strips non-digits, clamps to min/max on blur, and supports a unit prefix/suffix slot (`₹`, `days`, `views`).

---

### C. Search inputs fire on every keystroke (no debounce)

Funnels, Videos, Landing Pages, Leads, Admin Users, Admin Subscriptions all filter immediately. Fine on small lists, but Admin Users / Subscriptions / Leads can grow.

**Fix:** add `useDebouncedValue(search, 200)` hook, use the debounced value for filter logic. Input itself stays controlled and instant.

---

### D. Number formatting helper exists but isn't used yet

I shipped `formatINR` / `formatCompact` / `formatInt` in Batch 4 but didn't wire them in. Worth a sweep:
- Dashboard KPI strip (lead counts, view counts → `1.2K`)
- Billing / Pricing pages (₹ prices → `₹1,299`)
- Insights charts axis labels
- Admin subscriptions revenue cells
- Plan usage widget

Pure presentation change, no logic risk.

---

### E. Empty states are text-only

Most empty states are a single grey sentence ("No leads yet"). Lower-effort wins:
- Add an icon + a primary CTA button to: Insights (no funnels / no leads), Funnel Detail (no leads → "Copy share link"), Admin Videos table empty rows, VideoPickerModal.
- LeadsPage already has good empty states with CTAs — use it as the template.

---

### F. Public lead-form trust polish (carry-over from original audit)

We did the input-mode + inline-error polish in Batch 1. Two trust items still pending:
- **Privacy microcopy** under the submit button on all 5 public forms: "We'll never share your details. Unsubscribe anytime."
- **Verified-creator badge** when KYC is approved — already supported on backend (`kyc_status === 'approved'`), just not surfaced on PublicLandingPage / PublicFunnel header. ~20 lines per page.

---

### G. Stray `console.log` in production paths (8 calls)

Low priority — but they leak into the user's browser console. Worth a one-pass cleanup, keeping `console.error` for genuine error logging.

---

### H. Mobile keyboard polish on Admin

Admin tables have a few inputs (price, limits) without `inputMode="decimal"` / `"numeric"`. Same fix as B covers it.

---

## Suggested order (max ROI)

1. **A** — `ConfirmDialog` primitive + 10 swaps. Biggest perceived-quality jump, ~30 min.
2. **D** — wire the existing format helpers across KPI / billing / pricing surfaces.
3. **F** — verified badge on public pages + privacy microcopy on lead forms.
4. **B + H** — `NumberInput` wrapper, swap all admin/live numeric fields.
5. **C** — debounce search on the 6 admin/list pages.
6. **E** — richer empty states with CTAs.
7. **G** — console cleanup pass.

---

## Out of scope for this round

- Visual redesign / new color tokens
- New backend tables, RLS policies, edge functions
- Payment / KYC business logic changes
- i18n / translation infra

---

Tell me which letters (A–H) to ship and in what order, or just say "all in order" and I'll work through the list.