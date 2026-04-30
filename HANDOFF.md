# Smart Intendance — Session Handoff

> Last updated: 2026-04-30

## What is this project

**Smart Intendance** — SaaS subscription tracker with AI-powered bank statement parsing and full business P&L analytics.  
Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS 4 · Supabase · NextAuth 5 · OpenAI GPT-4o · Recharts 3 · xlsx · pdfjs-dist

---

## Current state — all routes

| Route | Status | Notes |
|---|---|---|
| `/` | ✅ | Landing page |
| `/auth/signin` | ✅ | Google OAuth — NextAuth 5 JWT |
| `/dashboard` | ✅ | Subscriptions list, stats, search/filter, Quick Add, Edit, soft-delete, Recycle Bin, CSV export |
| `/dashboard/upload` | ✅ | Mode toggle: Subscriptions / Full Statement. Accepts CSV + Excel + **PDF**. AI parsing with preview modal |
| `/dashboard/analytics` | ✅ | Pie (drill-down), bar chart, frequency breakdown, ranked table |
| `/dashboard/statements` | ✅ | P&L summary, period filter, monthly bar chart, income/expense category tabs, transaction table with delete |
| `/dashboard/settings` | ✅ | Google profile, currency selector, sign out, delete account |
| `/api/parse-csv` | ✅ | CSV/Excel → GPT-4o → subscriptions with confidence scores |
| `/api/parse-statement` | ✅ | CSV / Excel / **PDF text** → GPT-4o → all transactions classified. Handles Russian bank format |
| `/api/save-transactions` | ✅ | Server-side insert to `transactions` using service role key (bypasses RLS) |
| `/api/delete-transaction` | ✅ | Server-side delete from `transactions` using service role key |
| `/api/auth/[...nextauth]` | ✅ | Google OAuth handler |

---

## Key architecture

