'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import {
  TrendingUp, TrendingDown, DollarSign, FileText,
  Upload, ArrowUpRight, ArrowDownRight, Trash2, Eraser,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
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

type Period = 'all' | '30d' | '90d' | '180d';

function isWithinDays(dateStr: string | null, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
}

function monthKey(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
}

function formatAmount(n: number, symbol: string) {
  return `${symbol}${n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function StatementsPage() {
  const { data: session } = useSession();
  const { symbol } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [categoryTab, setCategoryTab] = useState<'expense' | 'income'>('expense');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

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

  const periodFiltered = useMemo(() => {
    if (period === 'all') return transactions;
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 180;
    return transactions.filter((t) => isWithinDays(t.date, days));
  }, [transactions, period]);

  const totalIncome = useMemo(
    () => periodFiltered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [periodFiltered]
  );
  const totalExpenses = useMemo(
    () => periodFiltered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [periodFiltered]
  );
  const net = totalIncome - totalExpenses;

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

  const expenseCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    periodFiltered.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category || 'Other'] = (map[t.category || 'Other'] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, value], i) => ({ name, value: parseFloat(value.toFixed(2)), color: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [periodFiltered]);

  const incomeCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    periodFiltered.filter((t) => t.type === 'income').forEach((t) => {
      map[t.category || 'Other'] = (map[t.category || 'Other'] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, value], i) => ({ name, value: parseFloat(value.toFixed(2)), color: INCOME_COLORS[i % INCOME_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [periodFiltered]);

  const activeCategoryData = categoryTab === 'expense' ? expenseCategoryData : incomeCategoryData;
  const activeCategoryTotal = categoryTab === 'expense' ? totalExpenses : totalIncome;

  const filtered = useMemo(() => {
    return periodFiltered.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      const q = search.toLowerCase();
      if (q && !t.description?.toLowerCase().includes(q) &&
          !t.counterparty?.toLowerCase().includes(q) &&
          !t.category?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [periodFiltered, typeFilter, search]);

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

  return (
    <div className="space-y-6">
      {/* Header + period filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Statements</h1>
          <p className="text-gray-600 mt-1">P&L breakdown from your bank statements</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
            {(['all', '30d', '90d', '180d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p === 'all' ? 'All time' : p}
              </button>
            ))}
          </div>
          {/* Clear all */}
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
              <span className="text-xs text-red-700 font-medium">Delete all {transactions.length} transactions?</span>
              <button
                onClick={handleClearAll}
                disabled={clearingAll}
                className="px-2.5 py-1 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
              >
                {clearingAll ? '...' : 'Yes'}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
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

      {/* Monthly bar chart */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Monthly Cash Flow</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData} margin={{ left: 8, right: 8 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
                width={60}
              />
              <Tooltip formatter={(v) => formatAmount(Number(v), symbol)} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category breakdown (Income / Expense tabs) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Pie chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          {/* Tab toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg mb-5 w-fit">
            <button
              onClick={() => setCategoryTab('expense')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                categoryTab === 'expense' ? 'bg-white shadow-sm text-red-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Expenses
            </button>
            <button
              onClick={() => setCategoryTab('income')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                categoryTab === 'income' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Income
            </button>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {categoryTab === 'expense' ? 'Expense' : 'Income'} Breakdown
          </h2>
          {activeCategoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={activeCategoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {activeCategoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [formatAmount(Number(v), symbol), 'Amount']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
              No {categoryTab} data
            </div>
          )}
        </div>

        {/* Category bars */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">
            Top {categoryTab === 'expense' ? 'Expense' : 'Income'} Categories
          </h2>
          <div className="space-y-3">
            {activeCategoryData.slice(0, 8).map((cat) => {
              const pct = activeCategoryTotal > 0 ? (cat.value / activeCategoryTotal) * 100 : 0;
              return (
                <div key={cat.name}>
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
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transaction table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200 space-y-3">
          <h2 className="text-lg font-bold text-gray-900">All Transactions</h2>
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
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition capitalize ${
                    typeFilter === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
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
                      <span className={`inline-block px-1.5 py-0.5 text-xs rounded font-medium ${
                        t.type === 'income' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {t.category || 'Other'}
                      </span>
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
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deletingId === t.id}
                    className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 disabled:opacity-50"
                  >
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
