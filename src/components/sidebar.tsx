'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Upload, BarChart3, Settings, Menu, X, LineChart, Target, CalendarDays } from 'lucide-react';

const NAV = [
  { href: '/dashboard', icon: Home, label: 'Overview' },
  { href: '/dashboard/upload', icon: Upload, label: 'Upload' },
  { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/dashboard/statements', icon: LineChart, label: 'Statements' },
  { href: '/dashboard/budgets', icon: Target, label: 'Budgets' },
  { href: '/dashboard/calendar', icon: CalendarDays, label: 'Calendar' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  const navLinks = (onClick?: () => void) =>
    NAV.map(({ href, icon: Icon, label }) => (
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
        <span className="font-medium">{label}</span>
      </Link>
    ));

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg border border-gray-200 shadow-sm"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </button>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">SI</span>
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
