'use client';

import { useState, useMemo } from 'react';
import { useCurrency } from '@/hooks/use-currency';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle, CheckCircle2, Zap, RefreshCw,
  CalendarClock, Wallet, ArrowDownCircle, ArrowUpCircle,
  Lightbulb, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  CashGapResult, GapAlert, Obligation, ForecastDay,
} from '@/app/api/cashgap/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, symbol: string) {
  return `${symbol}${Math.abs(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function shortDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

const URGENCY_STYLE = {
  critical: {
    border: 'border-red-300',
    bg: 'bg-red-50',
    badge: 'bg-red-100 text-red-700',
    text: 'text-red-700',
    label: 'Критично',
    dot: 'bg-red-500',
  },
  high: {
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    badge: 'bg-orange-100 text-orange-700',
    text: 'text-orange-700',
    label: 'Высокий риск',
    dot: 'bg-orange-500',
  },
  medium: {
    border: 'border-yellow-300',
    bg: 'bg-yellow-50',
    badge: 'bg-yellow-100 text-yellow-700',
    text: 'text-yellow-700',
    label: 'Внимание',
    dot: 'bg-yellow-500',
  },
} as const;

const OBLIGATION_TYPE_LABEL: Record<string, string> = {
  payroll: 'ФОТ',
  tax: 'Налог',
  rent: 'Аренда',
  loan: 'Кредит',
  supplier: 'Поставщик',
  other: 'Прочее',
};

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({ alert, symbol }: { alert: GapAlert; symbol: string }) {
  const [open, setOpen] = useState(false);
  const s = URGENCY_STYLE[alert.urgency];

  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} overflow-hidden`}>
      <div
        className="flex items-start justify-between gap-4 p-5 cursor-pointer"
        onClick={() => setOpen((p) => !p)}
      >
        {/* Left */}
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${s.dot}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
                {s.label}
              </span>
              <span className="text-xs text-gray-500">
                через {alert.daysUntil === 0 ? 'сегодня' : `${alert.daysUntil} дн.`} · {shortDate(alert.date)}
              </span>
            </div>
            <p className={`font-semibold mt-1 ${s.text}`}>{alert.obligationName}</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Нужно: <strong>{fmt(alert.obligationAmount, symbol)}</strong>
              {' · '}Прогноз на счёте: <strong className={alert.projectedBalance < 0 ? 'text-red-700' : 'text-gray-800'}>
                {alert.projectedBalance < 0 ? '−' : ''}{fmt(alert.projectedBalance, symbol)}
              </strong>
            </p>
          </div>
        </div>

        {/* Right: deficit + toggle */}
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <p className="text-lg font-bold text-red-700">
            −{fmt(alert.deficit, symbol)}
          </p>
          <p className="text-xs text-gray-400">дефицит</p>
          {open
            ? <ChevronUp className="w-4 h-4 text-gray-400 mt-1" />
            : <ChevronDown className="w-4 h-4 text-gray-400 mt-1" />}
        </div>
      </div>

      {open && alert.recommendation && (
        <div className="border-t border-current border-opacity-10 px-5 py-3 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
          <p className="text-sm text-gray-700">{alert.recommendation}</p>
        </div>
      )}
    </div>
  );
}

// ─── Obligation row ───────────────────────────────────────────────────────────

