'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import {
  TrendingUp, TrendingDown, DollarSign, FileText,
  Upload, ArrowUpRight, ArrowDownRight, Trash2, Eraser,
  Zap, Target, Activity, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
} from 'recharts';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string | null;
  description: string;
  counterparty: string | null;
  created_at: string;
}

const INCOME_COLORS = [
  '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#6366f1',
  '#14b8a6', '#22c55e', '#0ea5e9', '#a855f7', '#64748b',
];
const EXPENSE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#ec4899',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#6366f1', '#64748b',
];
const STACK_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#06b6d4'];
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const EXPENSE_CATEGORIES = [
  'Payroll', 'Rent', 'Utilities', 'Marketing', 'IT & Software', 'Logistics',
  'Taxes', 'Insurance', 'Legal', 'Bank Fees', 'Office Supplies', 'Travel',
  'Meals', 'Groceries', 'Transfer Out', 'Other Expense',
  'Entertainment', 'Software', 'Music', 'Cloud Storage', 'Productivity',
  'Design', 'Education', 'News', 'Fitness', 'Food & Delivery',
  'Transportation', 'Gaming', 'Other',
];

const INCOME_CATEGORIES = [
  'Revenue', 'Payroll In', 'Refunds Received', 'Transfers In', 'Cashback', 'Other Income',
];

type Preset = 'all' | 'this_month' | 'last_month' | '3m' | '6m' | 'custom';

function presetToRange(preset: Preset): { from: string; to: string } | null {
  if (preset === 'all') return null;
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (preset === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    return { from, to };
  }
  if (preset === 'last_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const toEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    return { from, to: toEnd };
  }
  if (preset === '3m') {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return { from: d.toISOString().slice(0, 10), to };
  }
  if (preset === '6m') {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return { from: d.toISOString().slice(0, 10), to };
  }
  return null;
}

function isInRange(dateStr: string | null, from: string, to: string): boolean {
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to;
}

function monthKey(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
}

