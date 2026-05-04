# Smart Intendance — Session Handoff
**Date:** 4 May 2026  
**Branch:** main  

---

## Что сделано в этой сессии

### T-Bank интеграция переписана с OAuth на статический токен

**Старая архитектура (OAuth):** CLIENT_ID + CLIENT_SECRET → redirect → callback → access_token + refresh_token в БД  
**Новая архитектура (статический токен):** `TBANK_API_TOKEN` в env → Bearer в каждом запросе

**Изменённые файлы:**
- `src/lib/tbank.ts` — убраны buildAuthUrl, exchangeCode, refreshAccessToken. Токен берётся из `TBANK_API_TOKEN` env var
- `src/app/api/tbank/sync/route.ts` — убрана логика refresh токена, при первом синке автоматически обнаруживает номер счёта через getBankAccounts()
- `src/app/api/tbank/status/route.ts` — проверяет наличие TBANK_API_TOKEN, возвращает статус + данные из tbank_connections
- `src/app/api/tbank/auth/route.ts` — заглушка 410 (OAuth не нужен)
- `src/app/api/tbank/callback/route.ts` — заглушка 410 (OAuth не нужен)
- `src/app/dashboard/settings/page.tsx` — убрана OAuth кнопка, убран expired-токен UI, упрощён до кнопки Синхронизировать

### VPS nginx прокси настроен

На сервере Timeweb (IP: **72.56.122.221**) настроен nginx reverse proxy на порту **8081**:
- Конфиг: `/etc/nginx/sites-available/tbank-proxy`
- Проксирует на `https://business.tinkoff.ru`
- Проверено: `curl -I http://72.56.122.221:8081` возвращает 307 от T-Bank

### Токен T-Bank выпущен

- Выпущен в T-Bank Business → Все сервисы → T-API → Выпуск токена
- Добавлен в Vercel и `.env.local` как `TBANK_API_TOKEN`
- Скоупы: Счета и выписки (информация об операциях, информация о счетах, информация о транзакциях и авторизациях)
- IP в T-Bank: `72.56.122.221`

---

## Текущая проблема: `/api/tbank/sync` возвращает 502

**Симптом:** Settings страница показывает "Подключено" (токен есть), но кнопка "Синхронизировать" даёт 502.

**Вероятная причина:** Vercel делает запросы к `https://business.tinkoff.ru/openapi` напрямую со своих динамических IP, а T-Bank разрешает запросы только с `72.56.122.221`. Nginx прокси настроен на VPS, но код приложения его не использует — `TBANK_API_BASE` в `src/lib/tbank.ts` жёстко прописан как `https://business.tinkoff.ru/openapi`.

**Что нужно выяснить в следующей сессии:**

1. **Проверить реальный ответ T-Bank** — добавить логирование в `/api/tbank/sync`, посмотреть точный текст ошибки (не просто 502, а что пишет T-Bank)
2. **Вариант А — роутить через VPS прокси:**
   - Добавить `TBANK_API_BASE_URL=http://72.56.122.221:8081` в Vercel env
   - В `src/lib/tbank.ts` использовать `process.env.TBANK_API_BASE_URL ?? TBANK_API_BASE`
   - Убедиться что nginx на VPS правильно форвардит заголовок Authorization
3. **Вариант Б — проверить, возможно T-Bank не требует IP whitelist для read-only токена** — попробовать запрос напрямую без прокси через curl с произвольного IP
4. **Проверить точный URL эндпоинта** — T-Bank может отдавать счета по другому пути (документация: business.tinkoff.ru/openapi/docs)

---

## Env vars (все добавлены в Vercel и .env.local)

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
TBANK_API_TOKEN        ← новый, добавлен сегодня
```

## Supabase — что нужно запустить

| SQL файл | Статус |
|---|---|
| `supabase/budgets.sql` | ⚠️ подтвердить |
| `supabase/tbank_connections.sql` | ⚠️ подтвердить |

Таблица `tbank_connections` хранит: user_id, account_number, company_name, inn, connected_at, last_sync_at (без токенов — они теперь в env).

---

## VPS (Timeweb)

- IP: `72.56.122.221`
- SSH: `ssh root@72.56.122.221`
- Nginx прокси: `/etc/nginx/sites-available/tbank-proxy` (порт 8081)
- На сервере также крутится WireGuard VPN (wg-easy в Docker, `/opt/wg-easy/`)

---

## Следующие приоритеты после фикса синка

1. Проверить синк работает → транзакции появляются в таблице
2. Dashboard отображает данные из T-Bank (а не только из загруженных выписок)
3. Автосинк по расписанию (cron или webhook от T-Bank)
