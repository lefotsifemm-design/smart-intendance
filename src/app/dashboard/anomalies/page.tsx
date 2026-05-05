'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/hooks/use-currency';
import {
  AlertTriangle,
  Copy,
  Ghost,
  TrendingUp,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SpendingAnomaly, DuplicateGroup, ZombieSubscription } from '@/app/api/anomalies/route';
import type { AlertRecord } from '@/app/api/alerts/route';

const STORAGE_KEY = 'si_anomaly_count';

function fmt(n: number, symbol: string) {
  return `${symbol}${Math.abs(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function shortDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function anomalyKey(item: SpendingAnomaly) {
  return `anomaly:${item.category}:${item.currentMonthLabel}`;
}
function duplicateKey(item: DuplicateGroup) {
  return `duplicate:${item.name}:${item.monthLabel}`;
}
function zombieKey(item: ZombieSubscription) {
  return `zombie:${item.name}`;
}

// ─── Severity badge ────────────────────────────────────────────────────────────
const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
};
const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Критично',
  high: 'Высокий риск',
  medium: 'Внимание',
};

// ─── Dismiss button ───────────────────────────────────────────────────────────
function DismissBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title="Скрыть"
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition shrink-0"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  );
}

// ─── Anomaly card ─────────────────────────────────────────────────────────────
function AnomalyCard({
  item, symbol, dismissed, onDismiss,
}: { item: SpendingAnomaly; symbol: string; dismissed: boolean; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  if (dismissed) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div
        className="flex items-start justify-between gap-4 p-5 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
            <TrendingUp className="w-4 h-4 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{item.category}</p>
            <p className="text-sm text-gray-400 mt-0.5">{item.currentMonthLabel}</p>
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLE[item.severity]}`}>
            {SEVERITY_LABEL[item.severity]}
          </span>
          <p className="text-sm font-bold text-red-600">+{item.changePercent}%</p>
          <div className="flex items-center gap-1">
            <DismissBtn onClick={onDismiss} />
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-0.5">Текущий месяц</p>
              <p className="text-lg font-bold text-red-600">{fmt(item.currentAmount, symbol)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-0.5">Средняя за 3 мес.</p>
              <p className="text-lg font-bold text-gray-700">{fmt(item.previousAvg, symbol)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Превышение: <strong>{fmt(item.currentAmount - item.previousAvg, symbol)}</strong> сверх нормы
            </span>
          </div>

          {item.topTransactions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Крупнейшие платежи
              </p>
              <div className="space-y-1.5">
                {item.topTransactions.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-400 shrink-0">{shortDate(tx.date)}</span>
                      <span className="text-gray-700 truncate">{tx.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900 ml-3 shrink-0">
                      {fmt(tx.amount, symbol)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Duplicate card ───────────────────────────────────────────────────────────
function DuplicateCard({
  item, symbol, dismissed, onDismiss,
}: { item: DuplicateGroup; symbol: string; dismissed: boolean; onDismiss: () => void }) {
  if (dismissed) return null;

  return (
    <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
              <Copy className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 truncate max-w-xs">{item.name}</p>
              <p className="text-sm text-gray-400">{item.category} · {item.monthLabel}</p>
            </div>
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <DismissBtn onClick={onDismiss} />
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                {item.items.length}× оплачено
              </span>
            </div>
            {item.totalWasted > 0 && (
              <p className="text-sm font-bold text-orange-700 mt-1">
                Лишнее: {fmt(item.totalWasted, symbol)}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {item.items.map((tx, i) => (
            <div key={i} className="flex items-center gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-gray-400 shrink-0 w-16">{shortDate(tx.date)}</span>
              <span className="text-gray-700 truncate flex-1">
                {tx.description || tx.counterparty || '—'}
              </span>
              <span className="font-semibold text-gray-900 shrink-0">{fmt(item.amount, symbol)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Zombie card ──────────────────────────────────────────────────────────────
function ZombieCard({
  item, symbol, dismissed, onDismiss,
}: { item: ZombieSubscription; symbol: string; dismissed: boolean; onDismiss: () => void }) {
  if (dismissed) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
            <Ghost className="w-4 h-4 text-gray-500" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{item.name}</p>
            <p className="text-sm text-gray-400">{item.category}</p>
            <p className="text-xs text-gray-400 mt-1">
              {shortDate(item.firstCharge)} — {shortDate(item.lastCharge)} · {item.monthsActive} мес.
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <DismissBtn onClick={onDismiss} />
          <p className="text-lg font-bold text-gray-900">
            {fmt(item.amount, symbol)}<span className="text-xs font-normal text-gray-400">/мес</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Всего: {fmt(item.totalSpent, symbol)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  subtitle,
  visibleCount,
  totalCount,
  iconBg,
  iconColor,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  visibleCount: number;
  totalCount: number;
  iconBg: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  const hiddenCount = totalCount - visibleCount;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">
            {title}{' '}
            {totalCount > 0 && (
              <span className="text-gray-400 font-normal text-sm">
                ({visibleCount}{hiddenCount > 0 ? `, ${hiddenCount} скрыто` : ''})
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AnomaliesPage() {
  const { symbol } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [anomalies, setAnomalies] = useState<SpendingAnomaly[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [zombies, setZombies] = useState<ZombieSubscription[]>([]);
  const [insufficient, setInsufficient] = useState(false);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  // Load dismissed alerts
  useEffect(() => {
    fetch('/api/alerts')
      .then((r) => r.ok ? r.json() : [])
      .then((records: AlertRecord[]) => {
        const keys = records
          .filter((r) => r.alert_type === 'anomaly')
          .map((r) => r.alert_key);
        setDismissedKeys(new Set(keys));
      })
      .catch(() => {/* non-critical */});
  }, []);

  const dismiss = useCallback(async (alertKey: string) => {
    setDismissedKeys((prev) => new Set([...prev, alertKey]));
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertType: 'anomaly', alertKey, action: 'dismiss' }),
      });
    } catch {/* non-critical */}
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/anomalies');
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      const data = await res.json();
      setAnomalies(data.anomalies);
      setDuplicates(data.duplicates);
      setZombies(data.zombies);
      setInsufficient(data.insufficient);

      // Persist total count for Dashboard widget
      const total = data.anomalies.length + data.duplicates.length + data.zombies.length;
      try { localStorage.setItem(STORAGE_KEY, String(total)); } catch { /* ok */ }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visibleAnomalies = anomalies.filter((a) => !dismissedKeys.has(anomalyKey(a)));
  const visibleDuplicates = duplicates.filter((d) => !dismissedKeys.has(duplicateKey(d)));
  const visibleZombies = zombies.filter((z) => !dismissedKeys.has(zombieKey(z)));
  const totalIssues = anomalies.length + duplicates.length + zombies.length;
  const visibleTotal = visibleAnomalies.length + visibleDuplicates.length + visibleZombies.length;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Детектор аномалий</h1>
          <p className="text-gray-500 mt-1">
            AI-аудитор находит скачки расходов, дубли платежей и забытые подписки
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-20 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && insufficient && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-5">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Недостаточно данных</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Загрузите выписки минимум за 2–3 месяца для выявления аномалий.
            </p>
          </div>
        </div>
      )}

      {!loading && !insufficient && visibleTotal === 0 && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-5">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800">Всё чисто</p>
            <p className="text-sm text-green-700 mt-0.5">
              {totalIssues > 0
                ? 'Все обнаруженные аномалии скрыты.'
                : 'Аномалий, дублей и забытых подписок не обнаружено.'}
            </p>
          </div>
        </div>
      )}

      {!loading && !insufficient && (
        <>
          {/* Summary bar */}
          {totalIssues > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className={`rounded-xl border p-4 text-center ${visibleAnomalies.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-2xl font-bold ${visibleAnomalies.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                  {visibleAnomalies.length}
                </p>
                <p className={`text-xs font-medium mt-1 ${visibleAnomalies.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>Аномалий</p>
              </div>
              <div className={`rounded-xl border p-4 text-center ${visibleDuplicates.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-2xl font-bold ${visibleDuplicates.length > 0 ? 'text-orange-700' : 'text-gray-400'}`}>
                  {visibleDuplicates.length}
                </p>
                <p className={`text-xs font-medium mt-1 ${visibleDuplicates.length > 0 ? 'text-orange-600' : 'text-gray-400'}`}>Дублей</p>
              </div>
              <div className={`rounded-xl border p-4 text-center ${visibleZombies.length > 0 ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-2xl font-bold ${visibleZombies.length > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                  {visibleZombies.length}
                </p>
                <p className={`text-xs font-medium mt-1 ${visibleZombies.length > 0 ? 'text-gray-600' : 'text-gray-400'}`}>Зомби-подписок</p>
              </div>
            </div>
          )}

          {/* Spending anomalies */}
          <Section
            icon={ShieldAlert}
            title="Скачки расходов"
            subtitle="Категории, где траты выросли более чем на 30% по сравнению со средним"
            visibleCount={visibleAnomalies.length}
            totalCount={anomalies.length}
            iconBg="bg-red-50"
            iconColor="text-red-500"
          >
            {anomalies.length === 0 ? (
              <div className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4">
                Аномальных скачков расходов не обнаружено
              </div>
            ) : (
              <div className="space-y-3">
                {anomalies.map((a, i) => (
                  <AnomalyCard
                    key={i}
                    item={a}
                    symbol={symbol}
                    dismissed={dismissedKeys.has(anomalyKey(a))}
                    onDismiss={() => dismiss(anomalyKey(a))}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Duplicates */}
          <Section
            icon={Copy}
            title="Дубли платежей"
            subtitle="Одинаковые платежи, проведённые несколько раз в одном месяце"
            visibleCount={visibleDuplicates.length}
            totalCount={duplicates.length}
            iconBg="bg-orange-50"
            iconColor="text-orange-500"
          >
            {duplicates.length === 0 ? (
              <div className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4">
                Дублирующихся платежей не найдено
              </div>
            ) : (
              <div className="space-y-3">
                {duplicates.map((d, i) => (
                  <DuplicateCard
                    key={i}
                    item={d}
                    symbol={symbol}
                    dismissed={dismissedKeys.has(duplicateKey(d))}
                    onDismiss={() => dismiss(duplicateKey(d))}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Zombie subscriptions */}
          <Section
            icon={Ghost}
            title="Забытые подписки"
            subtitle="Регулярные списания с постоянной суммой — возможно, уже не нужны"
            visibleCount={visibleZombies.length}
            totalCount={zombies.length}
            iconBg="bg-gray-100"
            iconColor="text-gray-500"
          >
            {zombies.length === 0 ? (
              <div className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4">
                Подозрительных регулярных списаний не найдено
              </div>
            ) : (
              <div className="space-y-3">
                {zombies.map((z, i) => (
                  <ZombieCard
                    key={i}
                    item={z}
                    symbol={symbol}
                    dismissed={dismissedKeys.has(zombieKey(z))}
                    onDismiss={() => dismiss(zombieKey(z))}
                  />
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
