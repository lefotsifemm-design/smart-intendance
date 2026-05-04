# Smart Intendance — Session Handoff
**Date:** 2 May 2026  
**Branch:** main  

---

## What happened this session

### 1. Fixed Budgets page (500 errors)
`/api/budgets` was returning 500 because the `budgets` table didn't exist in Supabase.  
**Fix:** Run `supabase/budgets.sql` in the Supabase SQL editor — confirm it has been run on production.

### 2. Inline category editing on Transactions
Added a pencil icon (appears on row hover) that turns the category badge into a `<select>` dropdown.  
Selecting a new category auto-saves via `PATCH /api/update-transaction`.

New files:
- `src/app/api/update-transaction/route.ts` — PATCH `{ id, category }`, validates ownership

Modified:
- `src/app/dashboard/statements/page.tsx` — `editingCategoryId` / `updatingCategoryId` state, inline select UI

### 3. Strategic pivot: B2C → B2B (full removal)

**Deleted:**
- `src/app/dashboard/analytics/` — subscription analytics page
- `src/app/dashboard/calendar/` — subscription payment calendar
- `src/components/subscription-modal.tsx`
- `src/app/api/parse-csv/` — AI subscription detection

**Rewritten from scratch:**
- `src/app/dashboard/page.tsx` — new B2B Dashboard (see below)
- `src/app/dashboard/upload/page.tsx` — statement-only upload (all subscription logic removed)
- `src/components/sidebar.tsx` — new nav: Dashboard, Upload, Transactions, Cash Flow, Budgets, Settings

### 4. New B2B Dashboard (`/dashboard`)
- Current month P&L: Income / Expenses / Net profit
- Т-Банк connection status banner (connected / expired / not connected) with sync button
- Budget alerts — categories above 80% usage
- Recent 8 transactions for the current month

### 5. Cash Flow Forecast (`/dashboard/cashflow`) — new feature

**API: `GET /api/cashflow?balance=<number>`**
- Fetches last 6 months of transactions from Supabase
- Sends condensed data to GPT-4o → detects recurring patterns (payroll, rent, taxes, regular revenue)
- GPT returns: `{ recurring: RecurringItem[] }` — name, type, amount, dayOfMonth, frequency, confidence
- Server generates a 30-day daily balance projection from those patterns (code only, no extra AI calls)
- Returns: `{ recurring, forecast: DayForecast[] }`

**Page: `src/app/dashboard/cashflow/page.tsx`**
- Balance input → "Build forecast" button (triggers analysis)
- 3 summary cards: gap status (when / safe), lowest balance point, projected balance in 30 days
- Recharts AreaChart: balance curve, red dashed line at y=0, red fill in negative zones
- "Upcoming cash events" list — days with predicted transactions + running balance after each
- "Detected patterns" (collapsible) — AI-found recurring items with confidence badges
- Warning shown if fewer than 5 transactions in history

---

## Current file structure (key paths)

```
src/
  app/
    api/
      budgets/route.ts              GET / POST / DELETE
      cashflow/route.ts             GET — AI pattern detection + forecast  ← NEW
      update-transaction/route.ts   PATCH category                         ← NEW
      parse-statement/route.ts      POST — GPT-4o parse bank statement
      save-transactions/route.ts    POST — bulk insert
      delete-transaction/route.ts   DELETE single
      delete-all-transactions/      DELETE all for user
      tbank/
        auth/       start OAuth
        callback/   handle redirect
        status/     connection info
        sync/       pull new transactions
        disconnect/ remove token
      auth/
        magic-link/    POST — send email via Resend
        [...nextauth]/ NextAuth handler
    dashboard/
      page.tsx            B2B Dashboard                    ← REWRITTEN
      upload/page.tsx     Statement-only upload            ← REWRITTEN
      statements/page.tsx Transactions + analytics (+ category edit)
      cashflow/page.tsx   Cash flow forecast               ← NEW
      budgets/page.tsx    Budget limits
      settings/page.tsx   Profile, currency, T-Bank, delete account
    auth/
      signin/   server wrapper + client form
      verify/   magic link verification
  components/
    sidebar.tsx   ← REWRITTEN (5 nav items, no more Analytics/Calendar)
  lib/
    supabase.ts
    tbank.ts
    constants.ts      CATEGORIES list
    health-score.ts
  auth.ts             NextAuth — Google OAuth + Magic Link Credentials
supabase/
  transactions.sql
  budgets.sql             ⚠️ must be run in Supabase SQL editor
  tbank_connections.sql   ⚠️ must be run in Supabase SQL editor
  magic_links.sql
  soft_delete.sql
```

---

## Before next deploy — checklist

| # | Task | Status |
|---|---|---|
| 1 | Run `supabase/budgets.sql` in Supabase SQL editor | ⚠️ confirm done |
| 2 | Run `supabase/tbank_connections.sql` in Supabase SQL editor | ⚠️ confirm done |
| 3 | Drop `subscriptions` table from Supabase (all UI code removed) | optional cleanup |
| 4 | Verify `AUTH_GOOGLE_ID` vs `GOOGLE_CLIENT_ID` naming in `src/auth.ts` matches `.env.local` | check |

---

## Next feature candidates

### 1. Manual recurring items editor (Cash Flow)
Let the user add/override AI-detected patterns.  
New table: `recurring_items` (user_id, name, type, amount, dayOfMonth, frequency, active).  
New API: GET/POST/PATCH/DELETE `/api/recurring-items`.  
UI: "Manage patterns" section on `/dashboard/cashflow` — editable list, add button.

### 2. Cash Flow export
Button to download the 30-day forecast as Excel.  
Use `xlsx` package (already installed).

### 3. Multi-account / projects
Add `company_id` to transactions, budgets, tbank_connections.  
Account switcher in the dashboard header.

### 4. Telegram bot
Daily P&L summary + budget alerts → Telegram.  
Store `telegram_chat_id` in user settings.

### 5. T-Bank registration & go-live
Once ЮЛ/ИП registered:
- Register app in T-Bank Developer Portal
- Set env vars: `TBANK_CLIENT_ID`, `TBANK_CLIENT_SECRET`, `TBANK_REDIRECT_URI`
- Run `supabase/tbank_connections.sql`

### 6. Pricing + billing gates
`isPro` flag, upgrade modals, ЮКасса / Stripe.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js App Router |
| UI | React 19, Tailwind CSS 4, Lucide, Sonner |
| Charts | Recharts 3 |
| Auth | NextAuth 5 — Google OAuth + Magic Link |
| Database | Supabase (Postgres + RLS, service role key in API routes) |
| AI | OpenAI `gpt-4o` (parsing, forecasting), `gpt-4o-mini` (T-Bank categorization) |
| Email | Resend |
| File parsing | xlsx, pdfjs-dist |
| Deploy | Vercel — smart-intendance.ru |

## Required env vars

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
NEXTAUTH_URL=https://smart-intendance.ru
NEXTAUTH_SECRET
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
RESEND_API_KEY
TBANK_CLIENT_ID          # pending registration
TBANK_CLIENT_SECRET      # pending registration
TBANK_REDIRECT_URI       # pending registration
```
