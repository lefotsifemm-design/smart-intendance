# Smart Intendance — Session Handoff

> Last updated: 2026-04-30

## What is this project

**Smart Intendance** — SaaS subscription tracker with AI-powered bank statement parsing and full business P&L analytics.  
Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS 4 · Supabase · NextAuth 5 · OpenAI GPT-4o · Recharts 3 · xlsx

---

## Current state — all routes

| Route | Status | Notes |
|---|---|---|
| `/` | ✅ Landing page | |
| `/auth/signin` | ✅ Google OAuth | NextAuth 5 JWT |
| `/dashboard` | ✅ Full | Subscriptions list, stats, search/filter, Quick Add, Edit, soft-delete, Recycle Bin, CSV export |
| `/dashboard/upload` | ✅ Full | Mode toggle: Subscriptions / Full Statement. Accepts CSV + Excel (.xlsx/.xls). AI parsing with preview modal |
| `/dashboard/analytics` | ✅ Full | Pie (drill-down on click), bar chart, frequency breakdown, ranked table |
| `/dashboard/statements` | ✅ Full | P&L summary, monthly cash flow line chart, expense pie + bars, transaction table with search/filter |
| `/dashboard/settings` | ✅ Full | Google profile, currency selector, sign out, delete account |
| `/api/parse-csv` | ✅ | CSV/Excel → GPT-4o → subscriptions with confidence scores |
| `/api/parse-statement` | ✅ | CSV/Excel → GPT-4o → all transactions classified (income/expense, business categories) |
| `/api/auth/[...nextauth]` | ✅ | Google OAuth handler |

---

## Key architecture

- **Auth**: NextAuth 5 JWT. `session.user.id = token.sub` (Google stable ID). `src/auth.ts` + `src/types/next-auth.d.ts`
- **DB isolation**: All queries filter `.eq('user_id', session.user.id)`
- **Middleware**: `src/proxy.ts` — protects `/dashboard/*`
- **Currency**: `src/hooks/use-currency.ts` — `useCurrency()` hook, persists to localStorage. Used in Dashboard, Analytics, Statements
- **Categories (subscriptions)**: `src/lib/constants.ts` — `CATEGORIES` array
- **Components**: `src/components/subscription-modal.tsx`, `src/components/sidebar.tsx`, `src/components/user-menu.tsx`

---

## Supabase tables

### `subscriptions`
```sql
id          uuid primary key default gen_random_uuid()
user_id     text not null           -- NextAuth token.sub
name        text not null
amount      numeric not null
frequency   text not null           -- 'monthly' | 'annual'
category    text
merchant    text
last_charge date
source      text                    -- 'manual' | 'csv'
confidence  integer                 -- 0-100
created_at  timestamptz default now()
updated_at  timestamptz
deleted_at  timestamptz             -- NULL = active, set = soft-deleted (Recycle Bin)
```

### `transactions`
```sql
id           uuid primary key default gen_random_uuid()
user_id      text not null
type         text not null check (type in ('income', 'expense'))
category     text
amount       numeric not null
date         date
description  text
counterparty text
source       text default 'csv'
created_at   timestamptz default now()
```
> RLS enabled on both tables. Policy: `user_id = auth.uid()::text`

### SQL migrations (run if setting up fresh)
- `supabase/transactions.sql` — creates `transactions` table + RLS
- `supabase/soft_delete.sql` — adds `deleted_at` column to `subscriptions`

---

## Features built (complete list)

