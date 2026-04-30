'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { Upload, ArrowLeft, Plus, FileText, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIES } from '@/lib/constants';
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
  // Polyfill for Math.sumPrecise — required by pdfjs-dist 5.x, missing in some browsers
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

    // Group text items by Y coordinate to preserve table row structure
    const rowMap = new Map<number, { x: number; str: string }[]>();
    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const transform = (item as { transform: number[]; str: string }).transform;
      const y = Math.round(transform[5] / 3) * 3;
      const x = transform[4];
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push({ x, str: item.str });
    }

    // Sort rows top-to-bottom (PDF y-coords are bottom-up → descending)
    const rows = [...rowMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.str)
          .join('\t')
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

interface ParsedSubscription {
  tempId: number;
  name: string;
  amount: number;
  frequency: string;
  category: string;
  merchant?: string;
  last_charge?: string;
  confidence: number;
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
  const [uploadMode, setUploadMode] = useState<'subscriptions' | 'statement'>('subscriptions');
  const [activeTab, setActiveTab] = useState<'csv' | 'manual'>('manual');
  const [isUploading, setIsUploading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string>('');

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [parsedSubscriptions, setParsedSubscriptions] = useState<ParsedSubscription[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<number>>(new Set());

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    frequency: 'monthly',
    category: '',
  });

