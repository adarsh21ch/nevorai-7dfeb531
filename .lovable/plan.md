# Nev AI Analytics Chat Assistant

Add a chat panel where creators ask natural-language questions about their analytics (views, leads, funnels, conversion). AI runs server-side via a Supabase edge function using `GEMINI_API_KEY`; the frontend never sees AI keys.

## 1. Edge function — `supabase/functions/nev-ai-query/index.ts`

Endpoint: `POST /functions/v1/nev-ai-query`, body `{ message, history }`.

Steps:
1. Auth: read JWT from `Authorization` header → resolve `user_id` via Supabase.
2. Plan gate: load user's plan (`user_subscriptions` + trial). If on `free` (no trial), return HTTP 403 `{ reply: "Nev AI is available on Basic and Pro plans. Upgrade to start asking questions.", usage: null }`.
3. Daily quota: new table `nev_ai_usage(user_id, date, count)`. Limits: Basic = 20/day, Pro = 100/day. If exceeded, return HTTP 429 `{ reply: "You've reached today's Nev AI question limit (X/X). It resets tomorrow.", usage: { used, limit } }`.
4. Gather analytics context for the user (last 30 days): funnels (id, title, total_views, total_leads, total_payments), funnel_leads counts grouped by day, top funnel by leads, today/week view counts from `user_daily_views`, conversion rate = leads/views. Trim to compact JSON (token-safe).
5. Call Gemini (`gemini-2.0-flash`) with system prompt: "You are Nev AI, an analytics assistant for the creator. Answer concisely using ONLY the provided JSON stats. If unknown, say so. Format numbers Indian-style.", followed by `history` (last 10 turns) and the new `message`. Inject stats as a system context block.
6. Increment usage, return `{ reply, usage: { used, limit } }`.
7. CORS headers + OPTIONS preflight (match other functions).
8. Register in `supabase/config.toml`.

Migration: create `nev_ai_usage` table with PK `(user_id, date)`, RLS owner-only select, service-role insert/update, plus GRANTs per project convention.

## 2. Frontend route — `src/routes/nev-ai.tsx` + `src/routes/nev-ai.lazy.tsx`

URL: `/nev-ai` (keeps top-level pattern used by other dashboard pages). Lazy route renders `src/pages/NevAIPage.tsx` wrapped in `DashboardLayout`.

## 3. Page — `src/pages/NevAIPage.tsx`

- Header: "Nev AI" with `Sparkles` icon + tagline "Ask anything about your analytics."
- Chat surface (shadcn styling, premium-card):
  - Scrollable message list, auto-scroll to bottom on new message via `useEffect` + ref.
  - User bubbles right-aligned (`bg-primary text-primary-foreground`), assistant bubbles left-aligned with `Sparkles` avatar + "Nev AI" label.
  - Typing indicator (3 animated dots) while request in flight.
  - Empty state: greeting from Nev AI + 4 suggestion chips:
    - "How many views this week?"
    - "Which funnel is performing best?"
    - "How many leads did I get today?"
    - "What's my conversion rate?"
    - Clicking a chip sends it immediately.
- Composer: `Textarea` (Enter to send, Shift+Enter newline) + `Button` Send. Both disabled while loading.
- Subtle footer line under input: `used / limit questions today` when usage data present.
- State: `messages: {role, content}[]`, `input`, `loading`, `usage`.
- Send handler calls `supabase.functions.invoke("nev-ai-query", { body: { message, history: messages } })`.
  - On success → append `{role:'assistant', content: data.reply}`, update `usage`.
  - On error: if `error.context?.body` (or returned `data.reply`) has a reply field (403/429), show that reply as assistant message + update usage if provided.
  - Generic failure → "Something went wrong, please try again."

## 4. Sidebar nav entry — `src/components/layout/DashboardLayout.tsx`

Add `{ icon: Sparkles, label: "Nev AI", path: "/nev-ai" }` in `baseNavItems` after "Dashboard" so it sits with primary nav. No other nav restructuring.

## Technical details

- Files created:
  - `supabase/functions/nev-ai-query/index.ts`
  - `supabase/migrations/<ts>_nev_ai_usage.sql`
  - `src/pages/NevAIPage.tsx`
  - `src/routes/nev-ai.tsx`, `src/routes/nev-ai.lazy.tsx`
- Files edited:
  - `src/components/layout/DashboardLayout.tsx` (sidebar item)
  - `supabase/config.toml` (register function)
- AI provider: Gemini via `GEMINI_API_KEY` (already in secrets). Model: `gemini-2.0-flash`.
- No prices/limits hardcoded in UI beyond default chips; limit text comes from `usage` payload returned by the function.
- Reuses existing `supabase` client and `DashboardLayout`; no new dependencies.

## Out of scope

- Persisting chat history across sessions (kept in component state only, per spec).
- Streaming responses (single round-trip reply for simplicity).
- Admin controls for per-user limit overrides (can be added later via `plan_config`).
