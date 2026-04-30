# Smart Intendance — Session Handoff

> Last updated: 2026-04-30 (Phase 1–2 complete)

## What is this project

**Smart Intendance** — financial analytics SaaS for individuals and small businesses. Upload bank statements in any format — AI categorizes every transaction, generates P&L reports, budget tracking, and health scores.

Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS 4 · Supabase · NextAuth 5 · OpenAI GPT-4o · Recharts 3 · xlsx · pdfjs-dist

---

## Current state — all routes

| Route | Status | Notes |
|---|---|---|
| `/` | ✅ | Full landing page: hero, features, how-it-works, CTA |
| `/auth/signin` | ✅ | Google OAuth — NextAuth 5 JWT |
| `/dashboard` | ✅ | Subscriptions + stats + Health Score card + Budget Summary card. Shows onboarding wizard for new users |
| `/dashboard/upload` | ✅ | Mode toggle: Subscriptions / Full Statement. CSV + Excel + PDF. AI parsing with preview |
| `/dashboard/analytics` | ✅ | Pie (drill-down), bar chart, frequency breakdown, ranked table |
| `/dashboard/statements` | ✅ | P&L, date range picker (presets + custom), 8 analytics sections, transaction table |
| `/dashboard/budgets` | ✅ | **NEW** — Set monthly limits per category, progress bars, over-budget alerts |
| `/dashboard/settings` | ✅ | Google profile, currency selector, sign out, delete account, T-Bank section |
| `/api/budgets` | ✅ | **NEW** — GET/POST/DELETE for budgets (upsert by user_id+category) |
| `/api/demo-data` | ✅ | **NEW** — Loads 50 demo transactions (source='demo') for onboarding |
| `/api/parse-csv` | ✅ | CSV/Excel → GPT-4o → subscriptions. **Now auth + rate-limited** |
| `/api/parse-statement` | ✅ | CSV/Excel/PDF → GPT-4o → transactions. **Now auth + rate-limited** |
| `/api/save-transactions` | ✅ | Server-side insert using service role key |
| `/api/delete-transaction` | ✅ | Server-side delete using service role key |
| `/api/delete-all-transactions` | ✅ | Bulk delete for "Clear All" |
| `/api/tbank/*` | ⚠️ | Scaffolded, not live — needs ЮЛ registration + API keys |
| `/api/auth/[...nextauth]` | ✅ | Google OAuth handler |

---

## What was built in this session (Phases 1–2)

### Phase 1: Foundation & First Impression
1. **Onboarding wizard** (`src/components/onboarding.tsx`)
   - 2-step flow: currency picker → upload statement OR load demo data
   - Shows automatically for users with 0 subscriptions + 0 transactions
   - Integrated into `/dashboard` page

2. **Demo data** (`src/lib/demo-data.ts`, `src/app/api/demo-data/route.ts`)
   - 50 realistic Russian transactions across 2 months
   - Categories: salary, freelance, food, transport, subscriptions, fitness, etc.
   - Source field = 'demo' for easy cleanup later

3. **Landing page redesign** (`src/app/page.tsx`)
   - Hero with gradient + tagline
   - 3 feature cards (AI categorization, deep analytics, budget tracking)
   - "How it works" 3-step section
   - Bottom CTA section with gradient bg
   - Header + footer

4. **Rate limiting** (`src/lib/rate-limit.ts`)
   - In-memory, per user_id, 10 requests/hour
   - Applied to `/api/parse-statement` and `/api/parse-csv`
   - Returns 429 with reset time

### Phase 2: Core Value Features
5. **Budgeting — plan vs fact**
   - SQL: `supabase/budgets.sql` — `budgets` table with UNIQUE(user_id, category)
   - API: `src/app/api/budgets/route.ts` — GET, POST (upsert), DELETE
   - Page: `src/app/dashboard/budgets/page.tsx` — add/remove budgets, per-category progress bars, total usage bar
   - Dashboard card: budget summary (spent/total, % used, over-count) linking to /budgets
   - Sidebar + header nav updated

