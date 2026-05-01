# Smart Intendance — Project Handoff

> Last updated: 2026-05-01

## Stack

Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS 4 · Supabase · NextAuth 5 · OpenAI GPT-4o · Recharts 3 · Lucide · Sonner · xlsx · pdfjs-dist · Resend

---

## Live routes

| Route | Status | Notes |
|---|---|---|
| `/` | ✅ | Landing page |
| `/auth/signin` | ✅ | Google OAuth + Yandex OAuth + Magic Link (email) |
| `/dashboard` | ✅ | Subscriptions, stats, Health Score, Budget Summary, onboarding wizard |
| `/dashboard/upload` | ✅ | CSV + Excel + PDF, AI parsing |
| `/dashboard/analytics` | ✅ | Pie (drill-down), bar chart, frequency, ranked table |
| `/dashboard/statements` | ✅ | P&L + date range picker + 8 analytics sections |
| `/dashboard/budgets` | ✅ | Plan vs fact, per-category progress bars |
| `/dashboard/settings` | ✅ | Profile, currency, sign out, delete account, T-Bank section |
| `/api/tbank/*` | ⚠️ | Scaffolded — ждёт credentials (см. ниже) |

---

## Auth

- Google OAuth — `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
- Yandex OAuth — `AUTH_YANDEX_ID` / `AUTH_YANDEX_SECRET`
- Magic Link (email через Resend) — `RESEND_API_KEY`
- Таблица `magic_links` в Supabase уже создана

---

## Supabase tables

| Таблица | Статус | Файл |
|---|---|---|
| `subscriptions` | ✅ | — |
| `transactions` | ✅ | — |
| `budgets` | ✅ | `supabase/budgets.sql` |
| `magic_links` | ✅ | `supabase/magic_links.sql` |
| `tbank_connections` | ⚠️ SQL не запущен | `supabase/tbank_connections.sql` |

---

## T-Банк Business API — Pending

Код полностью готов (`src/lib/tbank.ts`, `src/app/api/tbank/*`). Нужно только зарегистрировать OAuth-приложение и передать credentials.

### Что сделать

1. Войти на [business.tinkoff.ru](https://business.tinkoff.ru) под аккаунтом с доступом к расчётному счёту ООО/ИП
2. Перейти в **Интеграции → API** (или [business.tinkoff.ru/openapi](https://business.tinkoff.ru/openapi))
3. Создать приложение:

| Поле | Значение |
|---|---|
| Название | Smart Intendance |
| Redirect URI | `https://smart-intendance.ru/api/tbank/callback` |
| Scope | `opensme/inn/*/bank-accounts/*/transactions.readonly` |

4. Передать владельцу (lefotsifemm@gmail.com):
   - `TBANK_CLIENT_ID`
   - `TBANK_CLIENT_SECRET`

5. Владелец добавит в Vercel и запустит `supabase/tbank_connections.sql`

---

## Env vars (Vercel Production)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
NEXTAUTH_URL=https://smart-intendance.ru
NEXTAUTH_SECRET
AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
AUTH_YANDEX_ID / AUTH_YANDEX_SECRET
RESEND_API_KEY
TBANK_CLIENT_ID          ← pending
TBANK_CLIENT_SECRET      ← pending
TBANK_REDIRECT_URI=https://smart-intendance.ru/api/tbank/callback  ← pending
```

---

## Pipeline

### 🔴 Blocked (нужна регистрация ЮЛ/ИП)
- T-Bank Business API (credentials)
- Платёжная система (ЮКасса / Stripe)
- Auto-sync cron для T-Bank

### 🟡 Next (Phase 3 — Engagement)
- Telegram bot — daily summary, budget alerts
- PWA — manifest, service worker
- Email digest (weekly) via Resend

### 🔵 Phase 4 — Pre-Monetization
- Pricing page + waitlist
- Billing gates (isPro checks, upgrade modals)
- Multi-account / projects

---

## Local setup

```bash
npm install
npm run dev   # http://localhost:3000
```

`.env.local` — скопировать значения из Vercel.
