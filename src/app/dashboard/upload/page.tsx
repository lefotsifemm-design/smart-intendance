'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCurrency } from '@/hooks/use-currency';
import { Upload, ArrowLeft, FileText, Check, X, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function excelToCsv(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', dateNF: 'yyyy-mm-dd' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_csv(ws));
      } catch {
        reject(new Error('Failed to parse Excel file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

async function pdfToText(file: File): Promise<string> {
  if (typeof (Math as unknown as Record<string, unknown>).sumPrecise === 'undefined') {
    (Math as unknown as Record<string, unknown>).sumPrecise = (values: Iterable<number>) =>
      [...values].reduce((a: number, b: number) => a + b, 0);
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const rowMap = new Map<number, { x: number; str: string }[]>();
    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const transform = (item as { transform: number[]; str: string }).transform;
      const y = Math.round(transform[5] / 3) * 3;
      const x = transform[4];
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push({ x, str: item.str });
    }

    const rows = [...rowMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items.sort((a, b) => a.x - b.x).map((i) => i.str).join('\t')
      );

    pageTexts.push(rows.join('\n'));
  }

  return pageTexts.join('\n\n');
}

function isExcelFile(name: string) {
  return name.endsWith('.xlsx') || name.endsWith('.xls');
}

function isPdfFile(name: string) {
  return name.toLowerCase().endsWith('.pdf');
}

interface ParsedTransaction {
  tempId: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date?: string;
  description: string;
  counterparty?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { symbol } = useCurrency();
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState('');
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.name.endsWith('.csv') && !isExcelFile(f.name) && !isPdfFile(f.name)) {
      toast.error('Upload CSV, Excel (.xlsx, .xls) or PDF');
      return;
    }

    setFile(f);

    if (isPdfFile(f.name)) {
      setFilePreview(`PDF: ${f.name} (${(f.size / 1024).toFixed(0)} KB)`);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview((ev.target?.result as string).substring(0, 500));
      reader.readAsText(f);
    }

    toast.success('File loaded');
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);

    try {
      const content = isPdfFile(file.name)
        ? await pdfToText(file)
        : isExcelFile(file.name)
          ? await excelToCsv(file)
          : await fileToText(file);

      toast.loading(
        isPdfFile(file.name)
          ? 'Extracting PDF and classifying transactions… (15–30 sec)'
          : 'AI is classifying transactions… (10–20 sec)',
        { id: 'parsing' }
      );

      const res = await fetch('/api/parse-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: content }),
      });

      toast.dismiss('parsing');

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || 'Failed to parse statement');
      }

      const data = await res.json();

      if (data.transactions.length === 0) {
        toast.info('No transactions found in this file');
        return;
      }

      toast.success(`Found ${data.count} transaction${data.count !== 1 ? 's' : ''}`, { duration: 3000 });

      const withIds: ParsedTransaction[] = data.transactions.map(
        (tx: Omit<ParsedTransaction, 'tempId'>, i: number) => ({ ...tx, tempId: i })
      );
      setParsedTransactions(withIds);
      setSelectedIds(new Set(withIds.map((tx) => tx.tempId)));
      setIsPreviewOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleId = (id: number) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const saveSelected = async () => {
    const selected = parsedTransactions.filter((tx) => selectedIds.has(tx.tempId));
    if (selected.length === 0) { toast.error('Select at least one transaction'); return; }
    if (!session?.user?.id) { toast.error('Not authenticated'); return; }

    setIsUploading(true);
    try {
      const res = await fetch('/api/save-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: selected }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      const data = await res.json();
      toast.success(`Saved ${data.saved} transaction${data.saved !== 1 ? 's' : ''}`);
      setIsPreviewOpen(false);
      setTimeout(() => router.push('/dashboard/statements'), 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-4 transition text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Upload Statement</h1>
        <p className="text-gray-500 mt-1">Import a bank statement — AI classifies every transaction automatically</p>
      </div>

      {/* Upload card */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-6">
        {/* Drop zone */}
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-500 transition cursor-pointer">
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.pdf"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
            disabled={isUploading}
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            <Upload className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-1">
              {file ? file.name : 'Choose file or drag & drop'}
            </p>
            <p className="text-sm text-gray-400">CSV, Excel (.xlsx, .xls) or PDF bank statement</p>
          </label>
        </div>

        {/* Preview */}
        {filePreview && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              {file && isPdfFile(file.name) ? 'File info' : 'Preview (first 500 chars)'}
            </p>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{filePreview}</pre>
          </div>
        )}

        {/* Info */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg p-4">
          <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800">
            <strong>GPT-4 powered.</strong> Supports Т-Банк, Сбербанк, ВТБ and other Russian bank formats.
            Large files are split automatically.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold text-center text-sm"
          >
            Cancel
          </Link>
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isUploading
              ? 'Processing…'
              : file && isPdfFile(file.name)
                ? 'Parse PDF'
                : 'Parse & Classify'}
          </button>
        </div>
      </div>

      {/* Preview modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Review Transactions</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {selectedIds.size} of {parsedTransactions.length} selected
                  </p>
                </div>
                <button onClick={() => setIsPreviewOpen(false)} disabled={isUploading} className="text-gray-400 hover:text-gray-600 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedIds(new Set(parsedTransactions.map((t) => t.tempId)))}
                  className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Deselect all
                </button>
              </div>
            </div>

            {/* Transaction list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {parsedTransactions.map((tx) => {
                const selected = selectedIds.has(tx.tempId);
                return (
                  <div
                    key={tx.tempId}
                    onClick={() => toggleId(tx.tempId)}
                    className={`flex items-center gap-4 p-4 border-2 rounded-xl transition cursor-pointer ${
                      selected ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {tx.type === 'income'
                        ? <TrendingUp className="w-4 h-4 text-green-600" />
                        : <TrendingDown className="w-4 h-4 text-red-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {tx.description || tx.counterparty || '—'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {tx.category}{tx.date ? ` · ${tx.date}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-base font-bold ${tx.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                        {tx.type === 'income' ? '+' : '−'}{symbol}{tx.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal footer */}
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setIsPreviewOpen(false)}
                disabled={isUploading}
                className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveSelected}
                disabled={isUploading || selectedIds.size === 0}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm disabled:opacity-40"
              >
                {isUploading ? 'Saving…' : `Save ${selectedIds.size} transaction${selectedIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
