# Smart Intendance — Session Handoff

> Last updated: 2026-04-29

## What is this project

**Smart Intendance** — SaaS subscription tracker with AI-powered bank statement parsing.
Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS 4 · Supabase · NextAuth 5 · OpenAI GPT-4o · Recharts 3

## Current state (what's fully working)

| Route | Status |
|---|---|
| `/` | Landing page |
| `/auth/signin` | Google OAuth login |
| `/dashboard` | Subscription list, stats (total/monthly/annual), Quick Add modal, Edit modal, Delete |
| `/dashboard/upload` | Manual entry + CSV upload → GPT-4o parsing → preview → bulk save |
| `/dashboard/analytics` | Pie chart (by category), Bar chart (top 8 by cost), frequency breakdown, ranked table |
| `/dashboard/settings` | Google profile, currency selector (localStorage), sign out, delete account |
| `/api/parse-csv` | POST endpoint: CSV → GPT-4o → JSON subscriptions with confidence scores |
| `/api/auth/[...nextauth]` | NextAuth Google OAuth handler |

## Key architecture decisions

- **Auth**: NextAuth 5 JWT strategy. `session.user.id = token.sub` (Google's stable user ID). Configured in `src/auth.ts`, extended in `src/types/next-auth.d.ts`.
- **DB isolation**: All Supabase queries filter by `.eq('user_id', session.user.id)`. Table: `subscriptions`.
- **Middleware**: `src/proxy.ts` — protects `/dashboard/*`, redirects unauthenticated → `/auth/signin`.
- **Shared components**: `src/components/subscription-modal.tsx` (Add/Edit modal), `src/components/sidebar.tsx` (mobile-responsive with hamburger drawer + desktop static sidebar), `src/components/user-menu.tsx`.
- **Shared constants**: `src/lib/constants.ts` (CATEGORIES array), `src/hooks/use-currency.ts` (localStorage currency preference).

## Supabase `subscriptions` table schema

```sql
id          uuid primary key default gen_random_uuid()
user_id     text not null           -- NextAuth token.sub (Google ID)
name        text not null
amount      numeric not null
frequency   text not null           -- 'monthly' | 'annual'
category    text
merchant    text                    -- from CSV parsing
last_charge date                    -- from CSV parsing
source      text                    -- 'manual' | 'csv'
confidence  integer                 -- 0-100, from AI
created_at  timestamptz default now()
updated_at  timestamptz
```

## Pipeline — ordered by priority

### 🔴 Critical (breaks UX or data correctness)

**P1 — Wire up currency symbol**
- `useCurrency()` hook exists in `src/hooks/use-currency.ts` and is saved to localStorage
- But Dashboard and Analytics still hardcode `$`
- Fix: import `useCurrency` in `dashboard/page.tsx` and `dashboard/analytics/page.tsx`, replace `$` with `symbol`

**P2 — Next billing date**
- Add computed field: if `last_charge` exists → `next_billing = last_charge + 1 month/year`
- Fallback: if no `last_charge` → use `created_at`
- Show on Dashboard subscription row (e.g. "Next: May 15")
- Highlight in red if within 7 days
- No DB schema change needed — compute client-side

**P3 — Delete confirmation**
- Dashboard delete button fires immediately with no confirm dialog
- Add a small inline confirm (e.g. "Are you sure? Yes / Cancel") or use the existing modal pattern

### 🟠 High priority (noticeably missing features)

**P4 — Search + filter on Dashboard**
- Search input filtering by name
- Filter dropdown: by category, by frequency (monthly/annual)
- Client-side filtering on the `subscriptions` array (no extra DB calls)

**P5 — Onboarding empty state**
- First-time user sees empty dashboard with no guidance
- Empty state should explain the 2 ways to add: Quick Add or CSV Upload
- Could add a simple 3-step explainer banner that dismisses after first subscription is added

**P6 — Duplicate detection**
- On insert, check if a subscription with the same `name` (case-insensitive) already exists for this user
- Show a warning toast, not a hard block (user may have two Netflix accounts)

**P7 — Potential Savings card (currently hardcoded $0.00)**
- Option A: show savings if same category has cheaper alternatives (requires static pricing data)
- Option B (simpler): detect duplicates — "You have 2 Cloud Storage subs, could save $X by consolidating"
- Option B is doable without external data

### 🟡 Medium priority (increase retention)

**P8 — Analytics drill-down**
- Click a pie chart slice → filter the subscription table to that category
- Currently analytics and list are disconnected

**P9 — Export**
- "Download CSV" button on Dashboard that exports current subscriptions
- Client-side: `Blob` → download, no API needed

**P10 — Last updated / price history hint**
- Show `created_at` or `updated_at` on subscription row (small text)
- "Added 3 days ago" helps user audit what was imported

### 🔵 Strategic expansion (new product surface)

**P11 — Full business financial analytics mode**

User request: upload a full company bank statement → get P&L, cash flow, expense breakdown by category.

This is a mode switch, not a replacement. Implementation plan:

1. **Upload page toggle**: "Mode: Subscriptions / Full Statement"
2. **New API route**: `POST /api/parse-statement` — same CSV input but different GPT-4o prompt:
   - Classify ALL transactions (not just subscriptions)
   - Output: `{ type: 'income'|'expense', category, amount, date, description, counterparty }`
   - Business categories: Payroll, Rent, Taxes, Marketing, IT & Software, Logistics, Bank Fees, Revenue, Refunds, etc.
3. **New DB table**: `transactions` with `type`, `category`, `amount`, `date`, `description`, `counterparty`, `user_id`
4. **New page**: `/dashboard/statements` with:
   - P&L summary (total income vs total expenses, net)
   - Monthly cash flow line chart
   - Expense breakdown pie chart (business categories)
   - Income breakdown
   - Filterable transaction table with search

Dependencies: new Supabase table, new API route, new page, new category set.

## Files changed in this session

```
NEW   src/lib/constants.ts
NEW   src/components/subscription-modal.tsx
NEW   src/components/sidebar.tsx
NEW   src/hooks/use-currency.ts
NEW   src/app/dashboard/analytics/page.tsx
NEW   src/app/dashboard/settings/page.tsx
MOD   src/app/dashboard/page.tsx        (modal refactor, user_id fix, data isolation fix)
MOD   src/app/dashboard/upload/page.tsx (types, user_id fix)
MOD   src/app/dashboard/layout.tsx      (Sidebar component, all nav links)
```

## How to run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

Required env vars in `.env.local`:
```
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
```

## Known issues / tech debt

- `any` type still in `src/app/api/parse-csv/route.ts` line 146 (`error: any`)
- `setTimeout` used in `upload/page.tsx` for redirect after save (line 192, 255) — could use `router.push` directly
- No rate limiting on `/api/parse-csv` — one user could exhaust OpenAI quota
- Supabase RLS policies should be verified to match `user_id = auth.uid()` — not audited in this session
- Annual subscriptions show `$X` not `$X/yr` on Dashboard list (Analytics shows it correctly)
