'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';  // ← Добавь это!
import { supabase } from '@/lib/supabase';
import { TrendingUp, DollarSign, Calendar, Package, Edit2, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  category: string;
  source: string;
}

// Популярные категории подписок
const CATEGORIES = [
  'Entertainment',
  'Software',
  'Music',
  'Cloud Storage',
  'Productivity',
  'Design',
  'Education',
  'News',
  'Fitness',
  'Food & Delivery',
  'Transportation',
  'Gaming',
  'Other',
];

export default function DashboardPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state для редактирования
  const [editFormData, setEditFormData] = useState({
    name: '',
    amount: '',
    frequency: 'monthly',
    category: '',
  });

  // Form state для добавления
  const [addFormData, setAddFormData] = useState({
    name: '',
    amount: '',
    frequency: 'monthly',
    category: '',
  });

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
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

  // ========== EDIT FUNCTIONS ==========

  const openEditModal = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setEditFormData({
      name: subscription.name,
      amount: subscription.amount.toString(),
      frequency: subscription.frequency,
      category: subscription.category || '',
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingSubscription(null);
    setEditFormData({ name: '', amount: '', frequency: 'monthly', category: '' });
  };

  const saveSubscription = async () => {
    if (!editingSubscription) return;

    // Валидация
    if (!editFormData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    const amount = parseFloat(editFormData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          name: editFormData.name.trim(),
          amount: amount,
          frequency: editFormData.frequency,
          category: editFormData.category.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingSubscription.id);

      if (error) throw error;

      toast.success('Subscription updated successfully! ✅');
      closeEditModal();
      loadSubscriptions();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Failed to update subscription');
    } finally {
      setIsSaving(false);
    }
  };

  // ========== ADD FUNCTIONS ==========

  const openAddModal = () => {
    setAddFormData({ name: '', amount: '', frequency: 'monthly', category: '' });
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setAddFormData({ name: '', amount: '', frequency: 'monthly', category: '' });
  };

 const addSubscription = async () => {
  // Валидация
  if (!addFormData.name.trim()) {
    toast.error('Name is required');
    return;
  }

  const amount = parseFloat(addFormData.amount);
  if (isNaN(amount) || amount <= 0) {
    toast.error('Amount must be a positive number');
    return;
  }

  // Проверка сессии NextAuth
  if (!session?.user?.email) {
    toast.error('Not authenticated');
    return;
  }

  setIsSaving(true);

  try {
    const { error } = await supabase.from('subscriptions').insert({
      user_id: session.user.email,  // Используем email из NextAuth
      name: addFormData.name.trim(),
      amount: amount,
      frequency: addFormData.frequency,
      category: addFormData.category.trim() || null,
      source: 'manual',
      confidence: 100,
    });

    if (error) throw error;

    toast.success(`${addFormData.name} added successfully! ✅`);
    closeAddModal();
    loadSubscriptions();
  } catch (error) {
    console.error('Error adding subscription:', error);
    toast.error('Failed to add subscription');
  } finally {
    setIsSaving(false);
  }
};

  // ========== DELETE FUNCTION ==========

  const deleteSubscription = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from('subscriptions').delete().eq('id', id);

      if (error) throw error;

      toast.success(`${name} deleted successfully`);
      loadSubscriptions();
    } catch (error) {
      console.error('Error deleting subscription:', error);
      toast.error('Failed to delete subscription');
    }
  };

  // ========== CALCULATIONS ==========

  const totalMonthly = subscriptions.reduce((sum, sub) => {
    const monthlyAmount = sub.frequency === 'annual' ? sub.amount / 12 : sub.amount;
    return sum + monthlyAmount;
  }, 0);

  const totalAnnual = totalMonthly * 12;

  return (
    <div className="space-y-8">
      {/* Header */}
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

      {/* Stats Cards */}
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
              <p className="text-3xl font-bold text-gray-900 mt-2">${totalMonthly.toFixed(2)}</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-2">${totalAnnual.toFixed(2)}</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-2">$0.00</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Recent Subscriptions</h2>
        </div>
        <div className="p-6">
          {loading ? (
            // Skeleton Loading State
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
                      <p className="text-xl font-bold text-gray-900">${sub.amount}</p>
                      <p className="text-sm text-gray-500">{sub.source}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(sub)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit subscription"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteSubscription(sub.id, sub.name)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete subscription"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========== EDIT MODAL ========== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Edit Subscription</h2>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600 transition"
                  disabled={isSaving}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Netflix, Spotify, etc."
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Amount ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="12.99"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Frequency <span className="text-red-500">*</span>
                </label>
                <select
                  value={editFormData.frequency}
                  onChange={(e) => setEditFormData({ ...editFormData, frequency: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSaving}
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Category</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSaving}
                >
                  <option value="">Select category...</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={closeEditModal}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={saveSubscription}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ADD MODAL ========== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Add Subscription</h2>
                <button
                  onClick={closeAddModal}
                  className="text-gray-400 hover:text-gray-600 transition"
                  disabled={isSaving}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addFormData.name}
                  onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Netflix, Spotify, etc."
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Amount ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={addFormData.amount}
                  onChange={(e) => setAddFormData({ ...addFormData, amount: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="12.99"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Frequency <span className="text-red-500">*</span>
                </label>
                <select
                  value={addFormData.frequency}
                  onChange={(e) => setAddFormData({ ...addFormData, frequency: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSaving}
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Category</label>
                <select
                  value={addFormData.category}
                  onChange={(e) => setAddFormData({ ...addFormData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSaving}
                >
                  <option value="">Select category...</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={closeAddModal}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={addSubscription}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSaving}
              >
                {isSaving ? 'Adding...' : 'Add Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}