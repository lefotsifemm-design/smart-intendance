'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import { Plus, Trash2, Target, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Budget {
  id: string;
  category: string;
  amount: number;
  period: string;
}

interface Transaction {
  type: string;
  category: string;
  amount: number;
  date: string | null;
}

const EXPENSE_CATEGORIES = [
  'Payroll', 'Rent', 'Utilities', 'Marketing', 'IT & Software', 'Logistics',
  'Taxes', 'Insurance', 'Legal', 'Bank Fees', 'Office Supplies', 'Travel',
  'Meals', 'Groceries', 'Transfer Out', 'Other Expense',
  'Entertainment', 'Software', 'Music', 'Cloud Storage', 'Productivity',
  'Design', 'Education', 'News', 'Fitness', 'Food & Delivery',
  'Transportation', 'Gaming', 'Other',
];

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default function BudgetsPage() {
  const { data: session } = useSession();
  const { symbol } = useCurrency();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      loadData();
    }
  }, [session?.user?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [budgetRes, txRes] = await Promise.all([
        fetch('/api/budgets').then((r) => r.json()),
        loadMonthTransactions(),
      ]);
      if (Array.isArray(budgetRes)) setBudgets(budgetRes);
      setTransactions(txRes);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthTransactions = async (): Promise<Transaction[]> => {
    if (!session?.user?.id) return [];
    const { from, to } = currentMonthRange();
    const { data, error } = await supabase
      .from('transactions')
      .select('type, category, amount, date')
      .eq('user_id', session.user.id)
      .eq('type', 'expense')
      .gte('date', from)
      .lte('date', to);
    if (error) throw error;
    return data || [];
  };

  const spendByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return map;
  }, [transactions]);

  const addBudget = async () => {
    if (!newCategory || !newAmount) return;
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory, amount }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Budget set for ${newCategory}`);
      setNewCategory('');
      setNewAmount('');
      setAdding(false);
      loadData();
    } catch {
      toast.error('Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const deleteBudget = async (id: string, category: string) => {
    try {
      const res = await fetch('/api/budgets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${category} budget removed`);
      loadData();
    } catch {
      toast.error('Failed to delete budget');
    }
  };

  const usedCategories = new Set(budgets.map((b) => b.category));
  const availableCategories = EXPENSE_CATEGORIES.filter((c) => !usedCategories.has(c));

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (spendByCategory.get(b.category) ?? 0), 0);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budgets</h1>
          <p className="text-gray-600 mt-1">Set monthly limits per category and track spending</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          <Plus className="w-5 h-5" />
          Add Budget
        </button>
      </div>

      {/* Summary bar */}
      {budgets.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-600">Total Budget Usage</p>
            <p className="text-sm text-gray-500">
              {symbol}{totalSpent.toLocaleString('ru-RU', { minimumFractionDigits: 0 })} / {symbol}{totalBudget.toLocaleString('ru-RU', { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                totalSpent / totalBudget > 1 ? 'bg-red-500' : totalSpent / totalBudget > 0.8 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Add budget form */}
      {adding && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">New Budget</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select category</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{symbol}</span>
              <input
                type="number"
                placeholder="Monthly limit"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full sm:w-40 pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={addBudget}
              disabled={saving || !newCategory || !newAmount}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewCategory(''); setNewAmount(''); }}
              className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Budget cards */}
      {budgets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No budgets yet</h3>
          <p className="text-sm text-gray-500">Set monthly limits to track spending per category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget) => {
            const spent = spendByCategory.get(budget.category) ?? 0;
            const pct = budget.amount > 0 ? spent / budget.amount : 0;
            const over = pct > 1;
            const warning = pct > 0.8 && !over;

            return (
              <div key={budget.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {over ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : warning ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    <h3 className="font-semibold text-gray-900 text-sm">{budget.category}</h3>
                  </div>
                  <button
                    onClick={() => deleteBudget(budget.id, budget.category)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className={`text-2xl font-bold ${over ? 'text-red-600' : 'text-gray-900'}`}>
                    {symbol}{spent.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-sm text-gray-400">
                    / {symbol}{budget.amount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full transition-all ${
                      over ? 'bg-red-500' : warning ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, pct * 100)}%` }}
                  />
                </div>
                <p className={`text-xs ${over ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                  {over
                    ? `Over by ${symbol}${(spent - budget.amount).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : `${Math.round(pct * 100)}% used`
                  }
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