function ObligationRow({ ob, symbol }: { ob: Obligation; symbol: string }) {
  const typeLabel = OBLIGATION_TYPE_LABEL[ob.type] ?? 'Прочее';
  const priorityColor =
    ob.priority === 'critical' ? 'bg-red-100 text-red-700'
    : ob.priority === 'high' ? 'bg-orange-100 text-orange-700'
    : 'bg-gray-100 text-gray-600';

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <ArrowDownCircle className="w-4 h-4 text-red-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{ob.name}</p>
          <p className="text-xs text-gray-400">
            {ob.dayOfMonth}-е число · {ob.recurrence === 'monthly' ? 'ежемесячно' : 'ежеквартально'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor}`}>
          {typeLabel}
        </span>
        <span className="text-sm font-bold text-gray-900">{fmt(ob.amount, symbol)}</span>
      </div>
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, symbol }: {
  active?: boolean; payload?: { value: number }[]; label?: string; symbol: string;
}) {
  if (!active || !payload?.length) return null;
  const balance = payload[0].value;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="text-gray-500 mb-1">{label}</p>
      <p className={`font-bold ${balance < 0 ? 'text-red-600' : 'text-blue-700'}`}>
        {balance < 0 ? '−' : ''}{fmt(balance, symbol)}
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CashGapPage() {
  const { symbol } = useCurrency();
  const [balanceInput, setBalanceInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CashGapResult | null>(null);

  const handleAnalyze = async () => {
    const balance = parseFloat(balanceInput.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(balance)) { toast.error('Введите корректный остаток'); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/cashgap?balance=${balance}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setResult(await res.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка анализа');
    } finally {
      setLoading(false);
    }
  };

  // Derived
  const alerts = result?.alerts ?? [];
  const obligations = result?.obligations ?? [];
  const forecast = result?.forecast ?? [];
  const collection = result?.collection;

  const criticalAlert = alerts.find((a) => a.urgency === 'critical');
  const firstGap = alerts[0];

  const chartData = useMemo(
    () => forecast.map((d: ForecastDay) => ({
      date: shortDate(d.date),
      balance: d.balance,
      rawDate: d.date,
    })),
    [forecast]
  );

  // Gap periods for red shading
  const gapZones = useMemo(() => {
    const zones: { x1: string; x2: string }[] = [];
    let inZone = false;
    let zoneStart = '';
    for (const d of forecast) {
      if (d.balance < 0 && !inZone) {
        inZone = true;
        zoneStart = shortDate(d.date);
      }
      if (d.balance >= 0 && inZone) {
        zones.push({ x1: zoneStart, x2: shortDate(d.date) });
        inZone = false;
      }
    }
    if (inZone) zones.push({ x1: zoneStart, x2: shortDate(forecast[forecast.length - 1].date) });
    return zones;
  }, [forecast]);

  const minBalance = useMemo(() => forecast.length ? Math.min(...forecast.map((d) => d.balance)) : 0, [forecast]);
  const endBalance = forecast[forecast.length - 1]?.balance ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Кассовый разрыв</h1>
        <p className="text-gray-500 mt-1">
          AI сопоставляет обязательства (ФОТ, налоги, аренда) с ожидаемыми поступлениями и предупреждает заранее
        </p>
      </div>

      {/* Balance input */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Текущий остаток на счёте</h2>
        <p className="text-sm text-gray-400 mb-4">Укажите сумму, которая есть прямо сейчас</p>
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">{symbol}</span>
            <input
              type="text"
              inputMode="numeric"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="2 500 000"
              className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !balanceInput}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Анализирую…</>
              : <><Zap className="w-4 h-4" /> Проверить риски</>}
          </button>
        </div>
        {loading && (
          <p className="text-xs text-gray-400 mt-3">
            AI анализирует обязательства и паттерны поступлений… (15–25 сек)
          </p>
        )}
      </div>

      {/* Insufficient data */}
      {result?.insufficient && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Недостаточно данных</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Загрузите выписки минимум за 2–3 месяца, чтобы AI распознал обязательства и паттерны поступлений.
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !result.insufficient && (
        <>
          {/* Hero alert or safe banner */}
          {firstGap ? (
            <div className={`rounded-xl border p-5 flex items-start gap-4 ${
              criticalAlert ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-200'
            }`}>
              <AlertTriangle className={`w-6 h-6 shrink-0 mt-0.5 ${criticalAlert ? 'text-red-500' : 'text-orange-500'}`} />
              <div className="min-w-0">
                <p className={`font-bold text-lg ${criticalAlert ? 'text-red-800' : 'text-orange-800'}`}>
                  Риск кассового разрыва: через {firstGap.daysUntil} дн. ({shortDate(firstGap.date)})
                </p>
                <p className={`text-sm mt-0.5 ${criticalAlert ? 'text-red-700' : 'text-orange-700'}`}>
                  {firstGap.obligationName} — нужно {fmt(firstGap.obligationAmount, symbol)},
                  {' '}прогнозируемый дефицит: <strong>{fmt(firstGap.deficit, symbol)}</strong>
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-green-200 bg-green-50 p-5 flex items-center gap-4">
              <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
              <div>
                <p className="font-bold text-green-800">Кассовых разрывов не прогнозируется</p>
                <p className="text-sm text-green-700 mt-0.5">
                  На следующие 30 дней ожидаемые поступления покрывают все обязательства
                </p>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Риск-событий</span>
              </div>
              <p className={`text-2xl font-bold ${alerts.length > 0 ? 'text-red-700' : 'text-green-700'}`}>
                {alerts.length}
              </p>
              <p className="text-xs text-gray-400 mt-1">в следующие 30 дней</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Мин. остаток</span>
              </div>
              <p className={`text-2xl font-bold ${minBalance < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                {minBalance < 0 ? '−' : ''}{fmt(minBalance, symbol)}
              </p>
              <p className="text-xs text-gray-400 mt-1">худшая точка за 30 дней</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Прогноз через 30 дн.</span>
              </div>
              <p className={`text-2xl font-bold ${endBalance < 0 ? 'text-red-700' : 'text-blue-700'}`}>
                {endBalance < 0 ? '−' : ''}{fmt(endBalance, symbol)}
              </p>
              <p className="text-xs text-gray-400 mt-1">ожидаемый остаток</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Прогноз баланса на 30 дней</h2>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="cgBalanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} interval={4} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<ChartTooltip symbol={symbol} />} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
                {gapZones.map((z, i) => (
                  <ReferenceArea key={i} x1={z.x1} x2={z.x2} fill="#ef4444" fillOpacity={0.08} />
                ))}
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#cgBalanceGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#3b82f6' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Gap alerts */}
          {alerts.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-900">
                Риск-события <span className="text-gray-400 font-normal text-sm">({alerts.length})</span>
              </h2>
              {alerts.map((a, i) => (
                <AlertCard key={i} alert={a} symbol={symbol} />
              ))}
            </div>
          )}

          {/* Obligations + Collection side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Obligations */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-red-400" />
                  <h2 className="font-semibold text-gray-900">Обязательства</h2>
                </div>
                <p className="text-sm text-gray-400 mt-0.5">Регулярные исходящие платежи</p>
              </div>
              <div className="divide-y divide-gray-50 px-5">
                {obligations.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4">Регулярных обязательств не найдено</p>
                ) : (
                  obligations.map((ob, i) => (
                    <ObligationRow key={i} ob={ob} symbol={symbol} />
                  ))
                )}
              </div>
            </div>

            {/* Collection pattern */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpCircle className="w-4 h-4 text-green-500" />
                  <h2 className="font-semibold text-gray-900">Поступления</h2>
                </div>
                <p className="text-sm text-gray-400">Паттерны входящих платежей</p>
              </div>

              {collection && (
                <>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Среднемес. доход</span>
                      <span className="font-bold text-green-700">{fmt(collection.avgMonthlyIncome, symbol)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Пик поступлений</span>
                      <span className="font-semibold text-gray-900">{collection.peakDay}-е число</span>
                    </div>
                    <div className="flex justify-between items-start gap-3">
                      <span className="text-sm text-gray-500 shrink-0">Типичные дни</span>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {collection.typicalPaymentDays.map((d) => (
                          <span key={d} className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                            {d}-е
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {collection.varianceNote && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <p>{collection.varianceNote}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