function formatAmount(n: number, symbol: string) {
  return `${symbol}${n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortName(s: string, max = 22): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export default function StatementsPage() {
  const { data: session } = useSession();
  const { symbol } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [preset, setPreset] = useState<Preset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [categoryTab, setCategoryTab] = useState<'expense' | 'income'>('expense');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [updatingCategoryId, setUpdatingCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) loadTransactions();
  }, [session?.user?.id]);

  const loadTransactions = async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false });
      if (error) throw error;
      setTransactions(data || []);
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  // ── Period filter ───────────────────────────────────────────────────────────
  const periodFiltered = useMemo(() => {
    if (preset === 'custom') {
      if (!customFrom || !customTo) return transactions;
      return transactions.filter((t) => isInRange(t.date, customFrom, customTo));
    }
    const range = presetToRange(preset);
    if (!range) return transactions;
    return transactions.filter((t) => isInRange(t.date, range.from, range.to));
  }, [transactions, preset, customFrom, customTo]);

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalIncome = useMemo(
    () => periodFiltered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [periodFiltered]
  );
  const totalExpenses = useMemo(
    () => periodFiltered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [periodFiltered]
  );
  const net = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // ── Avg daily expense (across days that had at least one expense) ────────────
  const avgDailyExpense = useMemo(() => {
    const days = new Set(
      periodFiltered.filter((t) => t.type === 'expense' && t.date).map((t) => t.date!)
    );
    return days.size > 0 ? totalExpenses / days.size : 0;
  }, [periodFiltered, totalExpenses]);

  // ── Biggest single expense ──────────────────────────────────────────────────
  const biggestExpense = useMemo(() => {
    const ex = periodFiltered.filter((t) => t.type === 'expense');
    return ex.length > 0 ? ex.reduce((m, t) => (t.amount > m.amount ? t : m), ex[0]) : null;
  }, [periodFiltered]);

  // ── Monthly cash-flow ───────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; income: number; expenses: number; net: number }> = {};
    periodFiltered.forEach((t) => {
      const m = monthKey(t.date);
      if (!map[m]) map[m] = { month: m, income: 0, expenses: 0, net: 0 };
      if (t.type === 'income') map[m].income += t.amount;
      else map[m].expenses += t.amount;
    });
    return Object.values(map)
      .map((d) => ({
        ...d,
        net: parseFloat((d.income - d.expenses).toFixed(2)),
        income: parseFloat(d.income.toFixed(2)),
        expenses: parseFloat(d.expenses.toFixed(2)),
      }))
      .reverse();
  }, [periodFiltered]);

  // ── Category breakdowns ─────────────────────────────────────────────────────
  const expenseCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    periodFiltered.filter((t) => t.type === 'expense').forEach((t) => {
      const k = t.category || 'Other';
      map[k] = (map[k] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, value], i) => ({ name, value: parseFloat(value.toFixed(2)), color: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [periodFiltered]);

  const incomeCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    periodFiltered.filter((t) => t.type === 'income').forEach((t) => {
      const k = t.category || 'Other';
      map[k] = (map[k] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, value], i) => ({ name, value: parseFloat(value.toFixed(2)), color: INCOME_COLORS[i % INCOME_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [periodFiltered]);

  const activeCategoryData = categoryTab === 'expense' ? expenseCategoryData : incomeCategoryData;
  const activeCategoryTotal = categoryTab === 'expense' ? totalExpenses : totalIncome;

  // ── Stacked category trend (top-5 expense categories over months) ───────────
  const top5ExpenseCategories = expenseCategoryData.slice(0, 5).map((c) => c.name);
  const stackedCategoryTrend = useMemo(() => {
    const monthMap: Record<string, Record<string, number>> = {};
    periodFiltered.filter((t) => t.type === 'expense').forEach((t) => {
      const m = monthKey(t.date);
      const cat = t.category || 'Other';
      if (!monthMap[m]) monthMap[m] = {};
      if (top5ExpenseCategories.includes(cat)) {
        monthMap[m][cat] = (monthMap[m][cat] || 0) + t.amount;
      }
    });
    return Object.entries(monthMap)
      .map(([month, cats]) => ({
        month,
        ...Object.fromEntries(top5ExpenseCategories.map((c) => [c, parseFloat((cats[c] || 0).toFixed(2))])),
      }))
      .reverse();
  }, [periodFiltered, top5ExpenseCategories.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Top expense counterparties ──────────────────────────────────────────────
  const topCounterparties = useMemo(() => {
    const map: Record<string, number> = {};
    periodFiltered.filter((t) => t.type === 'expense').forEach((t) => {
      const k = t.counterparty || t.description || 'Unknown';
      map[k] = (map[k] || 0) + t.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name: shortName(name), value: parseFloat(value.toFixed(2)) }));
  }, [periodFiltered]);

  // ── Top income sources ──────────────────────────────────────────────────────
  const topIncomeSources = useMemo(() => {
    const map: Record<string, number> = {};
    periodFiltered.filter((t) => t.type === 'income').forEach((t) => {
      const k = t.counterparty || t.description || 'Unknown';
      map[k] = (map[k] || 0) + t.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name: shortName(name), value: parseFloat(value.toFixed(2)) }));
  }, [periodFiltered]);

  // ── Day-of-week pattern ─────────────────────────────────────────────────────
  const dayOfWeekData = useMemo(() => {
    const counts: number[] = new Array(7).fill(0);
    const totals: number[] = new Array(7).fill(0);
    periodFiltered.filter((t) => t.type === 'expense' && t.date).forEach((t) => {
      // getDay() returns 0=Sun..6=Sat; remap to 0=Mon..6=Sun
      const raw = new Date(t.date!).getDay();
      const d = raw === 0 ? 6 : raw - 1;
      totals[d] += t.amount;
      counts[d]++;
    });
    return DAY_NAMES.map((day, i) => ({
      day,
      avg: counts[i] > 0 ? parseFloat((totals[i] / counts[i]).toFixed(2)) : 0,
      total: parseFloat(totals[i].toFixed(2)),
    }));
  }, [periodFiltered]);

  // ── Cumulative net balance over time ────────────────────────────────────────
  const cumulativeBalance = useMemo(() => {
    const sorted = [...periodFiltered]
      .filter((t) => t.date)
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
    let running = 0;
    const points: { date: string; balance: number }[] = [];
    sorted.forEach((t) => {
      running += t.type === 'income' ? t.amount : -t.amount;
      const last = points[points.length - 1];
      if (last && last.date === t.date!) {
        last.balance = parseFloat(running.toFixed(2));
      } else {
        points.push({ date: t.date!, balance: parseFloat(running.toFixed(2)) });
      }
    });
    return points;
  }, [periodFiltered]);

  // ── Transaction table (search + type filter) ────────────────────────────────
  const filtered = useMemo(() => {
    return periodFiltered.filter((t) => {
      if (drillCategory && t.category !== drillCategory) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      const q = search.toLowerCase();
      if (q && !t.description?.toLowerCase().includes(q) &&
          !t.counterparty?.toLowerCase().includes(q) &&
          !t.category?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [periodFiltered, typeFilter, search, drillCategory]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      const response = await fetch('/api/delete-all-transactions', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear');
      const data = await response.json();
      setTransactions([]);
      setConfirmClear(false);
      toast.success(`Deleted ${data.deleted} transactions`);
    } catch {
      toast.error('Failed to clear transactions');
    } finally {
      setClearingAll(false);
    }
  };

  const handleUpdateCategory = async (id: string, category: string) => {
    setUpdatingCategoryId(id);
    try {
      const res = await fetch('/api/update-transaction', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, category }),
      });
      if (!res.ok) throw new Error();
      setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, category } : t));
      toast.success('Category updated');
    } catch {
      toast.error('Failed to update category');
    } finally {
      setUpdatingCategoryId(null);
      setEditingCategoryId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/delete-transaction?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      toast.success('Transaction deleted');
    } catch {
      toast.error('Failed to delete transaction');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Loading / empty ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="h-48 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileText className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No statement data yet</h2>
        <p className="text-gray-500 mb-6">Upload a full bank statement to see your P&L breakdown.</p>
        <Link
          href="/dashboard/upload"
          className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          <Upload className="w-4 h-4" />
          Upload Statement
        </Link>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header + period + clear ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Statements</h1>
          <p className="text-gray-600 mt-1">P&L breakdown from your bank statements</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
            {([
              ['all', 'All'],
              ['this_month', 'This month'],
              ['last_month', 'Last month'],
              ['3m', '3 months'],
              ['6m', '6 months'],
              ['custom', 'Custom'],
            ] as [Preset, string][]).map(([p, label]) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  preset === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">—</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear All
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-700 font-medium">Delete all {transactions.length}?</span>
              <button onClick={handleClearAll} disabled={clearingAll}
                className="px-2.5 py-1 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition">
                {clearingAll ? '...' : 'Yes'}
              </button>
              <button onClick={() => setConfirmClear(false)}
                className="px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Income</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatAmount(totalIncome, symbol)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Expenses</p>
          </div>
          <p className="text-2xl font-bold text-red-700">{formatAmount(totalExpenses, symbol)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${net >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
              <DollarSign className={`w-4 h-4 ${net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Net</p>
          </div>
          <p className={`text-2xl font-bold ${net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {net >= 0 ? '+' : ''}{formatAmount(Math.abs(net), symbol)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Transactions</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{periodFiltered.length}</p>
        </div>
      </div>

      {/* ── Insights row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Savings rate */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-semibold text-gray-700">Savings Rate</p>
          </div>
          <p className={`text-3xl font-bold ${savingsRate >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
            {savingsRate.toFixed(1)}%
          </p>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${savingsRate >= 20 ? 'bg-indigo-500' : savingsRate >= 0 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${Math.min(Math.max(savingsRate, 0), 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{savingsRate >= 20 ? 'Healthy ✓' : savingsRate >= 0 ? 'Below target' : 'Spending > Income'}</p>
        </div>

        {/* Avg daily spend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-orange-500" />
            <p className="text-sm font-semibold text-gray-700">Avg Daily Spend</p>
          </div>
          <p className="text-3xl font-bold text-orange-600">{formatAmount(avgDailyExpense, symbol)}</p>
          <p className="text-xs text-gray-400 mt-2">per day with at least one expense</p>
        </div>

        {/* Biggest expense */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-gray-700">Biggest Expense</p>
          </div>
          {biggestExpense ? (
            <>
              <p className="text-3xl font-bold text-red-600">{formatAmount(biggestExpense.amount, symbol)}</p>
              <p className="text-xs text-gray-500 mt-2 truncate">{biggestExpense.description || biggestExpense.counterparty || '—'}</p>
              <p className="text-xs text-gray-400">{biggestExpense.category} · {biggestExpense.date}</p>
            </>
          ) : (
            <p className="text-gray-400 text-sm">No expenses</p>
          )}
        </div>
      </div>

      {/* ── Monthly cash-flow bar chart ── */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Monthly Cash Flow</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData} margin={{ left: 8, right: 8 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v) => formatAmount(Number(v), symbol)} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Cumulative balance (area) ── */}
      {cumulativeBalance.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Running Balance</h2>
          <p className="text-xs text-gray-400 mb-6">Cumulative net (income − expenses) over time</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cumulativeBalance} margin={{ left: 8, right: 8 }}>
              <defs>
                <linearGradient id="balGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v) => formatAmount(Number(v), symbol)} labelFormatter={(l) => `Date: ${l}`} />
              <Area type="monotone" dataKey="balance" name="Balance" stroke="#6366f1" strokeWidth={2} fill="url(#balGradient)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Category breakdown: Pie + bars ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg mb-5 w-fit">
            {(['expense', 'income'] as const).map((tab) => (
              <button key={tab} onClick={() => { setCategoryTab(tab); setDrillCategory(null); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition capitalize ${
                  categoryTab === tab
                    ? `bg-white shadow-sm ${tab === 'expense' ? 'text-red-700' : 'text-green-700'}`
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {tab === 'expense' ? 'Expenses' : 'Income'}
              </button>
            ))}
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {categoryTab === 'expense' ? 'Expense' : 'Income'} Breakdown
            {drillCategory && (
              <button onClick={() => setDrillCategory(null)}
                className="ml-2 text-xs font-normal text-blue-600 hover:underline">
                ✕ {drillCategory}
              </button>
            )}
          </h2>
          {activeCategoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={activeCategoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                  paddingAngle={3} dataKey="value" style={{ cursor: 'pointer' }}
                  onClick={(d: { name?: string }) => {
                    if (!d.name) return;
                    setDrillCategory((prev) => (prev === d.name ? null : d.name!));
                  }}>
                  {activeCategoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color}
                      opacity={drillCategory && drillCategory !== entry.name ? 0.25 : 1} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [formatAmount(Number(v), symbol), 'Amount']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
          <p className="text-xs text-gray-400 text-center mt-1">Click a slice to drill down</p>
        </div>

        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">
            Top {categoryTab === 'expense' ? 'Expense' : 'Income'} Categories
          </h2>
          <div className="space-y-3">
            {activeCategoryData.slice(0, 8).map((cat) => {
              const pct = activeCategoryTotal > 0 ? (cat.value / activeCategoryTotal) * 100 : 0;
              const isDrill = drillCategory === cat.name;
              return (
                <div key={cat.name} className={`cursor-pointer rounded-lg p-1 transition ${isDrill ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50'}`}
                  onClick={() => setDrillCategory((prev) => (prev === cat.name ? null : cat.name))}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                      <span className="text-sm text-gray-700 truncate">{cat.name}</span>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <span className="text-sm font-semibold text-gray-900">{formatAmount(cat.value, symbol)}</span>
                      <span className="text-xs text-gray-400 ml-1">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cat.color }} />
                  </div>
                </div>
              );
            })}
          </div>
          {drillCategory && (
            <p className="text-xs text-blue-600 mt-3">
              Showing transactions for <strong>{drillCategory}</strong> in the table below.
              <button onClick={() => setDrillCategory(null)} className="ml-1 underline">Clear filter</button>
            </p>
          )}
        </div>
      </div>

      {/* ── Stacked category trend ── */}
      {stackedCategoryTrend.length > 1 && top5ExpenseCategories.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Expense Category Trend</h2>
          <p className="text-xs text-gray-400 mb-6">Top 5 expense categories month over month</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stackedCategoryTrend} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v) => formatAmount(Number(v), symbol)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {top5ExpenseCategories.map((cat, i) => (
                <Bar key={cat} dataKey={cat} stackId="a" fill={STACK_COLORS[i]}
                  radius={i === top5ExpenseCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top counterparties + income sources ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top expense counterparties */}
        {topCounterparties.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Where Money Goes</h2>
            <div className="space-y-2">
              {topCounterparties.map((cp, i) => {
                const pct = totalExpenses > 0 ? (cp.value / totalExpenses) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{i + 1}</span>
                        <span className="text-sm text-gray-700 truncate">{cp.name}</span>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <span className="text-sm font-semibold text-red-700">{formatAmount(cp.value, symbol)}</span>
                        <span className="text-xs text-gray-400 ml-1">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top income sources */}
        {topIncomeSources.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Where Money Comes From</h2>
            <div className="space-y-2">
              {topIncomeSources.map((src, i) => {
                const pct = totalIncome > 0 ? (src.value / totalIncome) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{i + 1}</span>
                        <span className="text-sm text-gray-700 truncate">{src.name}</span>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <span className="text-sm font-semibold text-green-700">{formatAmount(src.value, symbol)}</span>
                        <span className="text-xs text-gray-400 ml-1">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Day-of-week pattern ── */}
      {dayOfWeekData.some((d) => d.total > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Spending by Day of Week</h2>
          <p className="text-xs text-gray-400 mb-6">Average expense per transaction day</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dayOfWeekData} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={55} />
              <Tooltip
                formatter={(v, name) => [formatAmount(Number(v), symbol), name === 'avg' ? 'Avg per day' : 'Total']}
              />
              <Bar dataKey="avg" name="avg" fill="#f97316" radius={[4, 4, 0, 0]}>
                {dayOfWeekData.map((entry, i) => {
                  const max = Math.max(...dayOfWeekData.map((d) => d.avg));
                  return <Cell key={i} fill={entry.avg === max ? '#ef4444' : '#f97316'} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Transaction table ── */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">All Transactions</h2>
            {drillCategory && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
                {drillCategory}
                <button onClick={() => setDrillCategory(null)} className="hover:text-blue-900">✕</button>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search description, category, counterparty…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              {(['all', 'income', 'expense'] as const).map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition capitalize ${
                    typeFilter === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400">{filtered.length} transactions</p>
        </div>
        <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">No transactions match your filters.</p>
          ) : (
            filtered.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    t.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {t.type === 'income'
                      ? <TrendingUp className="w-4 h-4 text-green-600" />
                      : <TrendingDown className="w-4 h-4 text-red-600" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {t.description || t.counterparty || '—'}
                    </p>
                    <div className="flex items-center gap-2">
                      {editingCategoryId === t.id ? (
                        <select
                          autoFocus
                          defaultValue={t.category || ''}
                          disabled={updatingCategoryId === t.id}
                          onChange={(e) => handleUpdateCategory(t.id, e.target.value)}
                          onBlur={() => setEditingCategoryId(null)}
                          className="text-xs border border-blue-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          {(t.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setDrillCategory((prev) => (prev === t.category ? null : t.category))}
                            className={`inline-block px-1.5 py-0.5 text-xs rounded font-medium cursor-pointer transition ${
                              t.type === 'income'
                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                : 'bg-red-50 text-red-700 hover:bg-red-100'
                            }`}
                          >
                            {t.category || 'Other'}
                          </button>
                          <button
                            onClick={() => setEditingCategoryId(t.id)}
                            className="opacity-0 group-hover:opacity-100 transition p-0.5 rounded text-gray-300 hover:text-blue-500 hover:bg-blue-50"
                            title="Edit category"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {t.date && (
                        <span className="text-xs text-gray-400">
                          {new Date(t.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <p className={`text-sm font-semibold ${t.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                    {t.type === 'income' ? '+' : '−'}{formatAmount(t.amount, symbol)}
                  </p>
                  <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}
                    className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
