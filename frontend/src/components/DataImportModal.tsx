import React, { useState } from 'react';
import { uploadDataFile } from '../api';
import { Language } from '../i18n';
import { X, UploadCloud, CheckCircle, AlertCircle, FileText } from 'lucide-react';

interface DataImportModalProps {
  lang: Language;
  onClose: () => void;
  onSuccess: () => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({ lang, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await uploadDataFile(file);
      setResult(res);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {lang === 'hi' ? 'डेटा फ़ाइल आयात (Meta / CSV / JSON)' : 'Import Social Data (Meta / CSV / JSON)'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-500">
            Upload exported posts or comments. The system will automatically normalize URLs, classify multilingual sentiment, salt-hash commenter IDs, and check for 500+ negative alerts.
          </p>

          {/* Drag & drop dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-sky-500 transition-colors cursor-pointer bg-slate-50/50 dark:bg-slate-800/30"
          >
            <input
              type="file"
              id="file-upload"
              accept=".csv,.json"
              onChange={(e) => e.target.files && setFile(e.target.files[0])}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <UploadCloud className="w-10 h-10 text-sky-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {file ? file.name : 'Click to browse or drag and drop CSV / JSON'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Supports Meta Graph JSON exports & standardized CSV format
              </p>
            </label>
          </div>

          {result && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{result.message}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              disabled={!file || loading}
              onClick={handleUpload}
              className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              {loading ? 'Processing...' : 'Upload & Process'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
