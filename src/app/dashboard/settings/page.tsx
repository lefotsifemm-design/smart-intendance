'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  LogOut, Trash2, User, Globe, AlertTriangle,
  Building2, RefreshCw, Unplug, CheckCircle2, XCircle, Clock,
  Zap,
} from 'lucide-react';
import { useCurrency, CURRENCIES } from '@/hooks/use-currency';

interface TBankStatus {
  connected:     boolean;
  expired?:      boolean;
  accountNumber?: string;
  companyName?:   string;
  inn?:           string;
  connectedAt?:   string;
  lastSyncAt?:    string;
}

function formatDate(iso?: string) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const { currency, setCurrency } = useCurrency();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput]             = useState('');
  const [isDeleting, setIsDeleting]               = useState(false);

  // T-Bank state
  const [tbankStatus, setTbankStatus]       = useState<TBankStatus | null>(null);
  const [tbankLoading, setTbankLoading]     = useState(true);
  const [syncing, setSyncing]               = useState(false);
  const [disconnecting, setDisconnecting]   = useState(false);
  const [syncResult, setSyncResult]         = useState<{ synced: number; skipped: number } | null>(null);

  // ── T-Bank status ───────────────────────────────────────────────────────────
  const loadTbankStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/tbank/status');
      const data = await res.json();
      setTbankStatus(data);
    } catch {
      setTbankStatus({ connected: false });
    } finally {
      setTbankLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTbankStatus();
  }, [loadTbankStatus]);

  // Handle OAuth redirect results
  useEffect(() => {
    const tbankParam = searchParams.get('tbank');
    const reason     = searchParams.get('reason');
    if (tbankParam === 'connected') {
      toast.success('T-Bank подключён успешно!');
      loadTbankStatus();
      // Clean URL
      window.history.replaceState({}, '', '/dashboard/settings');
    } else if (tbankParam === 'error') {
      toast.error(`Ошибка подключения T-Bank: ${reason ?? 'unknown'}`);
      window.history.replaceState({}, '', '/dashboard/settings');
    }
  }, [searchParams, loadTbankStatus]);

  const handleTbankConnect = () => {
    window.location.href = '/api/tbank/auth';
  };

  const handleTbankSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/tbank/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      setSyncResult({ synced: data.synced, skipped: data.skipped });
      toast.success(`Синхронизация завершена: ${data.synced} новых транзакций`);
      loadTbankStatus();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleTbankDisconnect = async () => {
    if (!confirm('Отключить T-Bank? Уже сохранённые транзакции останутся.')) return;
    setDisconnecting(true);
    try {
      await fetch('/api/tbank/disconnect', { method: 'DELETE' });
      setTbankStatus({ connected: false });
      setSyncResult(null);
      toast.success('T-Bank отключён');
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  // ── Account ─────────────────────────────────────────────────────────────────
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

      {/* ── Profile ── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
        </div>
        <div className="flex items-center gap-5">
          {user?.image ? (
            <Image src={user.image} alt={user.name ?? 'Avatar'} width={64} height={64} className="rounded-full" />
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

      {/* ── T-Bank Business API ── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-900">T-Bank Business API</h2>
          <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-700 rounded-full">
            Business
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Автоматическая синхронизация транзакций из расчётного счёта ООО/ИП.
          Требуется бизнес-аккаунт T-Bank и регистрация приложения в{' '}
          <a href="https://business.tinkoff.ru/openapi" target="_blank" rel="noopener noreferrer"
            className="text-blue-600 underline">
            T-Bank Open API
          </a>.
        </p>

        {tbankLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Загрузка статуса…
          </div>
        ) : tbankStatus?.connected ? (
          <div className="space-y-4">
            {/* Status badge */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              tbankStatus.expired
                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {tbankStatus.expired
                ? <XCircle className="w-4 h-4 shrink-0" />
                : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {tbankStatus.expired ? 'Токен истёк — переподключите' : 'Подключено'}
            </div>

            {/* Account info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              {tbankStatus.companyName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Компания</span>
                  <span className="font-medium text-gray-900">{tbankStatus.companyName}</span>
                </div>
              )}
              {tbankStatus.accountNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Счёт</span>
                  <span className="font-mono text-gray-900">{tbankStatus.accountNumber}</span>
                </div>
              )}
              {tbankStatus.inn && (
                <div className="flex justify-between">
                  <span className="text-gray-500">ИНН</span>
                  <span className="font-medium text-gray-900">{tbankStatus.inn}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Подключено</span>
                <span className="text-gray-700">{formatDate(tbankStatus.connectedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Последний синк
                </span>
                <span className="text-gray-700">{formatDate(tbankStatus.lastSyncAt)}</span>
              </div>
            </div>

            {/* Sync result */}
            {syncResult && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm">
                <Zap className="w-4 h-4 shrink-0" />
                Загружено <strong>{syncResult.synced}</strong> новых транзакций
                {syncResult.skipped > 0 && `, ${syncResult.skipped} уже были`}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleTbankSync} disabled={syncing || tbankStatus.expired}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Синхронизация…' : 'Синхронизировать'}
              </button>
              {tbankStatus.expired && (
                <button onClick={handleTbankConnect}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition">
                  Переподключить
                </button>
              )}
              <button onClick={handleTbankDisconnect} disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition disabled:opacity-50">
                <Unplug className="w-4 h-4" />
                Отключить
              </button>
            </div>
          </div>
        ) : (
          /* Not connected */
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-2">
              <p className="font-semibold text-gray-800">Как подключить:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Зарегистрируйте приложение в <a href="https://developer.tinkoff.ru" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">developer.tinkoff.ru</a></li>
                <li>Получите <code className="bg-gray-200 px-1 rounded">Client ID</code> и <code className="bg-gray-200 px-1 rounded">Client Secret</code></li>
                <li>Добавьте в <code className="bg-gray-200 px-1 rounded">.env.local</code>:
                  <pre className="mt-1 bg-gray-800 text-green-400 text-xs rounded p-2 overflow-x-auto">{`TBANK_CLIENT_ID=your_client_id
TBANK_CLIENT_SECRET=your_client_secret
TBANK_REDIRECT_URI=https://smart-intendance.ru/api/tbank/callback`}</pre>
                </li>
                <li>Нажмите «Подключить T-Bank»</li>
              </ol>
            </div>
            <button onClick={handleTbankConnect}
              className="flex items-center gap-2 px-5 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition shadow-sm">
              <Building2 className="w-4 h-4" />
              Подключить T-Bank
            </button>
          </div>
        )}
      </section>

      {/* ── Currency ── */}
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
            <button key={c.code} onClick={() => { setCurrency(c.code); toast.success(`Currency set to ${c.label}`); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition text-left ${
                currency === c.code ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
              <span className="text-lg font-bold text-gray-700 w-6">{c.symbol}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{c.code}</p>
                <p className="text-xs text-gray-500">{c.label}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Account actions ── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Account</h2>
        <div className="space-y-3">
          <button onClick={handleSignOut}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-gray-500" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">Sign out</p>
                <p className="text-xs text-gray-500">Sign out of your account</p>
              </div>
            </div>
          </button>
          <button onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-red-200 hover:bg-red-50 transition">
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

      {/* Delete modal */}
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
            <input type="text" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4 font-mono"
              placeholder="DELETE" autoFocus />
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
                disabled={isDeleting}>
                Cancel
              </button>
              <button onClick={handleDeleteAccount}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold disabled:opacity-50"
                disabled={deleteInput !== 'DELETE' || isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