  // ========== CSV UPLOAD ==========

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !isExcelFile(file.name) && !isPdfFile(file.name)) {
      toast.error('Please upload a CSV, Excel (.xlsx, .xls), or PDF file');
      return;
    }

    setCsvFile(file);

    if (isPdfFile(file.name)) {
      setCsvPreview(`PDF: ${file.name} (${(file.size / 1024).toFixed(0)} KB) — text will be extracted automatically on upload`);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvPreview(text.substring(0, 500));
      };
      reader.readAsText(file);
    }

    toast.success('File loaded!');
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file first');
      return;
    }

    setIsUploading(true);

    try {
      const csvContent = isPdfFile(csvFile.name)
        ? await pdfToText(csvFile)
        : isExcelFile(csvFile.name)
          ? await excelToCsv(csvFile)
          : await fileToText(csvFile);

      if (uploadMode === 'statement') {
        const isPdf = isPdfFile(csvFile.name);
        toast.loading(
          isPdf
            ? 'Extracting PDF text and classifying transactions... (15-30 sec)'
            : 'AI is classifying all transactions... (10-20 sec)',
          { id: 'parsing' }
        );

        const response = await fetch('/api/parse-statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvContent }),
        });

        toast.dismiss('parsing');

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.details || 'Failed to parse statement');
        }

        const data = await response.json();

        if (data.transactions.length === 0) {
          toast.info('No transactions found in this CSV file');
          return;
        }

        toast.success(`✅ Found ${data.count} transaction${data.count > 1 ? 's' : ''}!`, { duration: 3000 });

        const txWithIds: ParsedTransaction[] = data.transactions.map(
          (tx: Omit<ParsedTransaction, 'tempId'>, index: number) => ({ ...tx, tempId: index })
        );
        setParsedTransactions(txWithIds);
        setSelectedTransactionIds(new Set(txWithIds.map((tx) => tx.tempId)));
        setIsPreviewOpen(true);
      } else {
        toast.loading('AI is analyzing your CSV... (5-10 sec)', { id: 'parsing' });

        const response = await fetch('/api/parse-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvContent }),
        });

        toast.dismiss('parsing');

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.details || 'Failed to parse CSV');
        }

        const data = await response.json();

        if (data.subscriptions.length === 0) {
          toast.info('No subscriptions found in this CSV file');
          return;
        }

        const avgConfidence = Math.round(
          data.subscriptions.reduce(
            (sum: number, sub: ParsedSubscription) => sum + (sub.confidence || 0),
            0
          ) / data.subscriptions.length
        );

        toast.success(
          `✅ Found ${data.count} subscription${data.count > 1 ? 's' : ''}! Avg confidence: ${avgConfidence}%.`,
          { duration: 3000 }
        );

        const subsWithIds: ParsedSubscription[] = data.subscriptions.map(
          (sub: Omit<ParsedSubscription, 'tempId'>, index: number) => ({ ...sub, tempId: index })
        );
        setParsedSubscriptions(subsWithIds);
        setSelectedIds(new Set(subsWithIds.map((sub) => sub.tempId)));
        setIsPreviewOpen(true);
      }
    } catch (error) {
      console.error('Error uploading CSV:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload CSV');
    } finally {
      setIsUploading(false);
    }
  };

  // ========== PREVIEW MODAL FUNCTIONS ==========

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(parsedSubscriptions.map((sub) => sub.tempId)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const saveSelectedSubscriptions = async () => {
    const selected = parsedSubscriptions.filter((sub) => selectedIds.has(sub.tempId));

    if (selected.length === 0) {
      toast.error('Please select at least one subscription');
      return;
    }

    if (!session?.user?.id) {
      toast.error('Not authenticated');
      return;
    }

    setIsUploading(true);

    try {
      const subscriptionsToInsert = selected.map((sub) => ({
        user_id: session.user!.id,
        name: sub.name,
        amount: sub.amount,
        frequency: sub.frequency,
        category: sub.category || null,
        merchant: sub.merchant || null,
        last_charge: sub.last_charge || null,
        source: 'csv',
        confidence: sub.confidence || 70,
      }));

      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert(subscriptionsToInsert);

      if (insertError) throw insertError;

      toast.success(`✅ Saved ${selected.length} subscription${selected.length > 1 ? 's' : ''}!`);

      setIsPreviewOpen(false);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (error: any) {
      console.error('Error saving subscriptions:', error);
      toast.error('Failed to save subscriptions');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleTransaction = (id: number) => {
    const next = new Set(selectedTransactionIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedTransactionIds(next);
  };

  const saveSelectedTransactions = async () => {
    const selected = parsedTransactions.filter((tx) => selectedTransactionIds.has(tx.tempId));
    if (selected.length === 0) { toast.error('Select at least one transaction'); return; }
    if (!session?.user?.id) { toast.error('Not authenticated'); return; }

    setIsUploading(true);
    try {
      const response = await fetch('/api/save-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: selected }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save');
      }
      const data = await response.json();
      toast.success(`✅ Saved ${data.saved} transaction${data.saved !== 1 ? 's' : ''}!`);
      setIsPreviewOpen(false);
      setTimeout(() => router.push('/dashboard/statements'), 1000);
    } catch (error) {
      console.error('Error saving transactions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save transactions');
    } finally {
      setIsUploading(false);
    }
  };

  // Confidence badge color
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) return 'bg-green-100 text-green-700 border-green-200';
    if (confidence >= 70) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  // ========== MANUAL ENTRY ==========

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }

    if (!session?.user?.id) {
      toast.error('Not authenticated');
      return;
    }

    setIsUploading(true);

    try {
      const { error } = await supabase.from('subscriptions').insert({
        user_id: session.user.id,
        name: formData.name.trim(),
        amount: amount,
        frequency: formData.frequency,
        category: formData.category.trim() || null,
        source: 'manual',
        confidence: 100,
      });

      if (error) throw error;

      toast.success(`${formData.name} added successfully! ✅`);

      setFormData({
        name: '',
        amount: '',
        frequency: 'monthly',
        category: '',
      });

      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (error) {
      console.error('Error adding subscription:', error);
      toast.error('Failed to add subscription');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Upload</h1>
            <p className="text-gray-600 mt-1">
              {uploadMode === 'subscriptions' ? 'Add subscriptions manually or from a CSV' : 'Analyze a full bank statement for P&L'}
            </p>
          </div>
          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => { setUploadMode('subscriptions'); setActiveTab('manual'); }}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                uploadMode === 'subscriptions' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Subscriptions
            </button>
            <button
              onClick={() => { setUploadMode('statement'); setActiveTab('csv'); }}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                uploadMode === 'statement' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Full Statement
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {uploadMode === 'subscriptions' && (
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 px-6 py-4 font-semibold transition ${
                activeTab === 'manual'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" />
                Manual Entry
              </div>
            </button>
          )}
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex-1 px-6 py-4 font-semibold transition ${
              activeTab === 'csv'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-5 h-5" />
              {uploadMode === 'statement' ? 'Upload Bank Statement' : 'Upload CSV'}
            </div>
          </button>
        </div>

        {/* Manual Entry Tab */}
        {activeTab === 'manual' && (
          <div className="p-8">
            <form onSubmit={handleManualSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Subscription Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Netflix, Spotify, etc."
                    disabled={isUploading}
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Amount ($) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="12.99"
                    disabled={isUploading}
                  />
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Billing Frequency <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isUploading}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isUploading}
                  >
                    <option value="">Select category...</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Link
                  href="/dashboard"
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold text-center"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isUploading}
                >
                  {isUploading ? 'Adding...' : 'Add Subscription'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* CSV Upload Tab */}
        {activeTab === 'csv' && (
          <div className="p-8">
            <div className="space-y-6">
              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                  disabled={isUploading}
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    {csvFile ? csvFile.name : 'Upload Bank Statement'}
                  </p>
                  <p className="text-gray-600">
                    {csvFile
                      ? 'Click to change file'
                      : 'CSV, Excel (.xlsx, .xls) or PDF bank statement'}
                  </p>
                </label>
              </div>

              {/* File Preview */}
              {csvPreview && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    {csvFile && isPdfFile(csvFile.name) ? 'File Info' : 'Preview (first 500 chars)'}
                  </h3>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {csvFile && isPdfFile(csvFile.name) ? csvPreview : `${csvPreview}...`}
                  </pre>
                </div>
              )}

              {/* Info Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>AI-Powered:</strong> Upload your bank statement (CSV, Excel, or PDF) and
                  GPT-4 will automatically classify all transactions. Supports Russian bank statements
                  (Т-Банк, Сбербанк, ВТБ, etc.).
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <Link
                  href="/dashboard"
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold text-center"
                >
                  Cancel
                </Link>
                <button
                  onClick={handleCsvUpload}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!csvFile || isUploading}
                >
                  {isUploading
                    ? 'Processing...'
                    : csvFile && isPdfFile(csvFile.name)
                      ? 'Upload & Parse PDF'
                      : 'Upload & Parse CSV'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========== PREVIEW MODAL ========== */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                    {uploadMode === 'statement' ? 'Review Transactions' : 'Review Subscriptions'}
                  </h2>
                  <p className="text-sm md:text-base text-gray-600 mt-1">
                    {uploadMode === 'statement'
                      ? `${selectedTransactionIds.size} of ${parsedTransactions.length} selected`
                      : `${selectedIds.size} of ${parsedSubscriptions.length} selected`}
                  </p>
                </div>
                <button onClick={() => setIsPreviewOpen(false)} className="text-gray-400 hover:text-gray-600 transition" disabled={isUploading}>
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => uploadMode === 'statement'
                    ? setSelectedTransactionIds(new Set(parsedTransactions.map((t) => t.tempId)))
                    : selectAll()}
                  className="px-3 py-1.5 text-xs md:text-sm bg-gray-100 hover:bg-gray-200 rounded transition"
                >
                  Select All
                </button>
                <button
                  onClick={() => uploadMode === 'statement'
                    ? setSelectedTransactionIds(new Set())
                    : deselectAll()}
                  className="px-3 py-1.5 text-xs md:text-sm bg-gray-100 hover:bg-gray-200 rounded transition"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="space-y-3">
                {uploadMode === 'statement' ? (
                  parsedTransactions.map((tx) => {
                    const selected = selectedTransactionIds.has(tx.tempId);
                    return (
                      <div
                        key={tx.tempId}
                        onClick={() => toggleTransaction(tx.tempId)}
                        className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 border-2 rounded-lg transition cursor-pointer ${
                          selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                            {selected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{tx.description || tx.counterparty || '—'}</div>
                          <div className="text-xs md:text-sm text-gray-600 truncate">
                            {tx.category}{tx.date ? ` · ${tx.date}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                            tx.type === 'income'
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-red-100 text-red-700 border-red-200'
                          }`}>
                            {tx.type}
                          </span>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${tx.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                              ${tx.amount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  parsedSubscriptions.map((sub) => (
                    <div
                      key={sub.tempId}
                      className={`flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 p-3 md:p-4 border-2 rounded-lg transition cursor-pointer ${
                        selectedIds.has(sub.tempId) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleSelection(sub.tempId)}
                    >
                      <div className="flex-shrink-0">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedIds.has(sub.tempId) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                          {selectedIds.has(sub.tempId) && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{sub.name}</div>
                        <div className="text-xs md:text-sm text-gray-600 truncate">
                          {sub.category} • {sub.frequency}
                          {sub.merchant && ` • ${sub.merchant}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
                        <div className="text-right">
                          <div className="text-lg md:text-xl font-bold text-gray-900">${sub.amount}</div>
                          <div className="text-xs md:text-sm text-gray-500">{sub.frequency === 'monthly' ? '/month' : '/year'}</div>
                        </div>
                        <div className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-semibold border ${getConfidenceBadge(sub.confidence)}`}>
                          {sub.confidence}%
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 md:p-6 border-t border-gray-200 flex flex-col md:flex-row gap-3">
              <button onClick={() => setIsPreviewOpen(false)} className="w-full md:flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold" disabled={isUploading}>
                Cancel
              </button>
              {uploadMode === 'statement' ? (
                <button
                  onClick={saveSelectedTransactions}
                  className="w-full md:flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isUploading || selectedTransactionIds.size === 0}
                >
                  {isUploading ? 'Saving...' : `Save ${selectedTransactionIds.size} Transaction${selectedTransactionIds.size !== 1 ? 's' : ''}`}
                </button>
              ) : (
                <button
                  onClick={saveSelectedSubscriptions}
                  className="w-full md:flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isUploading || selectedIds.size === 0}
                >
                  {isUploading ? 'Saving...' : `Save ${selectedIds.size} Subscription${selectedIds.size !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
