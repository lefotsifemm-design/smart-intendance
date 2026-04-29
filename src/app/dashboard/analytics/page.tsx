'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { CATEGORIES } from '@/lib/constants';
import { TrendingUp, DollarSign, Calendar, Package } from 'lucide-react';
import { toast } from 'sonner';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  category: string;
  source: string;
}

const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#eab308',
];

function monthlyAmount(sub: Subscription): number {
  return sub.frequency === 'annual' ? sub.amount / 12 : sub.amount;
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

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
        .order('amount', { ascending: false });
      if (error) throw error;
      setSubscriptions(data || []);
    } catch {
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const totalMonthly = subscriptions.reduce((sum, s) => sum + monthlyAmount(s), 0);
  const totalAnnual = totalMonthly * 12;

  const categoryData = CATEGORIES.map((cat, i) => {
    const total = subscriptions
      .filter((s) => s.category === cat)
      .reduce((sum, s) => sum + monthlyAmount(s), 0);
    return { name: cat, value: parseFloat(total.toFixed(2)), color: CHART_COLORS[i % CHART_COLORS.length] };
  }).filter((d) => d.value > 0);

  const topSubscriptions = [...subscriptions]
    .sort((a, b) => monthlyAmount(b) - monthlyAmount(a))
    .slice(0, 8)
    .map((s) => ({
      name: s.name.length > 16 ? s.name.slice(0, 14) + '…' : s.name,
      monthly: parseFloat(monthlyAmount(s).toFixed(2)),
    }));

  const monthlyCount = subscriptions.filter((s) => s.frequency === 'monthly').length;
  const annualCount = subscriptions.filter((s) => s.frequency === 'annual').length;

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

  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <TrendingUp className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No data yet</h2>
        <p className="text-gray-500">Add subscriptions on the Dashboard to see analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Breakdown of your subscription spend</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-sm text-gray-500">Total</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{subscriptions.length}</p>
          <p className="text-xs text-gray-400 mt-1">subscriptions</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-sm text-gray-500">Monthly</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">${totalMonthly.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">/month</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-sm text-gray-500">Annual</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">${totalAnnual.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">/year</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-orange-600" />
            </div>
            <p className="text-sm text-gray-500">Avg / sub</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${(totalMonthly / subscriptions.length).toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-1">/month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart — by category */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Spend by Category</h2>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}/mo`, 'Spend']} />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-gray-700">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm text-center py-16">No categorised data</p>
          )}
        </div>

        {/* Bar chart — top subscriptions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Top Subscriptions by Cost</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topSubscriptions} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => `$${v}`}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={90}
                tick={{ fontSize: 11 }}
              />
              <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}/mo`, 'Monthly cost']} />
              <Bar dataKey="monthly" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Frequency breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Billing Frequency</h2>
        <div className="flex gap-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-gray-700">
              <span className="font-semibold">{monthlyCount}</span> monthly
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-sm text-gray-700">
              <span className="font-semibold">{annualCount}</span> annual
            </span>
          </div>
        </div>
        <div className="mt-4 h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{
              width: `${subscriptions.length ? (monthlyCount / subscriptions.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Full ranked table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">All Subscriptions (by cost)</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {[...subscriptions]
            .sort((a, b) => monthlyAmount(b) - monthlyAmount(a))
            .map((sub, i) => (
              <div key={sub.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-4">
                  <span className="w-6 text-sm font-medium text-gray-400">{i + 1}</span>
                  <div>
                    <p className="font-medium text-gray-900">{sub.name}</p>
                    <p className="text-xs text-gray-500">{sub.category} · {sub.frequency}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${monthlyAmount(sub).toFixed(2)}/mo</p>
                  {sub.frequency === 'annual' && (
                    <p className="text-xs text-gray-400">${sub.amount}/yr</p>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
