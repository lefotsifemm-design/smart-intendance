'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import { ChevronLeft, ChevronRight, CalendarDays, AlertCircle, Clock, TrendingDown } from 'lucide-react';

interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  category: string;
  last_charge: string | null;
  created_at: string;
  deleted_at: string | null;
}

interface CalendarPayment {
  sub: Subscription;
  date: Date;
}

const CATEGORY_COLORS: Record<string, string> = {
  Software: 'bg-blue-100 text-blue-700',
  'IT & Software': 'bg-blue-100 text-blue-700',
  Cloud: 'bg-sky-100 text-sky-700',
  'Cloud Storage': 'bg-sky-100 text-sky-700',
  Marketing: 'bg-orange-100 text-orange-700',
  Entertainment: 'bg-purple-100 text-purple-700',
  Music: 'bg-pink-100 text-pink-700',
  Design: 'bg-rose-100 text-rose-700',
  Education: 'bg-green-100 text-green-700',
  Fitness: 'bg-emerald-100 text-emerald-700',
  'Food & Delivery': 'bg-yellow-100 text-yellow-700',
  Productivity: 'bg-indigo-100 text-indigo-700',
};

function colorForSub(sub: Subscription): string {
  return CATEGORY_COLORS[sub.category] ?? 'bg-gray-100 text-gray-700';
}

function getBillingDay(sub: Subscription): number {
  const base = sub.last_charge ? new Date(sub.last_charge) : new Date(sub.created_at);
  return base.getDate();
}

function getAnnualMonth(sub: Subscription): number {
  const base = sub.last_charge ? new Date(sub.last_charge) : new Date(sub.created_at);
  return base.getMonth();
}

function getPaymentsForMonth(subscriptions: Subscription[], year: number, month: number): CalendarPayment[] {
  const payments: CalendarPayment[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (const sub of subscriptions) {
    if (sub.frequency === 'monthly') {
      const day = Math.min(getBillingDay(sub), daysInMonth);
      payments.push({ sub, date: new Date(year, month, day) });
    } else if (sub.frequency === 'annual') {
      if (getAnnualMonth(sub) === month) {
        const base = sub.last_charge ? new Date(sub.last_charge) : new Date(sub.created_at);
        const day = Math.min(base.getDate(), daysInMonth);
        payments.push({ sub, date: new Date(year, month, day) });
      }
    }
  }

  return payments;
}

function getUpcomingPayments(subscriptions: Subscription[], days: number): CalendarPayment[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + days);

  const results: CalendarPayment[] = [];

  for (const sub of subscriptions) {
    if (sub.frequency === 'monthly') {
      const day = getBillingDay(sub);
      // Check current and next month
      for (let offset = 0; offset <= 1; offset++) {
        const d = new Date(now.getFullYear(), now.getMonth() + offset, day);
        if (d >= now && d <= cutoff) {
          results.push({ sub, date: d });
        }
      }
    } else if (sub.frequency === 'annual') {
      const base = sub.last_charge ? new Date(sub.last_charge) : new Date(sub.created_at);
      const d = new Date(now.getFullYear(), base.getMonth(), base.getDate());
      if (d < now) d.setFullYear(d.getFullYear() + 1);
      if (d <= cutoff) results.push({ sub, date: d });
    }
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarPage() {
  const { data: session } = useSession();
  const { symbol } = useCurrency();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .is('deleted_at', null)
      .then(({ data }) => {
        setSubscriptions((data as Subscription[]) ?? []);
        setLoading(false);
      });
  }, [session?.user?.id]);

  const paymentsThisMonth = useMemo(
    () => getPaymentsForMonth(subscriptions, viewYear, viewMonth),
    [subscriptions, viewYear, viewMonth],
  );

  const upcoming7 = useMemo(() => getUpcomingPayments(subscriptions, 7), [subscriptions]);
  const upcoming30 = useMemo(() => getUpcomingPayments(subscriptions, 30), [subscriptions]);

  // Build calendar grid (Mon–Sun)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // getDay(): 0=Sun,1=Mon..6=Sat → convert to Mon=0 offset
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) return null;
      return dayNum;
    });
  }, [viewYear, viewMonth]);

  const paymentsByDay = useMemo(() => {
    const map: Record<number, CalendarPayment[]> = {};
    for (const p of paymentsThisMonth) {
      const d = p.date.getDate();
      if (!map[d]) map[d] = [];
      map[d].push(p);
    }
    return map;
  }, [paymentsThisMonth]);

  const totalThisMonth = paymentsThisMonth.reduce((s, p) => s + p.sub.amount, 0);
  const totalUpcoming7 = upcoming7.reduce((s, p) => s + p.sub.amount, 0);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const isDueSoon = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    const diff = (d.getTime() - today.getTime()) / 86_400_000;
    return diff >= 0 && diff <= 7;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment Calendar</h1>
        <p className="text-sm text-gray-500 mt-1">Upcoming subscription charges</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <CalendarDays className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">This month</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {symbol}{totalThisMonth.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">{paymentsThisMonth.length} payments</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
          <div className="p-2 bg-orange-50 rounded-lg">
            <Clock className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Next 7 days</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {symbol}{totalUpcoming7.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">{upcoming7.length} payments</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <TrendingDown className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Next 30 days</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {symbol}{upcoming30.reduce((s, p) => s + p.sub.amount, 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">{upcoming30.length} payments</p>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            const dayPayments = paymentsByDay[day] ?? [];
            const hasPayments = dayPayments.length > 0;
            const soon = hasPayments && isDueSoon(day);

            return (
              <div
                key={day}
                className={`min-h-[72px] rounded-lg p-1.5 border transition ${
                  isToday(day)
                    ? 'border-blue-500 bg-blue-50'
                    : soon
                    ? 'border-orange-200 bg-orange-50'
                    : hasPayments
                    ? 'border-gray-200 bg-gray-50'
                    : 'border-transparent'
                }`}
              >
                <div className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                  isToday(day) ? 'bg-blue-600 text-white' : 'text-gray-700'
                }`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayPayments.slice(0, 2).map(({ sub }) => (
                    <div
                      key={sub.id}
                      title={`${sub.name} — ${symbol}${sub.amount}`}
                      className={`text-[10px] font-medium px-1 py-0.5 rounded truncate ${colorForSub(sub)}`}
                    >
                      {sub.name}
                    </div>
                  ))}
                  {dayPayments.length > 2 && (
                    <div className="text-[10px] text-gray-400 px-1">
                      +{dayPayments.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list */}
      {upcoming30.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Upcoming — next 30 days</h3>
          <div className="space-y-2">
            {upcoming30.map(({ sub, date }) => {
              const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
              const isVeryClose = diff <= 3;
              const isSoon = diff <= 7;

              return (
                <div
                  key={`${sub.id}-${date.toISOString()}`}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isVeryClose ? (
                      <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    ) : (
                      <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{sub.name}</p>
                      <p className="text-xs text-gray-400">{sub.category} · {sub.frequency}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isVeryClose
                        ? 'bg-orange-100 text-orange-700'
                        : isSoon
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `in ${diff}d`}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {symbol}{sub.amount.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400 w-16 text-right">
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subscriptions.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No subscriptions yet.</p>
          <p className="text-gray-400 text-xs mt-1">Add subscriptions in Overview to see them here.</p>
        </div>
      )}
    </div>
  );
}
