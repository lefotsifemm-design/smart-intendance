'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import { TrendingUp, TrendingDown, DollarSign, FileText, Upload, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
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

const EXPENSE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1',
];

function monthKey(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export default function StatementsPage() {
  const { data: session } = useSession();
  const { symbol } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

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

  const totalIncome = useMemo(
    () => transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const totalExpenses = useMemo(
    () => transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const net = totalIncome - totalExpenses;

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; income: number; expenses: number; net: number }> = {};
    transactions.forEach((t) => {
      const m = monthKey(t.date);
      if (!map[m]) map[m] = { month: m, income: 0, expenses: 0, net: 0 };
      if (t.type === 'income') map[m].income += t.amount;
      else map[m].expenses += t.amount;
    });
    return Object.values(map)
      .map((d) => ({ ...d, net: parseFloat((d.income - d.expenses).toFixed(2)), income: parseFloat(d.income.toFixed(2)), expenses: parseFloat(d.expenses.toFixed(2)) }))
      .reverse();
  }, [transactions]);

  const expenseCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + t.amount;
      });
    return Object.entries(map)
      .map(([name, value], i) => ({ name, value: parseFloat(value.toFixed(2)), color: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (search && !t.description?.toLowerCase().includes(search.toLowerCase()) &&
          !t.counterparty?.toLowerCase().includes(search.toLowerCase()) &&
          !t.category?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, typeFilter, search]);

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Statements</h1>
        <p className="text-gray-600 mt-1">P&L breakdown from your bank statement</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-sm text-gray-500">Total Income</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{symbol}{totalIncome.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-sm text-gray-500">Total Expenses</p>
          </div>
          <p className="text-2xl font-bold text-red-700">{symbol}{totalExpenses.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${net >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
              <DollarSign className={`w-4 h-4 ${net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
            <p className="text-sm text-gray-500">Net</p>
          </div>
          <p className={`text-2xl font-bold ${net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {net >= 0 ? '+' : ''}{symbol}{Math.abs(net).toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-sm text-gray-500">Transactions</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{transactions.length}</p>
        </div>
      </div>

      {/* Charts */}
      {monthlyData.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Monthly Cash Flow</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${symbol}${v}`} tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v) => `${symbol}${Number(v).toFixed(2)}`} />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} dot={false} name="Income" />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} name="Expenses" />
              <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="4 2" name="Net" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {expenseCategoryData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Expense Breakdown</h2>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={expenseCategoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value">
                  {expenseCategoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${symbol}${Number(v).toFixed(2)}`, 'Amount']} />
                <Legend formatter={(v) => <span className="text-xs text-gray-700">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Top Expense Categories</h2>
          <div className="space-y-3">
            {expenseCategoryData.slice(0, 6).map((cat) => (
              <div key={cat.name} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-700 truncate">{cat.name}</span>
                    <span className="text-sm font-semibold text-gray-900 ml-2">{symbol}{cat.value.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(cat.value / expenseCategoryData[0].value) * 100}%`, background: cat.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
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
              placeholder="Search description, counterparty, category…"
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
        </div>
        <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">No transactions match your filters.</p>
          ) : (
            filtered.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    t.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {t.type === 'income'
                      ? <TrendingUp className="w-4 h-4 text-green-600" />
                      : <TrendingDown className="w-4 h-4 text-red-600" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.description || t.counterparty || '—'}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {t.category}{t.date ? ` · ${new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                    </p>
                  </div>
                </div>
                <p className={`text-sm font-semibold ml-4 shrink-0 ${t.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                  {t.type === 'income' ? '+' : '-'}{symbol}{t.amount.toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
