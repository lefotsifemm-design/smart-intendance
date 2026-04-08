import Link from 'next/link';
import { Upload, Home, Settings, BarChart3 } from 'lucide-react';
import UserMenu from '@/components/user-menu';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Проверка авторизации
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SI</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                Smart Intendance
              </h1>
            </div>
            
            <div className="flex items-center gap-6">
              <nav className="flex items-center gap-6">
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900 transition"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/upload"
                  className="text-gray-600 hover:text-gray-900 transition"
                >
                  Upload
                </Link>
              </nav>
              
              {/* User Menu */}
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar + Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <Home className="w-5 h-5" />
                <span className="font-medium">Overview</span>
              </Link>
              
              <Link
                href="/dashboard/upload"
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <Upload className="w-5 h-5" />
                <span className="font-medium">Upload Statement</span>
              </Link>
              
              <Link
                href="/dashboard/analytics"
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <BarChart3 className="w-5 h-5" />
                <span className="font-medium">Analytics</span>
              </Link>
              
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <Settings className="w-5 h-5" />
                <span className="font-medium">Settings</span>
              </Link>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}