- **Auth**: NextAuth 5 JWT. `session.user.id = token.sub` (Google stable ID). `src/auth.ts`
- **DB writes (transactions)**: Done via API routes (`/api/save-transactions`, `/api/delete-transaction`) using `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS. Required because NextAuth sessions ≠ Supabase auth sessions, so client-side anon key gets 401 on INSERT.
- **DB reads (transactions)**: Still done client-side via anon key + `.eq('user_id', session.user.id)`. Works because SELECT RLS policy allows anon reads when user_id matches.
- **DB writes (subscriptions)**: Still direct client-side Supabase — subscriptions table has a more permissive INSERT policy.
- **Middleware**: `src/proxy.ts` — protects `/dashboard/*`
- **Currency**: `src/hooks/use-currency.ts` — `useCurrency()` hook, persists to localStorage
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
source       text default 'csv'     -- 'csv' | 'pdf'
created_at   timestamptz default now()
```
> RLS enabled. Policy: `user_id = auth.uid()::text`. Server-side routes use service role key to bypass for writes.

### SQL migrations (run if setting up fresh)
- `supabase/transactions.sql` — creates `transactions` table + RLS
- `supabase/soft_delete.sql` — adds `deleted_at` to `subscriptions`

---

## PDF support (new)

### How it works
1. User selects `.pdf` file in Upload → Full Statement tab
2. Client-side `pdfToText()` (pdfjs-dist 5.x) extracts text page by page, groups items by Y-coordinate to reconstruct table rows
3. Extracted text sent to `/api/parse-statement` as `csvContent` (same field, same route)
4. GPT-4o classifies transactions — prompt now includes Russian bank format hints (Т-Банк, Сбербанк, etc.)

### Known PDF quirks
- `Math.sumPrecise` polyfill needed for pdfjs-dist 5.x in older browsers (already in `pdfToText()`)
- Worker URL: `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` — works with Next.js webpack
- Large PDFs (200+ transactions) may need all 16000 output tokens; JSON salvage fallback handles truncation

### Russian bank statement format handled
- Amounts: `-1 000.00 ₽` / `+2 500,00 ₽` (space as thousands sep, ₽ symbol)
- Dates: `DD.MM.YYYY` → converted to `YYYY-MM-DD`
- Operations mapped: Оплата в → expense, Пополнение → income, Внутрибанковский перевод с → income, Внешний перевод по номеру телефона → expense, Инвесткопилка → Transfer Out expense, Кэшбэк → Cashback income

---

## Features built (complete list)

### Dashboard (`/dashboard/page.tsx`)
- Currency symbol everywhere via `useCurrency()`
- Next billing date computed from `last_charge` (or `created_at`), advances to next future date. Red if ≤ 7 days
- Inline delete confirm: Trash → "Delete / Cancel" pills
- Search by name + filter by category + filter by frequency
- Onboarding empty state: Quick Add + Upload CSV cards
- Duplicate detection on add — toast warning
- Potential Savings card — real savings from duplicate-category subs
- CSV export button — `subscriptions-YYYY-MM-DD.csv`
- "Added X ago" timestamp per row
- Recycle Bin — soft delete, Restore + Delete forever

### Analytics (`/dashboard/analytics/page.tsx`)
- Drill-down: click pie slice → filters ranked table. Non-selected slices fade. Active filter pill

### Upload (`/dashboard/upload/page.tsx`)
- Mode toggle: Subscriptions / Full Statement
- Accepts CSV, Excel (.xlsx/.xls), **PDF**
- PDF: client-side text extraction via pdfjs-dist, no server round-trip for extraction
- Statement mode → `/api/parse-statement` → preview (income/expense badges) → `/api/save-transactions` → redirect to Statements
- `max_tokens: 16000` + JSON salvage for large PDFs

### Statements (`/dashboard/statements/page.tsx`)
- Period filter: All time / 30d / 90d / 180d
- Summary cards: Income, Expenses, Net, Count
- Monthly bar chart (income vs expenses per month)
- Category breakdown with **Income / Expense tab toggle** — pie chart + ranked bars with % share
- Transaction table: search, type filter (all/income/expense), date in ru-RU locale, hover-to-delete button

### API routes
- `/api/parse-statement` — prompt handles Russian + English bank statements, `max_tokens: 16000`, JSON salvage on truncation
- `/api/save-transactions` — uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS; validates session server-side
- `/api/delete-transaction` — same pattern; scoped to `user_id` for safety

---

## Next pipeline (ordered by priority)

### 🟠 High
**Budget / planned operations**
- New table `budgets`: `category, amount, period (monthly|annual), user_id`
- Dashboard card: budget vs actual per category
- Simple form to set budget per category

**Business health score card**
- Rule-based score from existing data: expense growth rate, income/expense ratio, largest single expense %
- Show on Statements page as a "Health" widget

### 🟡 Medium
**Telegram bot for daily reports**
- `telegraf` npm package
- Daily cron: fetch user's subscriptions/transactions → send summary
- Requires storing Telegram `chat_id` per user in Supabase

**Multi-account / projects**
- New `projects` table: `id, user_id, name, color`
- `transactions.project_id` FK
- Filter statements by project

### 🔵 Strategic
**Bank API integrations**
- Russian banks (Т-Банк, Sberbank) via Open Banking
- Alternative: Zenmoney export → already supported via CSV/PDF

---

## Known tech debt

- `error: any` in `src/app/api/parse-csv/route.ts`
- `setTimeout` for redirect in `upload/page.tsx` — should use `router.push` directly
- No rate limiting on `/api/parse-csv` and `/api/parse-statement` — one user can exhaust OpenAI quota
- Subscriptions still use client-side Supabase for writes — inconsistent with transactions pattern. Should migrate to API route with service role key
- `loadTrashed` called on mount even when Trash is collapsed — minor
- Excel preview shows raw CSV after conversion, not original Excel — cosmetic

---

## How to run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

`.env.local` required:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...          # sb_publishable_... (new Supabase format)
SUPABASE_SERVICE_ROLE_KEY=...             # sb_secret_... — required for transaction writes
OPENAI_API_KEY=...
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

> `SUPABASE_SERVICE_ROLE_KEY` — find in Supabase Dashboard → Settings → API → service_role secret.  
> Without it, saving transactions will fail with 401 (RLS blocks anon key inserts).
