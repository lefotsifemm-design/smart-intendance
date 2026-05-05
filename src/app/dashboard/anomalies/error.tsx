'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function AnomaliesError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => { console.error('Anomalies error:', error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 max-w-md mx-auto text-center">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Ошибка детектора</h2>
        <p className="text-sm text-gray-500 mt-1">
          {error.message || 'Не удалось запустить анализ аномалий'}
        </p>
      </div>
      <button
        onClick={() => unstable_retry()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
      >
        <RefreshCw className="w-4 h-4" />
        Попробовать снова
      </button>
    </div>
  );
}
