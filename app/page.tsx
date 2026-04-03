export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <nav className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-white">
            Smart Intendance
          </div>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Stop Wasting Money on
            <span className="text-blue-400"> Unused SaaS</span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-8">
            AI-powered platform that identifies unused licenses and saves 
            mid-market companies 23-30% on SaaS spending
          </p>

          <div className="flex gap-4 justify-center mb-12">
            <button className="px-8 py-4 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition">
              Start Free Audit
            </button>
            <button className="px-8 py-4 bg-slate-800 text-white rounded-lg text-lg font-semibold hover:bg-slate-700 transition">
              Watch Demo
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-xl">
              <div className="text-4xl font-bold text-blue-400 mb-2">$45B</div>
              <div className="text-gray-300">Wasted globally on unused SaaS</div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-xl">
              <div className="text-4xl font-bold text-blue-400 mb-2">25-30%</div>
              <div className="text-gray-300">Average cost reduction</div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-xl">
              <div className="text-4xl font-bold text-blue-400 mb-2">5 min</div>
              <div className="text-gray-300">To identify waste</div>
            </div>
          </div>

          {/* Features Preview */}
          <div className="mt-20 text-left">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700">
                <div className="text-3xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Auto-Discovery
                </h3>
                <p className="text-gray-400">
                  Connect your email and we'll find all SaaS subscriptions automatically
                </p>
              </div>
              <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700">
                <div className="text-3xl mb-4">🤖</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  AI Analysis
                </h3>
                <p className="text-gray-400">
                  Our AI identifies unused licenses and optimization opportunities
                </p>
              </div>
              <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700">
                <div className="text-3xl mb-4">💰</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Save Money
                </h3>
                <p className="text-gray-400">
                  Get actionable recommendations to cut costs by 23-30%
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 mt-20 border-t border-slate-800">
        <div className="text-center text-gray-400">
          <p>Smart Intendance - Portfolio Project 2026</p>
          <p className="text-sm mt-2">Built with Next.js, TypeScript, and AI</p>
        </div>
      </footer>
    </div>
  );
}