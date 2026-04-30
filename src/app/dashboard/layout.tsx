import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import UserMenu from '@/components/user-menu';
import Sidebar from '@/components/sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo — pushed right of hamburger on mobile */}
            <div className="flex items-center gap-2 pl-10 lg:pl-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SI</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Smart Intendance</h1>
            </div>

            <div className="flex items-center gap-6">
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 transition text-sm">
                  Dashboard
                </Link>
                <Link href="/dashboard/upload" className="text-gray-600 hover:text-gray-900 transition text-sm">
                  Upload
                </Link>
                <Link href="/dashboard/analytics" className="text-gray-600 hover:text-gray-900 transition text-sm">
                  Analytics
                </Link>
                <Link href="/dashboard/budgets" className="text-gray-600 hover:text-gray-900 transition text-sm">
                  Budgets
                </Link>
                <Link href="/dashboard/settings" className="text-gray-600 hover:text-gray-900 transition text-sm">
                  Settings
                </Link>
              </nav>
              <UserMenu user={session.user} />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
