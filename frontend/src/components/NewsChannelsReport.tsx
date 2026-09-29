import React, { useState, useEffect } from 'react';
import { Language, translations } from '../i18n';
import {
  fetchBiharMediaReport,
  BiharMediaReport,
  BiharMediaChannel,
  getDownloadPdfUrl
} from '../api';
import {
  Tv, ExternalLink, ShieldAlert, Award, BarChart2,
  Clock, Flame, RefreshCw, ChevronDown, ChevronUp, PlayCircle
} from 'lucide-react';

interface NewsChannelsReportProps {
  lang: Language;
}

export const NewsChannelsReport: React.FC<NewsChannelsReportProps> = ({ lang }) => {
  const [timeWindow, setTimeWindow] = useState<'4h' | '12h' | '24h' | 'all'>('4h');
  const [report, setReport] = useState<BiharMediaReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);
  const [filterStance, setFilterStance] = useState<'all' | 'critical' | 'supportive' | 'neutral'>('all');

  const t = translations[lang];

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchBiharMediaReport({
        time_window: timeWindow !== 'all' ? timeWindow : undefined
      });
      if (data) setReport(data);
    } catch (err) {
      console.error('Failed to load Bihar Media Report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeWindow]);

  const toggleExpand = (id: string) => {
    setExpandedChannelId(expandedChannelId === id ? null : id);
  };

  // Filter channels if user clicked stance filter
  const channels = report?.channels.filter(ch => {
    if (filterStance === 'critical') return ch.stance_color === 'rose';
    if (filterStance === 'supportive') return ch.stance_color === 'emerald';
    if (filterStance === 'neutral') return ch.stance_color === 'slate';
    return true;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{lang === 'hi' ? '📺 10 प्रमुख बिहार न्यूज़ चैनल रिपोर्ट (लाइन-वाइज विश्लेषण)' : '📺 10 Bihar News Channels Report (Line-Wise Analysis)'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                  {timeWindow === '4h' ? (lang === 'hi' ? '⚡ 4 घंटे की ताज़ा खबरें' : '⚡ Last 4h Fresh') : timeWindow}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'hi'
                  ? 'News18, Zee, ABP, News State, Sahara Samay, Bihar Tak, First Bihar, Live Cities, News4Nation, Hindustani Media'
                  : 'Line-by-line comparative stance, sentiment score, broadcast volume, and latest news reports.'}
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Freshness & Stance Filter & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Freshness Window Selector */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-slate-400 px-1 font-bold text-[10px] flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-500" />
              {lang === 'hi' ? 'विंडो:' : 'Window:'}
            </span>
            {(['4h', '12h', '24h', 'all'] as const).map(tw => (
              <button
                key={tw}
                onClick={() => setTimeWindow(tw)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  timeWindow === tw
                    ? 'bg-amber-400 text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tw === '4h' ? (lang === 'hi' ? '⚡ 4 घंटे' : '⚡ 4h') : tw}
              </button>
            ))}
          </div>

          {/* Stance Filter */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setFilterStance('all')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                filterStance === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {lang === 'hi' ? 'सभी 10' : 'All 10'}
            </button>
            <button
              onClick={() => setFilterStance('critical')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                filterStance === 'critical'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              }`}
            >
              {lang === 'hi' ? '🔴 आलोचनात्मक' : '🔴 Critical'}
            </button>
            <button
              onClick={() => setFilterStance('supportive')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                filterStance === 'supportive'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
            >
              {lang === 'hi' ? '🟢 सकारात्मक' : '🟢 Supportive'}
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">
                {lang === 'hi' ? 'ट्रैक किए गए चैनल' : 'Tracked Bihar Outlets'}
              </span>
              <Tv className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {report.summary.total_channels} Channels
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              100% लाइन-वाइज कवरेज
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">
                {lang === 'hi' ? `कुल खबरें (${timeWindow === '4h' ? 'ताजा 4 घंटे' : 'कुल'})` : 'Total Broadcasts Analyzed'}
              </span>
              <BarChart2 className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {report.summary.total_posts_tracked}
            </div>
            <div className="flex items-center gap-2 text-[11px] mt-1 font-semibold">
              <span className="text-emerald-600">+{report.summary.total_positive_posts} Pos</span>
              <span className="text-slate-400">•</span>
              <span className="text-rose-600">-{report.summary.total_negative_posts} Neg</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">{report.summary.total_neutral_posts} Neu</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold text-rose-600">
                {lang === 'hi' ? 'शीर्ष आलोचनात्मक चैनल' : 'Top Critical Outlet'}
              </span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-lg font-black text-rose-600 dark:text-rose-400 truncate">
              {report.summary.top_critical_channel}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {lang === 'hi' ? 'सीएम पर नकारात्मक बयानों का अनुपात अधिक' : 'Highest critical stance'}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold text-emerald-600">
                {lang === 'hi' ? 'शीर्ष सकारात्मक / संतुलित' : 'Top Supportive / Balanced'}
              </span>
              <Award className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 truncate">
              {report.summary.top_supportive_channel}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {lang === 'hi' ? 'विकास कार्यों व सरकारी पक्ष का कवरेज' : 'Balanced or supportive tone'}
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparative Graph */}
      {report && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-rose-500" />
                <span>{lang === 'hi' ? '10 चैनलों का साइड-बाई-साइड तुलनात्मक ग्राफ' : 'Side-by-Side Channel Comparison Graph'}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'hi' ? 'सकारात्मक (हरा), तटस्थ (ग्रे) और आलोचनात्मक (लाल) का तुलनात्मक अनुपात' : 'Comparative volume & sentiment split per outlet'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>{lang === 'hi' ? 'सकारात्मक' : 'Positive'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span>{lang === 'hi' ? 'तटस्थ' : 'Neutral'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>{lang === 'hi' ? 'आलोचनात्मक' : 'Critical'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2.5">
            {report.channels.map(ch => {
              const maxPosts = Math.max(...report.channels.map(c => c.total_posts), 1);
              const heightPct = Math.max(15, Math.round((ch.total_posts / maxPosts) * 100));

              return (
                <div
                  key={ch.id}
                  className="flex flex-col items-center justify-end p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center"
                >
                  <div className="text-[10px] font-black mb-1 text-slate-700 dark:text-slate-300">
                    {ch.total_posts}
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-lg h-24 flex flex-col justify-end overflow-hidden p-0.5">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full flex flex-col rounded-md overflow-hidden transition-all duration-500"
                    >
                      {ch.positive_count > 0 && (
                        <div
                          style={{ flex: ch.positive_count }}
                          className="bg-emerald-500 w-full"
                          title={`Positive: ${ch.positive_count}`}
                        />
                      )}
                      {ch.neutral_count > 0 && (
                        <div
                          style={{ flex: ch.neutral_count }}
                          className="bg-slate-400 dark:bg-slate-500 w-full"
                          title={`Neutral: ${ch.neutral_count}`}
                        />
                      )}
                      {ch.negative_count > 0 && (
                        <div
                          style={{ flex: ch.negative_count }}
                          className="bg-rose-500 w-full"
                          title={`Negative: ${ch.negative_count}`}
                        />
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate w-full" title={ch.name}>
                    {ch.short_name}
                  </div>
                  <span className={`mt-0.5 text-[9px] font-bold px-1 py-0.2 rounded ${
                    ch.stance_color === 'rose'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                      : ch.stance_color === 'emerald'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {ch.sentiment_score > 0 ? `+${ch.sentiment_score}` : ch.sentiment_score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LINE-WISE NEWS CHANNELS TABLE & REPORT */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Tv className="w-5 h-5 text-rose-500" />
              <span>{lang === 'hi' ? '10 प्रमुख बिहार चैनल (लाइन-वाइज सूची व ताज़ा रिपोर्ट)' : '10 Bihar News Channels (Line-Wise Analysis & Broadcasts)'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'hi'
                ? 'प्रत्येक पंक्ति में चैनल का रुख, कुल खबरें, पॉजिटिव/नेगेटिव अनुपात और ताज़ा हेडलाइंस (विस्तार करने के लिए क्लिक करें)'
                : 'Each row provides channel stance, broadcast count, positive/negative ratio, and latest headline with direct link.'}
            </p>
          </div>

          <div className="text-xs text-slate-400 font-semibold">
            {channels.length} {lang === 'hi' ? 'चैनल सूचीबद्ध' : 'Channels Listed'}
          </div>
        </div>

        {/* LINE-WISE ROWS LIST */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {channels.map((ch, index) => {
            const isExpanded = expandedChannelId === ch.id;
            const posPct = ch.total_posts > 0 ? Math.round((ch.positive_count / ch.total_posts) * 100) : 0;
            const negPct = ch.total_posts > 0 ? Math.round((ch.negative_count / ch.total_posts) * 100) : 0;
            const neuPct = ch.total_posts > 0 ? 100 - (posPct + negPct) : 0;
            const latestPost = ch.recent_posts[0];

            return (
              <div
                key={ch.id}
                className={`transition-colors ${
                  isExpanded
                    ? 'bg-slate-50/80 dark:bg-slate-800/40'
                    : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                }`}
              >
                {/* Main Row / Line */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Part 1: Channel Info & Rank */}
                  <div className="flex items-center gap-3 sm:w-72 shrink-0">
                    <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                      {index + 1}
                    </span>

                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: ch.color }}
                    />

                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                        <span>{ch.name}</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {ch.id}
                      </span>
                    </div>
                  </div>

                  {/* Part 2: Stance & Sentiment Score */}
                  <div className="flex items-center gap-2 sm:w-48 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      ch.stance_color === 'rose'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                        : ch.stance_color === 'emerald'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}>
                      {ch.stance}
                    </span>
                    <span className={`text-xs font-black ${
                      ch.sentiment_score > 0 ? 'text-emerald-600' : ch.sentiment_score < 0 ? 'text-rose-600' : 'text-slate-400'
                    }`}>
                      {ch.sentiment_score > 0 ? `+${ch.sentiment_score}` : ch.sentiment_score}
                    </span>
                  </div>

                  {/* Part 3: Volume & Visual Progress Bar */}
                  <div className="sm:w-64 shrink-0 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 dark:text-slate-200">
                        {ch.total_posts} {lang === 'hi' ? 'खबरें' : 'Posts'}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-emerald-600 font-bold">+{ch.positive_count}</span>
                        <span className="text-slate-300 dark:text-slate-600">/</span>
                        <span className="text-rose-600 font-bold">-{ch.negative_count}</span>
                        <span className="text-slate-300 dark:text-slate-600">/</span>
                        <span className="text-slate-500 font-semibold">{ch.neutral_count}</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden flex items-center">
                      {ch.total_posts === 0 ? (
                        <div className="w-full text-[8px] text-slate-400 text-center font-mono">
                          0 posts in 4h
                        </div>
                      ) : (
                        <>
                          {posPct > 0 && (
                            <div
                              style={{ width: `${posPct}%` }}
                              className="bg-emerald-500 h-full"
                              title={`Positive: ${ch.positive_count} (${posPct}%)`}
                            />
                          )}
                          {neuPct > 0 && (
                            <div
                              style={{ width: `${neuPct}%` }}
                              className="bg-slate-400 dark:bg-slate-600 h-full"
                              title={`Neutral: ${ch.neutral_count} (${neuPct}%)`}
                            />
                          )}
                          {negPct > 0 && (
                            <div
                              style={{ width: `${negPct}%` }}
                              className="bg-rose-500 h-full"
                              title={`Negative: ${ch.negative_count} (${negPct}%)`}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Part 4: Latest Headline in 4h */}
                  <div className="flex-1 min-w-[200px]">
                    {latestPost ? (
                      <a
                        href={latestPost.permalink_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200/60 dark:border-slate-700/60 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-1 group-hover:text-rose-600 font-medium">
                            {latestPost.title}
                          </p>
                          <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-rose-600 shrink-0 mt-0.5" />
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                          <span className={`font-bold ${
                            latestPost.sentiment_verdict === 'Positive'
                              ? 'text-emerald-600'
                              : latestPost.sentiment_verdict === 'Negative'
                              ? 'text-rose-600'
                              : 'text-slate-500'
                          }`}>
                            {latestPost.sentiment_verdict}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-400 font-medium capitalize">{latestPost.platform}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-rose-600 dark:text-rose-400 font-semibold group-hover:underline">
                            {lang === 'hi' ? 'लाइव देखें ↗' : 'Watch ↗'}
                          </span>
                        </div>
                      </a>
                    ) : (
                      <div className="text-xs text-slate-400 italic p-2 rounded-xl bg-slate-50 dark:bg-slate-800/30">
                        {lang === 'hi' ? 'पिछले 4 घंटे में कोई नई बुलेटिन नहीं' : 'No new broadcast in last 4 hours'}
                      </div>
                    )}
                  </div>

                  {/* Part 5: Expand / Collapse Button */}
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => toggleExpand(ch.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isExpanded
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border-rose-300 dark:border-rose-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>
                        {isExpanded
                          ? (lang === 'hi' ? 'कम करें' : 'Hide')
                          : (lang === 'hi' ? `सभी ${ch.recent_posts.length} देखें` : `All ${ch.recent_posts.length}`)}
                      </span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Dropdown / Accordion for all recent posts from this channel */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <PlayCircle className="w-4 h-4 text-rose-500" />
                      <span>{ch.name} - {lang === 'hi' ? 'ताज़ा बुलेटिन व रिपोर्ट सूची' : 'Recent Broadcasts & Stories'}</span>
                    </div>

                    {ch.recent_posts.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {ch.recent_posts.map((post, pIdx) => (
                          <a
                            key={pIdx}
                            href={post.permalink_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:border-rose-400 dark:hover:border-rose-500 shadow-xs hover:shadow-sm transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                                {post.title}
                              </p>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                              <span className={`font-bold px-1.5 py-0.5 rounded ${
                                post.sentiment_verdict === 'Positive'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : post.sentiment_verdict === 'Negative'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}>
                                {post.sentiment_verdict} ({post.sentiment_score})
                              </span>
                              <span className="text-slate-400 capitalize">
                                {post.platform} • {post.views?.toLocaleString()} views
                              </span>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic py-2">
                        {lang === 'hi' ? 'इस समय सीमा में कोई अन्य खबर नहीं मिली।' : 'No additional stories found in this window.'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
