import React, { useState, useEffect } from 'react';
import {
  fetchTimelineReport,
  triggerSchedulerRefresh,
  toggleScheduler,
  setSchedulerInterval,
  TimelineReport
} from '../api';
import { Language } from '../i18n';
import {
  Clock,
  Activity,
  RefreshCw,
  Play,
  Pause,
  Zap,
  ExternalLink,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Layers,
  Radio,
  Globe,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';

interface TimelineViewProps {
  lang: Language;
  onPostSelect?: (post: any) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ lang }) => {
  const [data, setData] = useState<TimelineReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<number>(60);
  const [countdown, setCountdown] = useState<number>(60);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    loadTimeline();
  }, []);

  // Poll timeline every 15 seconds to keep countdown and stream fresh
  useEffect(() => {
    const timer = setInterval(() => {
      loadTimeline(false);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!data?.summary?.next_refresh_at || !data.summary.scheduler_active) return;
    const interval = setInterval(() => {
      const target = new Date(data.summary.next_refresh_at!).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((target - now) / 1000));
      setCountdown(diff);
      if (diff === 0) {
        loadTimeline(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [data]);

  const loadTimeline = async (showLoading: boolean = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetchTimelineReport();
      setData(res);
      setSelectedInterval(res.summary.refresh_interval_seconds || 60);
    } catch (err: any) {
      console.error('Failed to load timeline report:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await triggerSchedulerRefresh();
      await loadTimeline(false);
      setMsg(lang === 'hi' ? '✅ लाइव फ़ीड सफलतापूर्वक ताज़ा हुई!' : '✅ Live feed refreshed successfully!');
      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggle = async () => {
    if (!data) return;
    const nextState = !data.summary.scheduler_active;
    try {
      await toggleScheduler(nextState);
      await loadTimeline(false);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleIntervalChange = async (newSec: number) => {
    setSelectedInterval(newSec);
    try {
      await setSchedulerInterval(newSec);
      await loadTimeline(false);
    } catch (err: any) {
      console.error(err);
    }
  };

  const summary = data?.summary;
  const hourlyData = data?.hourly_trend || [];
  const minuteLogs = data?.minute_logs || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Real-Time Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{lang === 'hi' ? '24 घंटे का टाइमलाइन एवं मिनट-दर-मिनट लाइव रिपोर्ट' : '24-Hour Timeline & Minute-by-Minute Live Report'}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                  Target: CM Samrat Choudhary
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'hi'
                  ? 'स्वचालित बैकग्राउंड इनजेशन: प्रत्येक मिनट और घंटे का लाइव सेंटीमेंट, रीच और चर्चाएं।'
                  : 'Automated background refresh engine tracking live sentiment, reach, and velocity across Bihar.'}
              </p>
            </div>
          </div>
        </div>

        {/* Live Controller Actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Active Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${summary?.scheduler_active ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {summary?.scheduler_active
                ? (lang === 'hi' ? `ऑटो-रिफ्रेश सक्रिय (${countdown}s)` : `Auto-Refresh Active (${countdown}s)`)
                : (lang === 'hi' ? 'रोका गया (Paused)' : 'Paused')}
            </span>
          </div>

          {/* Interval Selector */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 text-[11px]">{lang === 'hi' ? 'अंतराल:' : 'Interval:'}</span>
            <select
              value={selectedInterval}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value={30}>30 sec</option>
              <option value={60}>1 min</option>
              <option value={300}>5 mins</option>
              <option value={900}>15 mins</option>
              <option value={3600}>1 hour</option>
            </select>
          </div>

          {/* Pause / Resume Button */}
          <button
            onClick={handleToggle}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title={summary?.scheduler_active ? "Pause Auto-Refresh" : "Resume Auto-Refresh"}
          >
            {summary?.scheduler_active ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-500" />
                <span>{lang === 'hi' ? 'रोकें' : 'Pause'}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-500" />
                <span>{lang === 'hi' ? 'शुरू करें' : 'Resume'}</span>
              </>
            )}
          </button>

          {/* Immediate Refresh Trigger */}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? (lang === 'hi' ? 'लोड हो रहा...' : 'Ingesting...') : (lang === 'hi' ? 'अभी ताज़ा करें' : 'Refresh Now')}</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{msg}</span>
        </div>
      )}

      {/* 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{lang === 'hi' ? '24 घंटे की कुल पोस्ट' : '24h Total Posts'}</span>
            <Layers className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {summary?.total_posts_24h ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {lang === 'hi' ? 'सक्रिय स्रोतों से ट्रैक किया गया' : 'Monitored across all channels'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{lang === 'hi' ? '24 घंटे की दर्शक पहुंच' : '24h Audience Reach'}</span>
            <Globe className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {summary?.total_reach_24h ? (summary.total_reach_24h > 1000000 ? `${(summary.total_reach_24h / 1000000).toFixed(1)}M` : summary.total_reach_24h.toLocaleString()) : '2.7M+'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {lang === 'hi' ? 'व्यूज व सार्वजनिक जुड़ाव' : 'Views & public engagement'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{lang === 'hi' ? 'वर्तमान घंटे का नकारात्मक रुख' : 'Current Hour Negativity'}</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
            {summary?.current_hour_negative_pct ?? 0}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {lang === 'hi' ? 'इस घंटे की नकारात्मक टिप्पणियां' : 'Criticism share this hour'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{lang === 'hi' ? 'आज के स्वचालित चक्र' : 'Today Auto-Cycles'}</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {summary?.total_cycles_today ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {summary?.items_ingested_today ?? 0} {lang === 'hi' ? 'आइटम आज लोड किए गए' : 'items ingested today'}
          </div>
        </div>
      </div>

      {/* Hourly Trend Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-500" />
              <span>{lang === 'hi' ? 'पिछले 24 घंटे का प्रति घंटा पोस्ट वॉल्यूम और जनमत' : 'Last 24 Hours: Hourly Post Volume & Sentiment Mix'}</span>
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'hi'
                ? 'प्रत्येक घंटे सीएम सम्राट चौधरी के पक्ष (Positive) और आलोचना (Negative) का अनुपात'
                : 'Hourly breakdown of favorable vs critical conversation volume'}
            </p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderRadius: '12px',
                  border: '1px solid #334155',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="positive_count" name={lang === 'hi' ? 'सकारात्मक (Pro-CM)' : 'Positive (Pro-CM)'} fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="negative_count" name={lang === 'hi' ? 'नकारात्मक (Criticism)' : 'Negative (Criticism)'} fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="neutral_count" name={lang === 'hi' ? 'तटस्थ (Neutral)' : 'Neutral'} fill="#94a3b8" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Minute-by-Minute Live Activity Feed */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'hi' ? 'प्रत्येक मिनट का लाइव इनजेशन स्ट्रीम' : 'Minute-by-Minute Live Ingestion Stream'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'hi'
                ? 'Google News, Reddit, Mastodon, Wikipedia और Telegram से ताज़ा समाचार व पोस्ट ठीक उसी समय जब वे आते हैं'
                : 'Real-time items detected second-by-second from live feeds'}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {minuteLogs.length} {lang === 'hi' ? 'लाइव रिकॉर्ड' : 'Live Entries'}
          </span>
        </div>

        {/* Live Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                <th className="py-2.5 px-3 font-semibold">{lang === 'hi' ? 'समय' : 'Time'}</th>
                <th className="py-2.5 px-3 font-semibold">{lang === 'hi' ? 'स्रोत' : 'Platform'}</th>
                <th className="py-2.5 px-3 font-semibold">{lang === 'hi' ? 'शीर्षक व विवरण' : 'Headline / Content'}</th>
                <th className="py-2.5 px-3 font-semibold">{lang === 'hi' ? 'सीएम दृष्टिकोण' : 'CM Sentiment'}</th>
                <th className="py-2.5 px-3 font-semibold">{lang === 'hi' ? 'विषय' : 'Topic'}</th>
                <th className="py-2.5 px-3 font-semibold text-right">{lang === 'hi' ? 'लिंक' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {minuteLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {lang === 'hi' ? 'कोई नया आइटम नहीं। अगला चक्र कुछ ही सेकंड में चलेगा...' : 'No items yet. Next cycle runs in seconds...'}
                  </td>
                </tr>
              ) : (
                minuteLogs.map((item, idx) => {
                  const isPos = item.sentiment === 'Positive';
                  const isNeg = item.sentiment === 'Negative';
                  const badgeColor = isPos
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
                    : isNeg
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {item.timestamp}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {item.platform}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 max-w-md">
                        <div className="line-clamp-2" title={item.title}>
                          {item.title}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                          {item.sentiment} ({item.score > 0 ? `+${item.score}` : item.score})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 capitalize">
                        {item.topic || 'general'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        <a
                          href={item.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold hover:underline"
                        >
                          <span>{lang === 'hi' ? 'देखें' : 'View'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