### Dashboard (`/dashboard/page.tsx`)
- **P1** Currency symbol everywhere via `useCurrency()` — no more hardcoded `$`
- **P2** Next billing date computed client-side from `last_charge` (or `created_at` fallback), advances to next future date. Red highlight if ≤ 7 days
- **P3** Inline delete confirm: Trash icon → "Delete / Cancel" pills
- **P4** Search by name + filter by category + filter by frequency. "Clear" appears only when active. "No matches" state with clear link
- **P5** Onboarding empty state: two dashed cards — Quick Add (blue) and Upload CSV (gray)
- **P6** Duplicate detection on add — toast warning (non-blocking)
- **P7** Potential Savings card — computes real savings from duplicate-category subs (cheapest kept, rest = savings)
- **P9** CSV export button — exports all subscriptions with Next Billing column, filename `subscriptions-YYYY-MM-DD.csv`
- **P10** "Added X ago" timestamp on each subscription row (`timeAgo` helper)
- **Recycle Bin** — soft delete sets `deleted_at`, collapsible Trash section with count badge, Restore + Delete forever (with confirm)

### Analytics (`/dashboard/analytics/page.tsx`)
- **P8** Drill-down: click pie slice → filters ranked table to that category. Non-selected slices fade to 25% opacity. Active filter pill with `×` to clear

### Upload (`/dashboard/upload/page.tsx`)
- **Mode toggle** — "Subscriptions / Full Statement" pill switcher in header
- **Excel import** — `.xlsx` / `.xls` accepted, converted to CSV via `xlsx` package before AI call
- **Statement mode** — CSV → `/api/parse-statement` → preview with income/expense badges → save to `transactions` table → redirect to `/dashboard/statements`
- Manual Entry tab hidden in Statement mode

### Statements (`/dashboard/statements/page.tsx`)
- P&L cards: Total Income (green), Total Expenses (red), Net (blue/orange), Count
- Monthly cash flow LineChart (3 lines: income / expenses / net)
- Expense breakdown donut PieChart + horizontal category bars (top 6)
- Transaction table: search by description/counterparty/category, type filter (all/income/expense), scrollable

### API
- `/api/parse-statement` — GPT-4o prompt classifies ALL transactions, business categories: Payroll, Revenue, Rent, Utilities, Marketing, IT & Software, Logistics, Taxes, Insurance, Legal, Bank Fees, Refunds, Other

### Sidebar
- Links: Overview, Upload, Analytics, **Statements** (new), Settings

---

## Next pipeline (ordered by priority)

### 🟠 High
**Budget / planned operations**
- New table `budgets`: `category, amount, period (monthly|annual), user_id`
- Dashboard card: budget vs actual per category
- Simple form to set budget per category

**Business health score card**
- Rule-based score from existing data: expense growth rate, income/expense ratio, largest single expense %
- Show on Statements page as a single "Health" widget

### 🟡 Medium
**Telegram bot for daily reports**
- `telegraf` npm package or webhook to Telegram Bot API
- Daily cron: fetch user's subscriptions/transactions → send summary
- Requires storing Telegram `chat_id` per user in Supabase

**Multi-account / projects**
- New `projects` table: `id, user_id, name, color`
- `transactions.project_id` FK
- Filter statements by project

**Statement period selector**
- Date range picker on Statements page (last 30 / 90 / 365 / custom)
- Currently shows all transactions ever uploaded

### 🔵 Strategic
**Bank API integrations**
- Russian banks (Tinkoff, Sberbank) via Open Banking — requires ЦБ РФ partner status
- Alternative: Zenmoney export → already supported via CSV

---

## Known tech debt

- `error: any` in `src/app/api/parse-csv/route.ts:146`
- `setTimeout` for redirect in `upload/page.tsx` — should use `router.push` directly
- No rate limiting on `/api/parse-csv` and `/api/parse-statement` — one user can exhaust OpenAI quota
- Supabase RLS for `subscriptions` uses `user_id = auth.uid()::text` — works because NextAuth stores Google ID as text; verify if Supabase Auth is ever enabled
- `loadTrashed` called in `useEffect` on mount even when Trash is collapsed — minor, fetches once
- Excel preview (first 500 chars) shows raw CSV after conversion, not original Excel — cosmetic

---

## How to run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

`.env.local` required:
```
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
```
