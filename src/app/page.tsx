import Link from 'next/link';
import { BarChart3, Brain, Shield, TrendingUp, Upload, Zap } from 'lucide-react';

const FEATURES = [
  {
    icon: Brain,
    title: 'AI Categorization',
    description: 'Upload a bank statement — GPT-4o automatically categorizes every transaction',
    color: 'blue',
  },
  {
    icon: BarChart3,
    title: 'Deep Analytics',
    description: 'P&L summary, cash flow trends, spending patterns, and category breakdowns',
    color: 'purple',
  },
  {
    icon: TrendingUp,
    title: 'Budget Tracking',
    description: 'Set budgets per category, track plan vs actual, and get alerts when you overspend',
    color: 'green',
  },
] as const;

const FORMATS = [
  { icon: Upload, label: 'CSV' },
  { icon: Upload, label: 'Excel' },
  { icon: Upload, label: 'PDF' },
];

const colorMap = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600' },
} as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">SI</span>
          </div>
          <span className="font-bold text-xl text-gray-900">Smart Intendance</span>
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition"
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full text-sm font-medium text-blue-700 mb-6">
          <Zap className="w-4 h-4" />
          AI-powered financial analytics
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
          Your finances,
          <br />
          <span className="text-blue-600">crystal clear</span>
        </h1>

        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          Upload a bank statement in any format. AI categorizes every transaction instantly.
          Get P&amp;L reports, spending trends, and budget alerts — all in one dashboard.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Link
            href="/dashboard"
            className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-lg shadow-blue-200 hover:shadow-xl"
          >
            Get Started — Free
          </Link>
        </div>

        <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
          {FORMATS.map((f) => (
            <div key={f.label} className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-green-500" />
              {f.label} supported
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((feature) => {
            const colors = colorMap[feature.color];
            return (
              <div
                key={feature.title}
                className="bg-white/80 backdrop-blur rounded-2xl border border-gray-200/60 p-8 hover:shadow-lg transition"
              >
                <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-6 h-6 ${colors.text}`} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Upload', desc: 'Drop your bank statement — CSV, Excel, or PDF' },
            { step: '2', title: 'AI Parses', desc: 'GPT-4o extracts and categorizes every transaction' },
            { step: '3', title: 'Insights', desc: 'Explore charts, trends, and budget reports instantly' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                {item.step}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to take control of your finances?
          </h2>
          <p className="text-blue-100 mb-8 max-w-lg mx-auto">
            Sign up for free. No credit card required. Start analyzing in under a minute.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-8 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg"
          >
            Get Started — Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-gray-200/60">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">SI</span>
            </div>
            Smart Intendance
          </div>
          <p>&copy; {new Date().getFullYear()} All rights reserved</p>
        </div>
      </footer>
    </div>
  );
}