6. **Business Health Score** (`src/lib/health-score.ts`)
   - 4 factors, 100 points total:
     - Savings Rate (0–30): based on (income - expense) / income
     - Income/Expense Ratio (0–25): penalizes when expenses > income
     - Diversification (0–20): penalizes single-category concentration > 40%
     - Monthly Trend (0–25): rewards decreasing expenses + growing income
   - Grade: A (85+), B (70+), C (55+), D (40+), F (<40)
   - Each factor has a tip/recommendation string
   - Dashboard card: score, breakdown bars, tips

7. **Date Range Picker** (replaced old 30d/90d/180d on Statements)
   - Presets: All, This month, Last month, 3 months, 6 months
   - Custom: from/to `<input type="date">` fields
   - All charts and tables react to selected range

---

## Key architecture

- **Auth**: NextAuth 5 JWT. `session.user.id = token.sub` (Google stable ID). `src/auth.ts`
- **DB writes (transactions/budgets)**: API routes with `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS
- **DB reads**: Client-side via anon key + `.eq('user_id', session.user.id)`
- **Rate limiting**: In-memory Map per user_id, 10 req/hr on AI endpoints
- **Currency**: `src/hooks/use-currency.ts` — persists to localStorage
- **Health Score**: Pure function in `src/lib/health-score.ts` — computed client-side from transactions array

---

## Supabase tables

### `subscriptions`
```
id, user_id, name, amount, frequency, category, merchant, last_charge, source, confidence, created_at, updated_at, deleted_at
```

### `transactions`
```
id, user_id, type ('income'|'expense'), category, amount, date, description, counterparty, source ('csv'|'pdf'|'demo'|'tbank'), created_at
```
RLS enabled. Server routes use service role key for writes.

### `budgets` ⚠️ SQL NOT YET RUN
```
id, user_id, category (UNIQUE with user_id), amount, period ('monthly'|'annual'), created_at, updated_at
```
Migration file: `supabase/budgets.sql`

### `tbank_connections` ⚠️ SQL NOT YET RUN
```
id, user_id (UNIQUE), access_token, refresh_token, expires_at, account_number, company_name, inn, connected_at, last_sync_at, created_at
```
Migration file: `supabase/tbank_connections.sql`

---

## Pipeline — next priorities

### 🔴 Blocked until ЮЛ/ИП registration
1. Payment processing (ЮКасса/Stripe)
2. T-Bank Business API
3. Auto-sync cron

### 🟡 Phase 3: Engagement (no ЮЛ needed)
4. Telegram bot — daily summary, budget alerts (`telegraf`)
5. PWA — manifest.json, service worker, installable
6. Email digest (weekly) via Resend

### 🔵 Phase 4: Pre-Monetization
7. Multi-account / projects
8. Pricing page + waitlist (email collection, no payment)
9. Billing gates (isPro checks, upgrade modals, no payment provider)

### 🔧 Phase 5: Technical Hardening
10. Test suite (Vitest + Playwright)
11. Tech debt cleanup
12. Security audit (CSP, CSRF, input sanitization)

---

## Known tech debt

- `error: any` in `src/app/api/parse-csv/route.ts`
- `setTimeout` for redirect in `upload/page.tsx` — should use `router.push`
- `loadTrashed` called on mount even when Trash collapsed
- Excel preview shows raw CSV text (cosmetic)
- Subscriptions still use client-side Supabase for writes — should migrate to API route
- Rate limiter is in-memory — resets on server restart (fine for now, Redis later)
- No test suite yet

---

## How to run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

`.env.local` required:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Pending SQL migrations (run in Supabase SQL Editor)
1. `supabase/budgets.sql` — budgets table
2. `supabase/tbank_connections.sql` — T-Bank connections (when ready)
