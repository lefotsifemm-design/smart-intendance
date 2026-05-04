'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import {
  Building2, RefreshCw, Upload, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Target, AlertTriangle, CheckCircle2, Wifi, WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string | null;
  description: string;
  counterparty: string | null;
}

interface Budget {
  id: string;
  category: string;
  amount: number;
}

interface BankStatus {
  connected: boolean;
  expired?: boolean;
  companyName?: string;
  accountNumber?: string;
  lastSyncAt?: string;
}

function formatAmount(n: number, symbol: string) {
  return `${symbol}${n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function currentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { symbol } = useCurrency();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bank, setBank] = useState<BankStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (session?.user?.id) loadAll();
  }, [session?.user?.id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { from, to } = currentMonthRange();

      const [txRes, budgetRes, bankRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, type, category, amount, date, description, counterparty')
          .eq('user_id', session!.user!.id)
          .gte('date', from)
          .lte('date', to)
          .order('date', { ascending: false }),
        fetch('/api/budgets').then((r) => r.json()),
        fetch('/api/tbank/status').then((r) => r.json()),
      ]);

      if (txRes.data) setTransactions(txRes.data);
      if (Array.isArray(budgetRes)) setBudgets(budgetRes);
      setBank(bankRes);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/tbank/sync', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`Sync failed: ${json.error ?? res.status}`);
        return;
      }
      if (json.synced > 0) {
        toast.success(`Синхронизировано ${json.synced} транзакций`);
      } else {
        toast.success(json.message ?? 'Нет новых транзакций');
      }
      loadAll();
    } catch {
      toast.error('Sync failed: network error');
    } finally {
      setSyncing(false);
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

  const spendByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type === 'expense') map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return map;
  }, [transactions]);

  const budgetAlerts = useMemo(
    () =>
      budgets
        .map((b) => ({ ...b, spent: spendByCategory.get(b.category) ?? 0 }))
        .filter((b) => b.spent / b.amount >= 0.8)
        .sort((a, b) => b.spent / b.amount - a.spent / a.amount),
    [budgets, spendByCategory]
  );

  const recentTx = transactions.slice(0, 8);

  const monthName = new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1 capitalize">{monthName}</p>
        </div>
        <div className="flex items-center gap-2">
          {bank?.connected && !bank.expired && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync bank'}
            </button>
          )}
          <Link
            href="/dashboard/upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
          >
            <Upload className="w-4 h-4" />
            Upload
          </Link>
        </div>
      </div>

      {/* Bank connection banner */}
      {bank && (
        <div className={`flex items-center justify-between p-4 rounded-xl border ${
          bank.connected && !bank.expired
            ? 'bg-green-50 border-green-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-center gap-3">
            {bank.connected && !bank.expired
              ? <Wifi className="w-5 h-5 text-green-600" />
              : <WifiOff className="w-5 h-5 text-amber-600" />}
            <div>
              <p className={`text-sm font-semibold ${bank.connected && !bank.expired ? 'text-green-800' : 'text-amber-800'}`}>
                {bank.connected && !bank.expired
                  ? `Т-Банк connected${bank.companyName ? ` · ${bank.companyName}` : ''}`
                  : bank.expired
                    ? 'Т-Банк token expired — reconnect required'
                    : 'No bank connected'}
              </p>
              {bank.lastSyncAt && (
                <p className="text-xs text-green-600 mt-0.5">
                  Last sync: {new Date(bank.lastSyncAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          {(!bank.connected || bank.expired) && (
            <Link
              href="/dashboard/settings"
              className="text-sm font-semibold text-amber-700 hover:text-amber-900 transition"
            >
              Connect →
            </Link>
          )}
        </div>
      )}

      {/* P&L cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Income</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatAmount(totalIncome, symbol)}</p>
          <p className="text-xs text-gray-400 mt-1">Current month</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Expenses</p>
          </div>
          <p className="text-2xl font-bold text-red-700">{formatAmount(totalExpenses, symbol)}</p>
          <p className="text-xs text-gray-400 mt-1">Current month</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${net >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
              {net >= 0
                ? <TrendingUp className="w-4 h-4 text-blue-600" />
                : <TrendingDown className="w-4 h-4 text-orange-600" />}
            </div>
            <p className="text-sm text-gray-500 font-medium">Net profit</p>
          </div>
          <p className={`text-2xl font-bold ${net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {net >= 0 ? '+' : ''}{formatAmount(net, symbol)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Current month</p>
        </div>
      </div>

      {/* Budget alerts + Recent transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Budget alerts */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 text-sm">Budget Alerts</h2>
            </div>
            <Link href="/dashboard/budgets" className="text-xs text-blue-600 hover:text-blue-800 transition">
              All budgets →
            </Link>
          </div>
          <div className="p-3">
            {budgetAlerts.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-400 mb-2" />
                <p className="text-sm text-gray-500">All budgets on track</p>
              </div>
            ) : (
              <div className="space-y-2">
                {budgetAlerts.map((b) => {
                  const pct = Math.min(100, (b.spent / b.amount) * 100);
                  const over = b.spent > b.amount;
                  return (
                    <div key={b.id} className="p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className={`w-3.5 h-3.5 ${over ? 'text-red-500' : 'text-yellow-500'}`} />
                          <span className="text-sm font-medium text-gray-800">{b.category}</span>
                        </div>
                        <span className={`text-xs font-semibold ${over ? 'text-red-600' : 'text-yellow-600'}`}>
                          {Math.round(pct)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full">
                        <div
                          className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-yellow-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatAmount(b.spent, symbol)} / {formatAmount(b.amount, symbol)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Recent Transactions</h2>
            <Link href="/dashboard/statements" className="text-xs text-blue-600 hover:text-blue-800 transition">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentTx.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Building2 className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 mb-3">No transactions this month</p>
                <Link
                  href="/dashboard/upload"
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                >
                  Upload a statement →
                </Link>
              </div>
            ) : (
              recentTx.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    t.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {t.type === 'income'
                      ? <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                      : <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {t.description || t.counterparty || '—'}
                    </p>
                    <p className="text-xs text-gray-400">{t.category}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${t.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                      {t.type === 'income' ? '+' : '−'}{formatAmount(t.amount, symbol)}
                    </p>
                    {t.date && (
                      <p className="text-xs text-gray-400">
                        {new Date(t.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
