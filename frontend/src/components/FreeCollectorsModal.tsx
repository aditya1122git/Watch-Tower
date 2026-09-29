import React, { useState, useEffect } from 'react';
import {
  fetchCollectors,
  runFreeCollectors,
  CollectorsResponse,
  RunFreeCollectorsResult
} from '../api';
import { Language } from '../i18n';
import {
  X,
  Globe,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight
} from 'lucide-react';

interface FreeCollectorsModalProps {
  lang: Language;
  onClose: () => void;
  onDataUpdated: () => void;
}

export const FreeCollectorsModal: React.FC<FreeCollectorsModalProps> = ({
  lang,
  onClose,
  onDataUpdated
}) => {
  const [collectorsData, setCollectorsData] = useState<CollectorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunFreeCollectorsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCollectors();
  }, []);

  const loadCollectors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCollectors();
      setCollectorsData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load collectors metadata');
    } finally {
      setLoading(false);
    }
  };

  const handleRunFree = async () => {
    setRunning(true);
    setRunResult(null);
    setError(null);
    try {
      const res = await runFreeCollectors({ max_per_platform: 10 });
      setRunResult(res);
      onDataUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to run free collectors');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'hi' ? 'लाइव फ़ीड और पब्लिक एपीआई' : 'Live Feeds & Public APIs'}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'hi'
                  ? 'मल्टी-प्लेटफ़ॉर्म लाइव निगरानी (YouTube, Twitter/X, Facebook, Instagram, Google News, Reddit, Mastodon, Wikipedia, Telegram)'
                  : 'Multi-platform live stream monitoring (YouTube, Twitter/X, Facebook, Instagram, Google News, Reddit, Mastodon, Wikipedia, Telegram)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content scroll area */}
        <div className="mt-4 space-y-5 overflow-y-auto pr-1">
          {/* Action Trigger Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-indigo-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
                  {lang === 'hi' ? 'सक्रिय एवं तैयार' : 'Live & Active'}
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target: <b>Samrat Choudhary (Bihar CM)</b>
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {lang === 'hi'
                  ? 'सभी 9 सार्वजनिक स्रोतों (YouTube, Twitter, Facebook, Instagram, News, Reddit, Mastodon, Wikipedia, Telegram) से एक क्लिक में लाइव सामग्री लाएं।'
                  : 'Trigger concurrent ingestion across all 9 platforms (YouTube, Twitter, Facebook, Instagram, News, Reddit, Mastodon, Wikipedia, Telegram).'}
              </p>
            </div>

            <button
              onClick={handleRunFree}
              disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold shadow-md transition-all shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
              <span>
                {running
                  ? (lang === 'hi' ? 'लाइव फ़ीड लोड हो रहा है...' : 'Ingesting Live Feeds...')
                  : (lang === 'hi' ? 'अभी लाइव फ़ीड लाएं' : 'Fetch Latest Feeds Now')}
              </span>
            </button>
          </div>

          {/* Success Banner if run */}
          {runResult && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100">
              <div className="flex items-center gap-2 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{runResult.message}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60">
                  <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                    {runResult.total_fetched}
                  </div>
                  <div className="text-[10px] text-slate-500">Total Items Fetched</div>
                </div>
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60">
                  <div className="text-base font-extrabold text-sky-700 dark:text-sky-300">
                    {runResult.new_posts_saved}
                  </div>
                  <div className="text-[10px] text-slate-500">New Posts Ingested</div>
                </div>
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60">
                  <div className="text-base font-extrabold text-indigo-700 dark:text-indigo-300">
                    {runResult.existing_posts_updated}
                  </div>
                  <div className="text-[10px] text-slate-500">Existing Refreshed</div>
                </div>
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60">
                  <div className="text-base font-extrabold text-amber-700 dark:text-amber-300">
                    {runResult.alerts_created}
                  </div>
                  <div className="text-[10px] text-slate-500">Alerts Evaluated</div>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* 5 Free Public Collectors Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'hi' ? 'सक्रिय लाइव एडेप्टर (9 Sources)' : 'Active Live Adapters (9 Sources)'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {collectorsData?.free_public_collectors.map((col) => (
                <div
                  key={col.platform}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {col.display_name}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        No Key Needed
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {col.description}
                    </p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap gap-1">
                    {col.features.map((feat, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Key-Based Adapters */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>{lang === 'hi' ? 'वैकल्पिक आधिकारिक एपीआई (कुंजी वैकल्पिक)' : 'Optional Key-Based Official APIs'}</span>
            </h4>

            <div className="space-y-2">
              {collectorsData?.key_based_collectors.map((col) => (
                <div
                  key={col.platform}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {col.display_name}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        col.has_api_key
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {col.has_api_key ? 'API Key Configured' : 'Offline Seed & Importer Active'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {col.description}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono shrink-0 ml-2">
                    {col.rate_limit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>AI Sentiment: <b>{collectorsData?.active_llm_provider || 'Local Multilingual Engine'}</b></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
          >
            {lang === 'hi' ? 'बंद करें' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
