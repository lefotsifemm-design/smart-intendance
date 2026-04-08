'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { Upload, ArrowLeft, Plus, FileText, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  'Entertainment',
  'Software',
  'Music',
  'Cloud Storage',
  'Productivity',
  'Design',
  'Education',
  'News',
  'Fitness',
  'Food & Delivery',
  'Transportation',
  'Gaming',
  'Other',
];

export default function UploadPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'csv' | 'manual'>('manual');
  const [isUploading, setIsUploading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string>('');

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [parsedSubscriptions, setParsedSubscriptions] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvPreview(text.substring(0, 500));
    };
    reader.readAsText(file);

    toast.success('CSV file loaded! Preview available below.');
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file first');
      return;
    }

    setIsUploading(true);

    try {
      const csvContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(csvFile);
      });

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
          (sum: number, sub: any) => sum + (sub.confidence || 0),
          0
        ) / data.subscriptions.length
      );

      toast.success(
        `✅ Found ${data.count} subscription${data.count > 1 ? 's' : ''}! ` +
          `Avg confidence: ${avgConfidence}%.`,
        { duration: 3000 }
      );

      const subsWithIds = data.subscriptions.map((sub: any, index: number) => ({
        ...sub,
        tempId: index,
      }));
      setParsedSubscriptions(subsWithIds);
      setSelectedIds(new Set(subsWithIds.map((sub: any) => sub.tempId)));
      setIsPreviewOpen(true);
    } catch (error: any) {
      console.error('Error uploading CSV:', error);
      toast.error(error.message || 'Failed to upload CSV');
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

    if (!session?.user?.email) {
      toast.error('Not authenticated');
      return;
    }

    setIsUploading(true);

    try {
      const subscriptionsToInsert = selected.map((sub: any) => ({
        user_id: session.user!.email,
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

    if (!session?.user?.email) {
      toast.error('Not authenticated');
      return;
    }

    setIsUploading(true);

    try {
      const { error } = await supabase.from('subscriptions').insert({
        user_id: session.user.email,
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
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Add Subscriptions</h1>
          <p className="text-gray-600 mt-1">Upload a CSV file or add manually</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
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
              Upload CSV
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
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                  disabled={isUploading}
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    {csvFile ? csvFile.name : 'Upload CSV File'}
                  </p>
                  <p className="text-gray-600">
                    {csvFile
                      ? 'Click to change file'
                      : 'Click to browse or drag and drop your bank statement'}
                  </p>
                </label>
              </div>

              {/* CSV Preview */}
              {csvPreview && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Preview (first 500 chars)</h3>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {csvPreview}...
                  </pre>
                </div>
              )}

              {/* Info Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>AI-Powered:</strong> Upload your bank statement CSV and GPT-4 will
                  automatically detect all recurring subscriptions with confidence scores.
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
                  {isUploading ? 'Processing...' : 'Upload & Parse CSV'}
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
                    Review Subscriptions
                  </h2>
                  <p className="text-sm md:text-base text-gray-600 mt-1">
                    {selectedIds.size} of {parsedSubscriptions.length} selected
                  </p>
                </div>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition"
                  disabled={isUploading}
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 text-xs md:text-sm bg-gray-100 hover:bg-gray-200 rounded transition"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="px-3 py-1.5 text-xs md:text-sm bg-gray-100 hover:bg-gray-200 rounded transition"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Subscriptions Table */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="space-y-3">
                {parsedSubscriptions.map((sub) => (
                  <div
                    key={sub.tempId}
                    className={`flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 p-3 md:p-4 border-2 rounded-lg transition cursor-pointer ${
                      selectedIds.has(sub.tempId)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleSelection(sub.tempId)}
                  >
                    {/* Checkbox */}
                    <div className="flex-shrink-0">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedIds.has(sub.tempId)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedIds.has(sub.tempId) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>

                    {/* Subscription Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{sub.name}</div>
                      <div className="text-xs md:text-sm text-gray-600 truncate">
                        {sub.category} • {sub.frequency}
                        {sub.merchant && ` • ${sub.merchant}`}
                      </div>
                    </div>

                    {/* Amount & Confidence */}
                    <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
                      {/* Amount */}
                      <div className="text-right">
                        <div className="text-lg md:text-xl font-bold text-gray-900">
                          ${sub.amount}
                        </div>
                        <div className="text-xs md:text-sm text-gray-500">
                          {sub.frequency === 'monthly' ? '/month' : '/year'}
                        </div>
                      </div>

                      {/* Confidence Badge */}
                      <div
                        className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-semibold border ${getConfidenceBadge(
                          sub.confidence
                        )}`}
                      >
                        {sub.confidence}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 md:p-6 border-t border-gray-200 flex flex-col md:flex-row gap-3">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="w-full md:flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                onClick={saveSelectedSubscriptions}
                className="w-full md:flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isUploading || selectedIds.size === 0}
              >
                {isUploading
                  ? 'Saving...'
                  : `Save ${selectedIds.size} Subscription${selectedIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
