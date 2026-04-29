'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { TrendingUp, DollarSign, Calendar, Package, Edit2, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import SubscriptionModal from '@/components/subscription-modal';
import { useCurrency } from '@/hooks/use-currency';

interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  category: string;
  source: string;
  last_charge: string | null;
  created_at: string;
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

  useEffect(() => {
    if (session?.user?.id) {
      loadSubscriptions();
    }
  }, [session?.user?.id]);

  const loadSubscriptions = async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
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

    setIsSaving(true);
    try {
      const { error } = await supabase.from('subscriptions').insert({
        user_id: session.user.id,
        name: formData.name.trim(),
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        category: formData.category.trim() || null,
        source: 'manual',
        confidence: 100,
      });

      if (error) throw error;
      toast.success(`${formData.name} added`);
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
      const { error } = await supabase.from('subscriptions').delete().eq('id', id);
      if (error) throw error;
      toast.success(`${name} deleted`);
      setConfirmingDeleteId(null);
      loadSubscriptions();
    } catch (error) {
      console.error('Error deleting subscription:', error);
      toast.error('Failed to delete subscription');
    }
  };

  const totalMonthly = subscriptions.reduce((sum, sub) => {
    return sum + (sub.frequency === 'annual' ? sub.amount / 12 : sub.amount);
  }, 0);

  const totalAnnual = totalMonthly * 12;

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
            <div>
              <p className="text-sm text-gray-600">Potential Savings</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{symbol}0.00</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Recent Subscriptions</h2>
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
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No subscriptions yet</h3>
              <p className="text-gray-600 mb-6">Add your first subscription to get started</p>
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-5 h-5" />
                Add Subscription
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">{sub.name}</h3>
                    <p className="text-sm text-gray-600">
                      {sub.category} • {sub.frequency}
                    </p>
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
