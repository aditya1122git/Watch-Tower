import React, { useState, useEffect } from 'react';
import { Language } from '../i18n';
import { PlatformRefreshStatus } from '../types';
import { fetchPlatformRefreshStatuses, triggerPlatformRefresh } from '../api';
import {
  Clock, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck,
  Send, Sparkles, Layers, ArrowUpRight
} from 'lucide-react';

interface DataRefreshStatusProps {
  lang: Language;
  onRefreshCompleted?: () => void;
}

export const DataRefreshStatus: React.FC<DataRefreshStatusProps> = ({
  lang,
  onRefreshCompleted
}) => {
  const [statuses, setStatuses] = useState<PlatformRefreshStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshingPlatform, setRefreshingPlatform] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const loadStatuses = async () => {
    try {
      const data = await fetchPlatformRefreshStatuses();
      setStatuses(data);
    } catch (e) {
      console.error('Failed to load platform refresh statuses:', e);
    }
  };

  useEffect(() => {
    loadStatuses();
    // Poll backend every 12 seconds to keep server time synced
    const pollInterval = setInterval(loadStatuses, 12000);
    // Tick local timer every second for smooth live countdown
    const tickInterval = setInterval(() => setNowMs(Date.now()), 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
    };
  }, []);

  const handleManualRefresh = async (platformKey: string) => {
    setRefreshingPlatform(platformKey);
    try {
      await triggerPlatformRefresh(platformKey);
      await loadStatuses();
      if (onRefreshCompleted) onRefreshCompleted();
    } catch (e) {
      console.error(`Manual refresh failed for ${platformKey}:`, e);
    } finally {
      setRefreshingPlatform(null);
    }
  };

  const formatCountdown = (nextRefreshIso: string | null) => {
    if (!nextRefreshIso) return '—';
    const targetMs = new Date(nextRefreshIso).getTime();
    const diffSec = Math.floor((targetMs - nowMs) / 1000);

    if (diffSec <= 0) {
      return (
        <span className="text-sky-600 dark:text-sky-400 font-bold animate-pulse">
          {lang === 'hi' ? 'अपडेट हो रहा है...' : 'Refreshing...'}
        </span>
      );
    }

    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : `${secs}s`;

    return (
      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
        ⏱️ {timeStr}
      </span>
    );
  };

  const getPlatformIcon = (key: string) => {
    switch (key) {
      case 'facebook':
        return <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">f</span>;
      case 'instagram':
        return <span className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">📸</span>;
      case 'other':
        return <Layers className="w-5 h-5 text-indigo-500" />;
      case 'telegram':
        return <Send className="w-5 h-5 text-sky-500" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
      {/* Header bar */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 via-slate-100/70 to-white dark:from-slate-800/80 dark:via-slate-800/50 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{lang === 'hi' ? 'डेटा रिफ्रेश स्थिति (ऑटोमेटेड सायकल)' : 'Data Refresh Status (Automated Cycle)'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                ● Live Scheduler Active
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === 'hi'
                ? 'Facebook • Insta (80 min) | अन्य प्लेटफ़ॉर्म्स (10 min) | Telegram (इवेंट-आधारित नो-डुपलीकेट)'
                : 'Facebook • Insta (80 min) | Other Platforms (10 min) | Telegram (Event-based Dedup)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadStatuses}
          disabled={loading}
          title={lang === 'hi' ? 'स्थिति पुनः लोड करें' : 'Reload Statuses'}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Compact Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <th className="py-2.5 px-4">{lang === 'hi' ? 'प्लेटफ़ॉर्म' : 'Platform'}</th>
              <th className="py-2.5 px-3">{lang === 'hi' ? 'रिफ्रेश अंतराल' : 'Refresh Interval'}</th>
              <th className="py-2.5 px-3">{lang === 'hi' ? 'अंतिम अपडेट' : 'Last Updated'}</th>
              <th className="py-2.5 px-3">{lang === 'hi' ? 'अगला रिफ्रेश (काउंटडाउन)' : 'Next Refresh (Countdown)'}</th>
              <th className="py-2.5 px-3 text-center">{lang === 'hi' ? 'डेटा स्थिति' : 'Status'}</th>
              <th className="py-2.5 px-3 text-right">{lang === 'hi' ? 'कार्य' : 'Action'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {statuses.map((p) => {
              const isUpdating = p.status === 'Updating' || refreshingPlatform === p.platform;
              const isFailed = p.status === 'Failed';
              const isNew = p.status === 'New';

              return (
                <tr
                  key={p.platform}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                >
                  {/* Platform Name & Icon */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5 font-bold text-slate-900 dark:text-white">
                      {getPlatformIcon(p.platform)}
                      <div>
                        <span>{p.display_name}</span>
                        {p.platform === 'telegram' && p.deduplicated_count !== null && (
                          <span className="block text-[10px] font-normal text-sky-600 dark:text-sky-400 mt-0.5">
                            🛡️ {p.deduplicated_count} {lang === 'hi' ? 'डुपलीकेट रोके गए' : 'duplicates blocked'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Refresh Interval */}
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[11px]">
                      {p.refresh_interval}
                    </span>
                  </td>

                  {/* Last Updated */}
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {p.last_updated_display}
                    </div>
                    {isFailed && p.last_successful_update_display && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                        {lang === 'hi' ? 'सफल:' : 'Succ:'} {p.last_successful_update_display}
                      </div>
                    )}
                  </td>

                  {/* Next Refresh & Countdown */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                        {p.next_refresh_display}
                      </span>
                      {p.next_refresh && (
                        <div className="text-xs">
                          {formatCountdown(p.next_refresh)}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3 text-center">
                    {isUpdating ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800 animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Updating</span>
                      </span>
                    ) : isFailed ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                        title={p.last_error || 'API Error'}
                      >
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>Failed</span>
                      </span>
                    ) : isNew ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        <span>New</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Current</span>
                      </span>
                    )}
                  </td>

                  {/* Action Button */}
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleManualRefresh(p.platform)}
                      disabled={isUpdating}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isUpdating
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                      title={lang === 'hi' ? 'अभी रीफ़्रेश करें' : 'Refresh Now'}
                    >
                      <RefreshCw className={`w-3 h-3 ${isUpdating ? 'animate-spin' : ''}`} />
                      <span>{lang === 'hi' ? 'रिफ्रेश' : 'Sync'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Notice */}
      <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>
            {lang === 'hi'
              ? 'बैकएंड शेड्यूलर स्वायत्त रूप से चल रहा है। पेज रीलोड होने पर काउंटडाउन टाइमर रीसेट नहीं होता है।'
              : 'Backend scheduler operates autonomously. Page reloads will not reset the refresh countdowns.'}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          Strict Rate-Limit Protected • Anti-Duplicate Active
        </div>
      </div>
    </div>
  );
};
