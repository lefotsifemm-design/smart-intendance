'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { TrendingUp, DollarSign, Calendar, Package, Edit2, Trash2, Plus, Search, Upload, Download, RotateCcw, ChevronDown, ChevronUp, Target, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';
import SubscriptionModal from '@/components/subscription-modal';
import Onboarding from '@/components/onboarding';
import { useCurrency } from '@/hooks/use-currency';
import { CATEGORIES } from '@/lib/constants';
import { calculateHealthScore } from '@/lib/health-score';

interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  category: string;
  source: string;
  last_charge: string | null;
  created_at: string;
  deleted_at: string | null;
}

function getNextBillingDate(sub: Subscription): Date {
  const base = sub.last_charge ? new Date(sub.last_charge) : new Date(sub.created_at);
  const next = new Date(base);
  const now = new Date();
  if (sub.frequency === 'annual') {
    next.setFullYear(next.getFullYear() + 1);
    while (next <= now) next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
    while (next <= now) next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function formatNextBilling(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isDueSoon(date: Date): boolean {
  const diffDays = (date.getTime() - Date.now()) / 86_400_000;
  return diffDays >= 0 && diffDays <= 7;
}

function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1mo ago' : `${months}mo ago`;
}

type ModalMode = 'edit' | 'add' | null;

const EMPTY_FORM = { name: '', amount: '', frequency: 'monthly', category: '' };

export default function DashboardPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const { symbol } = useCurrency();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrequency, setFilterFrequency] = useState('');
  const [trashedSubscriptions, setTrashedSubscriptions] = useState<Subscription[]>([]);
  const [trashOpen, setTrashOpen] = useState(false);
  const [confirmingPermDeleteId, setConfirmingPermDeleteId] = useState<string | null>(null);
  const [hasTransactions, setHasTransactions] = useState<boolean | null>(null);
  const [allTransactions, setAllTransactions] = useState<{ type: 'income' | 'expense'; amount: number; date: string | null; category: string }[]>([]);
  const [budgets, setBudgets] = useState<{ id: string; category: string; amount: number }[]>([]);

  useEffect(() => {
    if (session?.user?.id) {
      loadSubscriptions();
      loadTrashed();
      loadTransactionsAndBudgets();
    }
  }, [session?.user?.id]);

  const loadTransactionsAndBudgets = async () => {
    if (!session?.user?.id) return;
    try {
      const [txResult, budgetResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('type, amount, date, category')
          .eq('user_id', session.user.id),
        fetch('/api/budgets').then((r) => r.json()).catch(() => []),
      ]);
      const txData = txResult.data ?? [];
      setAllTransactions(txData as typeof allTransactions);
      setHasTransactions(txData.length > 0);
      if (Array.isArray(budgetResult)) setBudgets(budgetResult);
    } catch {
      setHasTransactions(false);
    }
  };

  const loadSubscriptions = async () => {
    if (!session?.user?.id) return;
    try {
      // Try with deleted_at filter first; if column doesn't exist fall back without it
      let query = supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id);

      const { data, error } = await query
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        // deleted_at or created_at column missing — fetch without them
        const { data: fallback, error: fallbackError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', session.user.id);
        if (fallbackError) throw fallbackError;
        setSubscriptions((fallback || []).filter((s: Subscription) => !s.deleted_at));
      } else {
        setSubscriptions(data || []);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const loadTrashed = async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) {
        // deleted_at column doesn't exist yet — skip trash silently
        setTrashedSubscriptions([]);
        return;
      }
      setTrashedSubscriptions(data || []);
    } catch {
      setTrashedSubscriptions([]);
    }
  };

  const openEditModal = (subscription: Subscription) => {
    setEditingId(subscription.id);
    setFormData({
      name: subscription.name,
      amount: subscription.amount.toString(),
      frequency: subscription.frequency,
      category: subscription.category || '',
    });
    setModalMode('edit');
  };

  const openAddModal = () => {
    setFormData(EMPTY_FORM);
    setModalMode('add');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return false;
    }
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Amount must be a positive number');
      return false;
    }
    return true;
  };

  const saveSubscription = async () => {
    if (!editingId || !validateForm()) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          name: formData.name.trim(),
          amount: parseFloat(formData.amount),
          frequency: formData.frequency,
          category: formData.category.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (error) throw error;
      toast.success('Subscription updated');
      closeModal();
      loadSubscriptions();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Failed to update subscription');
    } finally {
      setIsSaving(false);
    }
  };

  const addSubscription = async () => {
    if (!validateForm()) return;
    if (!session?.user?.id) {
      toast.error('Not authenticated');
      return;
    }

    const trimmedName = formData.name.trim();
    const duplicate = subscriptions.find(
      (s) => s.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      toast.warning(`You already have "${duplicate.name}" — adding anyway`);
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from('subscriptions').insert({
        user_id: session.user.id,
        name: trimmedName,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        category: formData.category.trim() || null,
        source: 'manual',
        confidence: 100,
      });

      if (error) throw error;
      toast.success(`${trimmedName} added`);
      closeModal();
      loadSubscriptions();
    } catch (error) {
      console.error('Error adding subscription:', error);
      toast.error('Failed to add subscription');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSubscription = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success(`${name} moved to trash`);
      setConfirmingDeleteId(null);
      loadSubscriptions();
      if (trashOpen) loadTrashed();
    } catch (error) {
      console.error('Error deleting subscription:', error);
      toast.error('Failed to delete subscription');
    }
  };

  const restoreSubscription = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ deleted_at: null })
        .eq('id', id);
      if (error) throw error;
      toast.success(`${name} restored`);
      loadSubscriptions();
      loadTrashed();
    } catch {
      toast.error('Failed to restore subscription');
    }
  };

  const permanentlyDelete = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from('subscriptions').delete().eq('id', id);
      if (error) throw error;
      toast.success(`${name} permanently deleted`);
      setConfirmingPermDeleteId(null);
      loadTrashed();
    } catch {
      toast.error('Failed to permanently delete');
    }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Amount', 'Frequency', 'Category', 'Next Billing', 'Source'];
    const rows = subscriptions.map((sub) => {
      const next = formatNextBilling(getNextBillingDate(sub));
      return [
        `"${sub.name.replace(/"/g, '""')}"`,
        sub.amount,
        sub.frequency,
        sub.category || '',
        next,
        sub.source,
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (search && !sub.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory && sub.category !== filterCategory) return false;
    if (filterFrequency && sub.frequency !== filterFrequency) return false;
    return true;
  });

  const hasActiveFilters = search !== '' || filterCategory !== '' || filterFrequency !== '';

  const totalMonthly = subscriptions.reduce((sum, sub) => {
    return sum + (sub.frequency === 'annual' ? sub.amount / 12 : sub.amount);
  }, 0);

  const totalAnnual = totalMonthly * 12;

  const monthlyOf = (sub: Subscription) =>
    sub.frequency === 'annual' ? sub.amount / 12 : sub.amount;

  const duplicateCategories = CATEGORIES.flatMap((cat) => {
    const inCat = subscriptions.filter((s) => s.category === cat);
    if (inCat.length < 2) return [];
    const catMonthly = inCat.map(monthlyOf);
    const savings = catMonthly.reduce((a, b) => a + b, 0) - Math.min(...catMonthly);
    return [{ category: cat, count: inCat.length, savings }];
  });

  const potentialSavings = duplicateCategories.reduce((sum, d) => sum + d.savings, 0);

  const healthScore = useMemo(() => calculateHealthScore(allTransactions), [allTransactions]);

  const budgetSummary = useMemo(() => {
    if (budgets.length === 0) return null;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const monthExpenses = allTransactions.filter(
      (t) => t.type === 'expense' && t.date && t.date >= monthStart && t.date <= monthEnd
    );
    const spendByCat = new Map<string, number>();
    for (const t of monthExpenses) {
      spendByCat.set(t.category, (spendByCat.get(t.category) ?? 0) + t.amount);
    }
    let totalBudget = 0;
    let totalSpent = 0;
    let overCount = 0;
    for (const b of budgets) {
      totalBudget += b.amount;
      const spent = spendByCat.get(b.category) ?? 0;
      totalSpent += spent;
      if (spent > b.amount) overCount++;
    }
    return { totalBudget, totalSpent, overCount, pct: totalBudget > 0 ? totalSpent / totalBudget : 0 };
  }, [budgets, allTransactions]);

  const isNewUser = !loading && hasTransactions === false && subscriptions.length === 0;

  if (isNewUser) {
    return <Onboarding />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Track and optimize your SaaS subscriptions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            Quick Add
          </button>
          <Link
            href="/dashboard/upload"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition font-semibold"
          >
            Upload CSV
          </Link>
          {subscriptions.length > 0 && (
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Subscriptions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{subscriptions.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Spend</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{symbol}{totalMonthly.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Annual Spend</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{symbol}{totalAnnual.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm text-gray-600">Potential Savings</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {symbol}{potentialSavings.toFixed(2)}
                {potentialSavings > 0 && <span className="text-sm font-normal text-gray-500">/mo</span>}
              </p>
              {duplicateCategories.length > 0 && (
                <p className="text-xs text-orange-600 mt-1 truncate">
                  {duplicateCategories.map((d) => `${d.count}× ${d.category}`).join(' · ')}
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Health Score & Budget Summary */}
      {(allTransactions.length > 0 || budgetSummary) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Health Score */}
          {allTransactions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Financial Health</h3>
                </div>
                <div className={`text-3xl font-bold ${
                  healthScore.grade === 'A' ? 'text-green-600' :
                  healthScore.grade === 'B' ? 'text-blue-600' :
                  healthScore.grade === 'C' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {healthScore.score}
                  <span className="text-lg font-medium text-gray-400 ml-1">/ 100</span>
                </div>
              </div>
              <div className="space-y-2">
                {healthScore.breakdown.map((b) => (
                  <div key={b.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">{b.label}</span>
                      <span className="text-gray-400">{b.score}/{b.max}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          b.score / b.max >= 0.7 ? 'bg-green-500' : b.score / b.max >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${(b.score / b.max) * 100}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{b.tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget Summary */}
          {budgetSummary && (
            <Link href="/dashboard/budgets" className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition block">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Budget This Month</h3>
                </div>
                {budgetSummary.overCount > 0 && (
                  <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    {budgetSummary.overCount} over
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className={`text-3xl font-bold ${budgetSummary.pct > 1 ? 'text-red-600' : 'text-gray-900'}`}>
                  {symbol}{budgetSummary.totalSpent.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <span className="text-sm text-gray-400">
                  / {symbol}{budgetSummary.totalBudget.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    budgetSummary.pct > 1 ? 'bg-red-500' : budgetSummary.pct > 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, budgetSummary.pct * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {Math.round(budgetSummary.pct * 100)}% of monthly budget used
              </p>
            </Link>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Subscriptions</h2>
          {subscriptions.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={filterFrequency}
                onChange={(e) => setFilterFrequency(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All billing</option>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearch(''); setFilterCategory(''); setFilterFrequency(''); }}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
        <div className="p-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg animate-pulse"
                >
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="h-6 bg-gray-200 rounded w-20 mb-1"></div>
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-9 h-9 bg-gray-200 rounded-lg"></div>
                      <div className="w-9 h-9 bg-gray-200 rounded-lg"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="py-12">
              <div className="text-center mb-10">
                <Package className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No subscriptions yet</h3>
                <p className="text-gray-500 text-sm">Choose how you want to get started:</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                <button
                  onClick={openAddModal}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-center"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Plus className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Quick Add</p>
                    <p className="text-xs text-gray-500 mt-0.5">Type in one subscription manually</p>
                  </div>
                </button>
                <Link
                  href="/dashboard/upload"
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition text-center"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Upload className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Upload CSV</p>
                    <p className="text-xs text-gray-500 mt-0.5">Import from a bank statement — AI finds all subs</p>
                  </div>
                </Link>
              </div>
            </div>
          ) : filteredSubscriptions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500 text-sm">No subscriptions match your filters.</p>
              <button
                onClick={() => { setSearch(''); setFilterCategory(''); setFilterFrequency(''); }}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSubscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">{sub.name}</h3>
                    <p className="text-sm text-gray-600">
                      {sub.category} • {sub.frequency}
                    </p>
                    <p className="text-xs text-gray-400">{timeAgo(sub.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">{symbol}{sub.amount}</p>
                      {(() => {
                        const next = getNextBillingDate(sub);
                        const due = isDueSoon(next);
                        return (
                          <p className={`text-sm ${due ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                            Next: {formatNextBilling(next)}
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(sub)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit subscription"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      {confirmingDeleteId === sub.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteSubscription(sub.id, sub.name)}
                            className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmingDeleteId(null)}
                            className="px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-md transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingDeleteId(sub.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete subscription"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recycle Bin */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => {
            const next = !trashOpen;
            setTrashOpen(next);
            if (next) loadTrashed();
          }}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition rounded-xl"
        >
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-gray-400" />
            <span className="font-semibold text-gray-700">Trash</span>
            {trashedSubscriptions.length > 0 && (
              <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {trashedSubscriptions.length}
              </span>
            )}
          </div>
          {trashOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {trashOpen && (
          <div className="border-t border-gray-100">
            {trashedSubscriptions.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">Trash is empty</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {trashedSubscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between px-5 py-3 opacity-60 hover:opacity-100 transition">
                    <div>
                      <p className="font-medium text-gray-700 text-sm">{sub.name}</p>
                      <p className="text-xs text-gray-400">{sub.category} · {sub.frequency} · {symbol}{sub.amount}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => restoreSubscription(sub.id, sub.name)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Restore"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                      {confirmingPermDeleteId === sub.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => permanentlyDelete(sub.id, sub.name)}
                            className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition"
                          >
                            Delete forever
                          </button>
                          <button
                            onClick={() => setConfirmingPermDeleteId(null)}
                            className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-md transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingPermDeleteId(sub.id)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-md transition"
                          title="Delete permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modalMode && (
        <SubscriptionModal
          title={modalMode === 'edit' ? 'Edit Subscription' : 'Add Subscription'}
          formData={formData}
          onChange={setFormData}
          onConfirm={modalMode === 'edit' ? saveSubscription : addSubscription}
          onClose={closeModal}
          isSaving={isSaving}
          confirmLabel={modalMode === 'edit' ? 'Save Changes' : 'Add Subscription'}
        />
      )}
    </div>
  );
}
