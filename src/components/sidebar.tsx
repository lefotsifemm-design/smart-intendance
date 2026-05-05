'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Upload, LineChart, Target, Settings,
  Menu, X, Building2, TrendingUp, ShieldAlert, Siren,
} from 'lucide-react';

const ANOMALY_STORAGE_KEY = 'si_anomaly_count';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: false },
  { href: '/dashboard/upload', icon: Upload, label: 'Upload', badge: false },
  { href: '/dashboard/statements', icon: LineChart, label: 'Transactions', badge: false },
  { href: '/dashboard/cashflow', icon: TrendingUp, label: 'Cash Flow', badge: false },
  { href: '/dashboard/cashgap', icon: Siren, label: 'Cash Gap', badge: false },
  { href: '/dashboard/anomalies', icon: ShieldAlert, label: 'Anomalies', badge: true },
  { href: '/dashboard/budgets', icon: Target, label: 'Budgets', badge: false },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings', badge: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [anomalyCount, setAnomalyCount] = useState(0);

  useEffect(() => {
    const read = () => {
      try {
        const v = localStorage.getItem(ANOMALY_STORAGE_KEY);
        setAnomalyCount(v ? parseInt(v, 10) : 0);
      } catch { /* ok */ }
    };
    read();
    // Refresh badge when the anomalies page updates localStorage
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  const navLinks = (onClick?: () => void) =>
    NAV.map(({ href, icon: Icon, label, badge }) => {
      const count = badge ? anomalyCount : 0;
      return (
        <Link
          key={href}
          href={href}
          onClick={onClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
            isActive(href)
              ? 'bg-blue-50 text-blue-600 font-semibold'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium flex-1">{label}</span>
          {count > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Link>
      );
    });

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg border border-gray-200 shadow-sm"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">Smart Intendance</span>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <nav className="p-3 space-y-1">{navLinks(() => setOpen(false))}</nav>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-56 flex-shrink-0">
        <nav className="space-y-1">{navLinks()}</nav>
      </aside>
    </>
  );
}
