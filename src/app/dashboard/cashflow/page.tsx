'use client';

import { useState, useMemo } from 'react';
import { useCurrency } from '@/hooks/use-currency';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts';
import {
  TrendingDown, TrendingUp, AlertTriangle, CheckCircle2,
  Zap, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import type { RecurringItem, DayForecast, ForecastTransaction } from '@/app/api/cashflow/route';

function fmt(n: number, symbol: string) {
  return `${symbol}${Math.abs(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function shortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

interface GapPeriod { from: string; to: string }

function findGaps(forecast: DayForecast[]): GapPeriod[] {
  const gaps: GapPeriod[] = [];
  let inGap = false;
  let gapStart = '';
  for (const day of forecast) {
    if (day.balance < 0 && !inGap) { inGap = true; gapStart = day.date; }
    if (day.balance >= 0 && inGap) { gaps.push({ from: gapStart, to: day.date }); inGap = false; }
  }
  if (inGap) gaps.push({ from: gapStart, to: forecast[forecast.length - 1].date });
  return gaps;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High confidence',
  medium: 'Medium',
  low: 'Low confidence',
};

function confidenceBand(c: number): 'high' | 'medium' | 'low' {
  if (c >= 0.8) return 'high';
  if (c >= 0.5) return 'medium';
  return 'low';
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-red-100 text-red-700',
};

// Custom tooltip for the chart
function ChartTooltip({ active, payload, label, symbol }: {
  active?: boolean; payload?: { value: number }[]; label?: string; symbol: string;
}) {
  if (!active || !payload?.length) return null;
  const balance = payload[0].value;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className={`font-bold ${balance < 0 ? 'text-red-600' : 'text-blue-700'}`}>
        {balance < 0 ? '−' : ''}{fmt(balance, symbol)}
      </p>
    </div>
  );
}

export default function CashFlowPage() {
  const { symbol } = useCurrency();
  const [balanceInput, setBalanceInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recurring, setRecurring] = useState<RecurringItem[] | null>(null);
  const [forecast, setForecast] = useState<DayForecast[] | null>(null);
  const [insufficient, setInsufficient] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);

  const handleAnalyze = async () => {
    const balance = parseFloat(balanceInput.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(balance)) { toast.error('Enter a valid balance'); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/cashflow?balance=${balance}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      const data = await res.json();
      setRecurring(data.recurring);
      setForecast(data.forecast);
      setInsufficient(data.insufficient ?? false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const gaps = useMemo(() => forecast ? findGaps(forecast) : [], [forecast]);
  const minBalance = useMemo(() => forecast ? Math.min(...forecast.map((d) => d.balance)) : 0, [forecast]);
  const maxBalance = useMemo(() => forecast ? Math.max(...forecast.map((d) => d.balance)) : 0, [forecast]);
  const endBalance = forecast?.[forecast.length - 1]?.balance ?? 0;

  const daysUntilGap = useMemo(() => {
    if (!forecast) return null;
    const today = forecast[0]?.date;
    const first = forecast.find((d) => d.balance < 0);
    if (!first) return null;
    const diff = Math.round((new Date(first.date).getTime() - new Date(today).getTime()) / 86400000);
    return diff;
  }, [forecast]);

  // Chart data — label as "5 мая" etc.
  const chartData = useMemo(
    () => forecast?.map((d) => ({ date: shortDate(d.date), balance: d.balance, rawDate: d.date })) ?? [],
    [forecast]
  );

  // Upcoming transactions with cash impact (next 30 days, non-empty days only)
  const upcomingDays = useMemo(
    () => (forecast ?? []).filter((d) => d.transactions.length > 0),
    [forecast]
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cash Flow Forecast</h1>
        <p className="text-gray-500 mt-1">AI detects recurring patterns and projects your balance 30 days ahead</p>
      </div>

      {/* Balance input card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Current account balance</h2>
        <p className="text-sm text-gray-400 mb-4">Enter the balance you see in your bank account right now</p>
        <div className="flex gap-3 items-start flex-wrap">
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">{symbol}</span>
            <input
              type="text"
              inputMode="numeric"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="1 500 000"
              className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !balanceInput}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing…</>
              : <><Zap className="w-4 h-4" /> Build forecast</>}
          </button>
        </div>
        {loading && (
          <p className="text-xs text-gray-400 mt-3">AI is analyzing 6 months of transaction history… (10–20 sec)</p>
        )}
      </div>

      {/* Insufficient data warning */}
      {insufficient && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Not enough data for pattern detection</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Upload at least 2–3 months of bank statements to get an accurate forecast.
              The chart below shows your starting balance with no adjustments.
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {forecast && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Gap alert or safe */}
            <div className={`rounded-xl border p-5 ${gaps.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {gaps.length > 0
                  ? <AlertTriangle className="w-5 h-5 text-red-500" />
                  : <CheckCircle2 className="w-5 h-5 text-green-500" />}
                <span className={`text-sm font-semibold ${gaps.length > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {gaps.length > 0 ? 'Cash gap detected' : 'No gap in 30 days'}
                </span>
              </div>
              {gaps.length > 0 ? (
                <p className="text-2xl font-bold text-red-700">
                  {daysUntilGap === 0 ? 'Today' : `In ${daysUntilGap} day${daysUntilGap !== 1 ? 's' : ''}`}
                </p>
              ) : (
                <p className="text-2xl font-bold text-green-700">Safe</p>
              )}
              {gaps.length > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  {shortDate(gaps[0].from)} — {shortDate(gaps[0].to)}
                </p>
              )}
            </div>

            {/* Worst balance */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-semibold text-gray-600">Lowest balance</span>
              </div>
              <p className={`text-2xl font-bold ${minBalance < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                {minBalance < 0 ? '−' : ''}{fmt(minBalance, symbol)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Worst point in 30 days</p>
            </div>

            {/* End-of-period balance */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-semibold text-gray-600">Projected balance</span>
              </div>
              <p className={`text-2xl font-bold ${endBalance < 0 ? 'text-red-700' : 'text-blue-700'}`}>
                {endBalance < 0 ? '−' : ''}{fmt(endBalance, symbol)}
              </p>
              <p className="text-xs text-gray-400 mt-1">In 30 days</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-5">30-day balance projection</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="gapGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  interval={4}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<ChartTooltip symbol={symbol} />} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />

                {/* Red fill for gap periods */}
                {gaps.map((g, i) => (
                  <ReferenceArea
                    key={i}
                    x1={shortDate(g.from)}
                    x2={shortDate(g.to)}
                    fill="#ef4444"
                    fillOpacity={0.08}
                  />
                ))}

                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#balanceGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#3b82f6' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Upcoming cash events */}
          {upcomingDays.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Upcoming cash events</h2>
                <p className="text-sm text-gray-400 mt-0.5">Based on detected recurring patterns</p>
              </div>
              <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                {upcomingDays.map((day) => (
                  <div key={day.date} className="px-5 py-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      {shortDate(day.date)}
                    </p>
                    <div className="space-y-1.5">
                      {day.transactions.map((tx: ForecastTransaction, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${tx.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="text-sm text-gray-700 truncate">{tx.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">{tx.category}</span>
                          </div>
                          <span className={`text-sm font-semibold shrink-0 ml-4 ${tx.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                            {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount, symbol)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-400">Balance after</span>
                      <span className={`text-sm font-bold ${day.balance < 0 ? 'text-red-700' : 'text-gray-800'}`}>
                        {day.balance < 0 ? '−' : ''}{fmt(day.balance, symbol)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detected recurring patterns (collapsible) */}
          {recurring && recurring.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200">
              <button
                onClick={() => setShowRecurring((p) => !p)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition rounded-xl"
              >
                <div>
                  <h2 className="font-semibold text-gray-900">Detected patterns</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{recurring.length} recurring items identified</p>
                </div>
                {showRecurring ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>

              {showRecurring && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {recurring.map((item, i) => {
                    const band = confidenceBand(item.confidence);
                    return (
                      <div key={i} className="flex items-start justify-between gap-4 px-5 py-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            item.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            {item.type === 'income'
                              ? <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                              : <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {item.category} · {item.frequency === 'monthly' ? `Every month on the ${item.dayOfMonth}th` : item.frequency === 'quarterly' ? 'Quarterly' : 'Weekly'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 italic">{item.reasoning}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${item.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                            {item.type === 'income' ? '+' : '−'}{fmt(item.amount, symbol)}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLE[band]}`}>
                            {CONFIDENCE_LABEL[band]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {recurring && recurring.length === 0 && !insufficient && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">No recurring patterns detected</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Your transactions don't show clear recurring patterns yet.
                  Upload more historical data or ensure categories are correctly set in Transactions.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
