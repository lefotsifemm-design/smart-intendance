# Smart Intendance — Session Handoff
**Date:** 4 May 2026  
**Branch:** main  

---

## Статус T-Bank интеграции: ✅ РАБОТАЕТ

Синхронизация с T-Bank Business API полностью завершена и протестирована. Транзакции тянутся, категоризируются через GPT-4o-mini, сохраняются в Supabase.

### Что было сделано в этой сессии

| Проблема | Решение |
|---|---|
| Vercel шлёт запросы напрямую, T-Bank блокирует по IP | `TBANK_API_BASE_URL=http://72.56.122.221:8081/openapi` в Vercel |
| Env var содержала имя переменной вместо значения | Исправлено в Vercel — только значение без `KEY=` |
| Порт 8081 заблокирован облачным фаерволом Timeweb | Добавлено правило TCP 8081 в группу **Wild Sagittarius** |
| Навигация вела на несуществующий `/dashboard/analytics` | Исправлено на `/dashboard/statements` в `layout.tsx` |
| T-Bank API ожидает `to`, а не `till` | Исправлено в `src/lib/tbank.ts` |
| T-Bank возвращает `{ operations: [...] }`, а не `{ payload: [...] }` | Исправлено в `getStatement` и маппинге `sync/route.ts` |
| Поля ответа: `operationId`, `operationDate`, `operationAmount`, `typeOfOperation` | Обновлены интерфейс `TBankTransaction` и весь маппинг |

### Итоговая архитектура прокси

```
Vercel (dynamic IP)
  → HTTP POST http://72.56.122.221:8081/openapi/api/v1/statement
  → nginx на VPS (порт 8081, /etc/nginx/sites-available/tbank-proxy)
  → HTTPS https://business.tinkoff.ru/openapi/api/v1/statement
  → T-Bank видит IP 72.56.122.221 ✅
```

### Структура ответа T-Bank (реальная)

```json
{
  "operations": [
    {
      "operationId": "uuid",
      "operationDate": "2026-04-13T11:51:18Z",
      "operationAmount": 128000,
      "typeOfOperation": "Credit",
      "description": "Взнос финансовой помощи от учредителя",
      "payPurpose": "...",
      "counterParty": { "name": "...", "inn": "...", "kpp": "..." },
      "category": "incomePeople"
    }
  ]
}
```

---

## Env vars (Vercel + .env.local)

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
TBANK_API_TOKEN               ← Bearer токен из T-Bank Business → T-API
TBANK_API_BASE_URL=http://72.56.122.221:8081/openapi  ← только в Vercel, не в .env.local
```

> `.env.local` не содержит `TBANK_API_BASE_URL` — локально код использует дефолт `https://business.tinkoff.ru/openapi` напрямую.

---

## VPS (Timeweb Cloud)

- Сервер: **Mysterious Linnet**, IP: `72.56.122.221`
- SSH: `ssh root@72.56.122.221`
- Nginx прокси: `/etc/nginx/sites-available/tbank-proxy` (порт 8081 → business.tinkoff.ru)
- Фаерволы: **Wild Sagittarius** (порты 22, 8000, 8081, 51821 TCP, 51820 UDP) + **Nimble Hoopoe** (443, 22, 80)
- Также: WireGuard VPN (wg-easy, `/opt/wg-easy/`)

---

## Известная проблема: изоляция по пользователям

`TBANK_API_TOKEN` — серверная переменная, общая для всего приложения. Любой залогиненный пользователь видит "T-Bank connected" и может синкнуть чужие финансовые данные.

**Быстрый фикс (не сделан):** добавить `ALLOWED_EMAILS` env var и проверять в sync/status роутах.

---

## Следующий приоритет: Предиктивный кассовый разрыв

### Концепция

На основе исторических данных AI строит прогноз Cash Flow на месяц вперёд. Если система видит, что в конкретную дату денег на счету не хватит — бьёт тревогу заранее.

### Флоу

```
Исторические транзакции (90+ дней из T-Bank/загруженных выписок)
  ↓
GPT-4o анализирует:
  - Регулярные расходы (ФОТ, аренда, налоги, подписки) → даты + суммы
  - Дебиторку: средний срок оплаты счетов клиентами → вероятная дата поступления
  - Сезонность: паттерны по дням недели / числам месяца
  ↓
Прогноз: ежедневный баланс на 30 дней вперёд
  ↓
Детектор разрывов: дни где прогнозный баланс < 0 (или < порога)
  ↓
Алерты: карточки "⚠️ 15 мая — возможный кассовый разрыв: −₽47 000"
  + объяснение причины (ФОТ + налог) и рекомендация (ускорить сбор дебиторки)
```

### Компоненты для реализации

| Компонент | Что делает |
|---|---|
| `/api/cashgap` | GET `?balance=N` → AI-анализ + прогноз + список разрывов |
| `CashGapDetector` | Серверная функция: анализирует паттерны, строит daily balance array |
| `/dashboard/cashgap` | Страница: график баланса, таблица алертов, список паттернов |
| `GapAlertBanner` | Компонент на Dashboard: показывает ближайший риск если он есть |

### Данные для анализа

- `transactions` таблица: source `tbank` + `upload` — всё что есть
- Пользователь вводит текущий баланс (или берём из T-Bank `balance.otb`)
- Опционально: пользователь указывает ожидаемые поступления вручную

### AI-промпт (концепт)

```
Ты CFO-аналитик. На основе транзакций за последние N дней:
1. Найди регулярные расходы (ФОТ, аренда, налоги) — дата в месяце + сумма
2. Найди паттерны поступлений — средний день поступления + средняя сумма
3. Построй прогноз ежедневного баланса на 30 дней начиная с [currentBalance]
4. Отметь дни где баланс падает ниже [threshold] — это кассовые разрывы
5. Для каждого разрыва: причина + рекомендация
Верни JSON: { dailyForecast: [{date, balance, events}], gaps: [{date, amount, reason, recommendation}] }
```

### Отличие от текущего Cash Flow

| Текущий Cash Flow | Предиктивный кассовый разрыв |
|---|---|
| Паттерны + 30-дневный прогноз баланса | То же, но фокус на конкретных датах риска |
| Нет алертов | Алерты с причиной и рекомендацией |
| Пользователь вводит баланс вручную | Баланс из T-Bank API автоматически |
| Нет дебиторки | Моделирует ожидаемые поступления по истории |

> Вероятно, имеет смысл расширить существующий `/api/cashflow` и страницу Cash Flow, а не создавать отдельный роут — добавить режим "разрывы" как отдельную секцию.
