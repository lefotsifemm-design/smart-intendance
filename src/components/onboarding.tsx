'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Upload, FileSpreadsheet, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useCurrency, CURRENCIES, CurrencyCode } from '@/hooks/use-currency';
import { toast } from 'sonner';

type Step = 'currency' | 'choice';

export default function Onboarding() {
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const [step, setStep] = useState<Step>('currency');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(currency);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleCurrencyConfirm = () => {
    setCurrency(selectedCurrency);
    setStep('choice');
  };

  const loadDemoData = async () => {
    setLoadingDemo(true);
    try {
      const res = await fetch('/api/demo-data', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to load demo data');
      const data = await res.json();
      toast.success(`${data.loaded} demo transactions loaded`);
      router.push('/dashboard/statements');
    } catch {
      toast.error('Failed to load demo data');
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to Smart Intendance
        </h1>
        <p className="text-gray-500">
          Let&apos;s set up your financial dashboard in under a minute
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
          step === 'currency' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
        }`}>
          {step !== 'currency' ? <Check className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>}
          Currency
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
          step === 'choice' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
        }`}>
          <span className="w-5 h-5 rounded-full bg-gray-300 text-white flex items-center justify-center text-xs">2</span>
          Get started
        </div>
      </div>

      {step === 'currency' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Choose your currency</h2>
          <p className="text-sm text-gray-500 mb-6">This will be used across all dashboards and reports</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setSelectedCurrency(c.code)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition text-left ${
                  selectedCurrency === c.code
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl font-bold text-gray-700">{c.symbol}</span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{c.code}</p>
                  <p className="text-xs text-gray-500">{c.label}</p>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={handleCurrencyConfirm}
            className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold flex items-center justify-center gap-2"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 'choice' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">How would you like to start?</h2>
            <p className="text-sm text-gray-500 mb-6">You can always change this later</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Upload statement */}
              <button
                onClick={() => router.push('/dashboard/upload')}
                className="flex flex-col items-center gap-4 p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition text-center group"
              >
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition">
                  <Upload className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Upload a statement</p>
                  <p className="text-sm text-gray-500 mt-1">
                    CSV, Excel, or PDF — AI will parse and categorize everything
                  </p>
                </div>
              </button>

              {/* Demo data */}
              <button
                onClick={loadDemoData}
                disabled={loadingDemo}
                className="flex flex-col items-center gap-4 p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50/50 transition text-center group disabled:opacity-60"
              >
                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition">
                  {loadingDemo
                    ? <Loader2 className="w-7 h-7 text-purple-600 animate-spin" />
                    : <FileSpreadsheet className="w-7 h-7 text-purple-600" />
                  }
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Try with demo data</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Load 50 sample transactions to explore analytics instantly
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
