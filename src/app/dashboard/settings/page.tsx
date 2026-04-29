'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { LogOut, Trash2, User, Globe, AlertTriangle } from 'lucide-react';
import { useCurrency, CURRENCIES } from '@/hooks/use-currency';

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return;
    if (!session?.user?.id) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', session.user.id);

      if (error) throw error;

      toast.success('Account data deleted');
      await signOut({ callbackUrl: '/' });
    } catch {
      toast.error('Failed to delete account data');
      setIsDeleting(false);
    }
  };

  const user = session?.user;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your profile and preferences</p>
      </div>

      {/* Profile */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
        </div>
        <div className="flex items-center gap-5">
          {user?.image ? (
            <Image
              src={user.image}
              alt={user.name ?? 'Avatar'}
              width={64}
              height={64}
              className="rounded-full"
            />
          ) : (
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-gray-900">{user?.name ?? '—'}</p>
            <p className="text-sm text-gray-500">{user?.email ?? '—'}</p>
            <p className="text-xs text-gray-400 mt-1">Signed in with Google</p>
          </div>
        </div>
      </section>

      {/* Currency */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Globe className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Display Currency</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Affects how amounts are displayed. Does not convert values.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => {
                setCurrency(c.code);
                toast.success(`Currency set to ${c.label}`);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition text-left ${
                currency === c.code
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-lg font-bold text-gray-700 w-6">{c.symbol}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{c.code}</p>
                <p className="text-xs text-gray-500">{c.label}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Account actions */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Account</h2>

        <div className="space-y-3">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-gray-500" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">Sign out</p>
                <p className="text-xs text-gray-500">Sign out of your account</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-red-200 hover:bg-red-50 transition"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-500" />
              <div className="text-left">
                <p className="text-sm font-medium text-red-600">Delete account data</p>
                <p className="text-xs text-gray-500">Permanently removes all your subscriptions</p>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Delete Account Data</h3>
            </div>
            <p className="text-gray-600 mb-4">
              This will permanently delete all your subscriptions. This action cannot be undone.
            </p>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-mono font-bold">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4 font-mono"
              placeholder="DELETE"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInput('');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={deleteInput !== 'DELETE' || isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
