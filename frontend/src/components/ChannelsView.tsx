import React, { useState, useEffect } from 'react';
import { Post } from '../types';
import { Language, translations } from '../i18n';
import {
  fetchNewsChannelReport,
  NewsChannelReport,
  fetchBiharMediaReport,
  BiharMediaReport,
  BiharMediaChannel,
  getDownloadPdfUrl
} from '../api';
import {
  Tv, Radio, ExternalLink, TrendingUp, TrendingDown, Eye, MessageSquare,
  AlertCircle, Download, CheckCircle2, ShieldAlert, Award, BarChart2,
  Clock, Flame, CheckCircle, RefreshCw, Layers, Youtube, Facebook, Instagram
} from 'lucide-react';

interface ChannelsViewProps {
  posts: Post[];
  lang: Language;
}

export const ChannelsView: React.FC<ChannelsViewProps> = ({ posts, lang }) => {
  const [activeSubTab, setActiveSubTab] = useState<'news' | 'youtube' | 'facebook' | 'instagram' | 'all'>('news');
  const [timeWindow, setTimeWindow] = useState<'4h' | '12h' | '24h' | 'all'>('4h');
  const [biharReport, setBiharReport] = useState<BiharMediaReport | null>(null);
  const [newsReport, setNewsReport] = useState<NewsChannelReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const t = translations[lang];

  const loadData = async () => {
    setLoading(true);
    try {
      const [biharData, generalData] = await Promise.all([
        fetchBiharMediaReport({ time_window: timeWindow !== 'all' ? timeWindow : undefined }).catch(e => {
          console.error('Bihar media report fetch error:', e);
          return null;
        }),
        fetchNewsChannelReport().catch(e => {
          console.error('General news report fetch error:', e);
          return null;
        })
      ]);
      if (biharData) setBiharReport(biharData);
      if (generalData) setNewsReport(generalData);
    } catch (err) {
      console.error('Failed to load media reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [posts, timeWindow]);

  // Aggregate stats per author
  const authorMap: Record<string, {
    name: string;
    handle: string;
    label: string;
    platform: string;
    totalPosts: number;
    totalViews: number;
    avgScore: number;
    negComments: number;
    sampleUrl: string;
    recentPosts: { id: number; title: string; url: string; verdict: string; score: number }[];
  }> = {};

  posts.forEach(p => {
    const key = `${p.platform}_${p.author_handle}`;
    if (!authorMap[key]) {
      const cleanHandle = p.author_handle.replace(/^@/, '');
      const profileUrl = p.platform === 'youtube'
        ? `https://www.youtube.com/@${cleanHandle.replace(/^UC_?/, '')}`
        : p.platform === 'twitter'
        ? `https://x.com/${cleanHandle}`
        : p.platform === 'facebook'
        ? `https://www.facebook.com/${cleanHandle}`
        : p.platform === 'instagram'
        ? `https://www.instagram.com/${cleanHandle}`
        : p.permalink_url;

      authorMap[key] = {
        name: p.author_name,
        handle: p.author_handle,
        label: p.author_label,
        platform: p.platform,
        totalPosts: 0,
        totalViews: 0,
        avgScore: 0,
        negComments: 0,
        sampleUrl: profileUrl,
        recentPosts: []
      };
    }
    const item = authorMap[key];
    item.totalPosts += 1;
    item.totalViews += p.views;
    item.avgScore += p.sentiment_score;
    item.negComments += p.negative_comment_count;
    if (item.recentPosts.length < 3) {
      item.recentPosts.push({
        id: p.id,
        title: p.text.slice(0, 100),
        url: p.permalink_url,
        verdict: p.sentiment_verdict,
        score: p.sentiment_score
      });
    }
  });

  const allChannels = Object.values(authorMap).map(c => ({
    ...c,
    avgScore: Math.round(c.avgScore / Math.max(1, c.totalPosts))
  })).sort((a, b) => b.totalViews - a.totalViews);

  const youtubeChannels = allChannels.filter(c => c.platform === 'youtube');
  const facebookChannels = allChannels.filter(c => c.platform === 'facebook');
  const instagramChannels = allChannels.filter(c => c.platform === 'instagram');

  // Filter 10 channels if one is selected
  const filtered10Channels = biharReport?.channels.filter(ch =>
    !selectedChannelId || ch.id === selectedChannelId
  ) || [];

  return (
    <div className="space-y-6">
      {/* Top Header Card with Platform Segregation Sub-tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400">
              <Tv className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{lang === 'hi' ? 'चैनल व पेज इंटेलिजेंस (अलग-अलग प्लेटफॉर्म)' : 'Channels & Pages Intelligence (Separated)'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                  {timeWindow === '4h' ? '⚡ पिछले 4 घंटे' : 'LIVE'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'hi'
                  ? 'न्यूज़ चैनल, फेसबुक पेज, इंस्टाग्राम और यूट्यूब का अलग-अलग वर्गीकृत विश्लेषण'
                  : 'Isolated views for Bihar News Channels, Facebook Pages, Instagram, and YouTube'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Sub-tab Switcher: Separate News Channels, YouTube, Facebook, Instagram */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-700 flex-wrap">
            <button
              onClick={() => setActiveSubTab('news')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'news'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? '📺 न्यूज़ चैनल (10 प्रमुख)' : '📺 News Channels'}</span>
            </button>

            <button
              onClick={() => setActiveSubTab('youtube')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'youtube'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Youtube className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? '📹 YouTube' : '📹 YouTube'}</span>
            </button>

            <button
              onClick={() => setActiveSubTab('facebook')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'facebook'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Facebook className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? '📘 Facebook पेज' : '📘 Facebook'}</span>
            </button>

            <button
              onClick={() => setActiveSubTab('instagram')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'instagram'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Instagram className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? '📸 Instagram' : '📸 Instagram'}</span>
            </button>

            <button
              onClick={() => setActiveSubTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeSubTab === 'all'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>{t.newsMedia.allChannels}</span>
            </button>
          </div>

          {/* Freshness Window Selector */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-slate-400 px-1 font-bold text-[10px]">
              {lang === 'hi' ? 'विंडो:' : 'Window:'}
            </span>
            {(['4h', '12h', '24h', 'all'] as const).map(tw => (
              <button
                key={tw}
                onClick={() => setTimeWindow(tw)}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                  timeWindow === tw
                    ? 'bg-amber-400 text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {tw === '4h' ? (lang === 'hi' ? '⚡ 4 घंटे' : '⚡ 4h') : tw}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Download PDF Button */}
          <a
            href={getDownloadPdfUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.actions.downloadPdf}</span>
          </a>
        </div>
      </div>

      {/* VIEW 1: 10 BIHAR NEWS CHANNELS DEDICATED MATRIX & COMPARATIVE GRAPH */}
      {activeSubTab === 'news' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          {biharReport && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">
                    {lang === 'hi' ? 'ट्रैक किए गए चैनल' : 'Tracked Bihar Channels'}
                  </span>
                  <Tv className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {biharReport.summary.total_channels} Outlets
                </div>
                <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                  News18, Zee, ABP, News State, Sahara, Bihar Tak, First Bihar, Live Cities, News4Nation, Hindustani
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">
                    {lang === 'hi' ? `कवरेज (${timeWindow === '4h' ? 'ताजा 4 घंटे' : 'कुल'})` : 'Analyzed Coverage'}
                  </span>
                  <Eye className="w-4 h-4 text-sky-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {biharReport.summary.total_posts_tracked}
                </div>
                <div className="flex items-center gap-2 text-[11px] mt-1 font-semibold">
                  <span className="text-emerald-600">+{biharReport.summary.total_positive_posts} Pos</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-rose-600">-{biharReport.summary.total_negative_posts} Neg</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">{biharReport.summary.total_neutral_posts} Neu</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">
                    {lang === 'hi' ? 'सर्वाधिक आलोचनात्मक' : 'Top Critical Outlet'}
                  </span>
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-lg font-black text-rose-600 dark:text-rose-400 truncate">
                  {biharReport.summary.top_critical_channel}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {lang === 'hi' ? 'विपक्ष के बयानों और विवाद पर फोकस' : 'Highest critical coverage on CM'}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">
                    {lang === 'hi' ? 'सर्वाधिक सकारात्मक / तटस्थ' : 'Top Supportive / Balanced'}
                  </span>
                  <Award className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 truncate">
                  {biharReport.summary.top_supportive_channel}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {lang === 'hi' ? 'विकास कार्यों व सरकार के जवाब का कवरेज' : 'Balanced or positive tone'}
                </div>
              </div>
            </div>
          )}

          {/* SIDE-BY-SIDE SECTION: COMPARATIVE GRAPH (LEFT) & INTELLIGENCE RADAR (RIGHT) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT: SIDE-BY-SIDE COMPARATIVE GRAPH (7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-rose-500" />
                    <span>{lang === 'hi' ? '10 चैनलों का तुलनात्मक कवरेज एवं रुख (Comparative Graph)' : 'Comparative Channel Sentiment Graph'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'hi' ? 'प्रत्येक चैनल में सकारात्मक (हरा), तटस्थ (ग्रे) और आलोचनात्मक (लाल) खबरों का अनुपात' : 'Side-by-side volume and stance breakdown for each channel'}
                  </p>
                </div>

                {/* Graph Legend */}
                <div className="hidden sm:flex items-center gap-3 text-[11px] font-semibold">
                  <div className="flex items-center gap-1 text-emerald-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>Pos</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                    <span>Neu</span>
                  </div>
                  <div className="flex items-center gap-1 text-rose-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span>Neg</span>
                  </div>
                </div>
              </div>

              {/* Channel Rows */}
              <div className="space-y-3">
                {biharReport?.channels.map(ch => {
                  const maxPosts = Math.max(...(biharReport.channels.map(c => c.total_posts) || [1]), 10);
                  const isSelected = selectedChannelId === ch.id;

                  const posWidth = ch.total_posts > 0 ? (ch.positive_count / maxPosts) * 100 : 0;
                  const neuWidth = ch.total_posts > 0 ? (ch.neutral_count / maxPosts) * 100 : 0;
                  const negWidth = ch.total_posts > 0 ? (ch.negative_count / maxPosts) * 100 : 0;

                  return (
                    <div
                      key={ch.id}
                      onClick={() => setSelectedChannelId(isSelected ? null : ch.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 shadow-sm'
                          : 'border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: ch.color }}
                          />
                          <span className="font-bold text-slate-900 dark:text-white">
                            {ch.name}
                          </span>
                          {ch.total_posts > 0 ? (
                            <span className="text-[10px] text-slate-400">({ch.total_posts} खबरें)</span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">(सक्रिय मॉनिटरिंग)</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ch.stance_color === 'rose'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : ch.stance_color === 'emerald'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {ch.stance.split(' ')[0]}
                          </span>
                          <span className={`font-bold ${
                            ch.sentiment_score > 0 ? 'text-emerald-600' : ch.sentiment_score < 0 ? 'text-rose-600' : 'text-slate-400'
                          }`}>
                            {ch.sentiment_score > 0 ? `+${ch.sentiment_score}` : ch.sentiment_score}
                          </span>
                        </div>
                      </div>

                      {/* Stacked Comparative Bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden flex items-center">
                        {ch.total_posts === 0 ? (
                          <div className="w-full text-[9px] text-slate-400 text-center select-none font-mono">
                            No posts in this window
                          </div>
                        ) : (
                          <>
                            {ch.positive_count > 0 && (
                              <div
                                style={{ width: `${Math.max(5, posWidth)}%` }}
                                className="bg-emerald-500 h-full flex items-center justify-center text-[9px] text-white font-bold"
                                title={`Positive: ${ch.positive_count}`}
                              >
                                {ch.positive_count}
                              </div>
                            )}
                            {ch.neutral_count > 0 && (
                              <div
                                style={{ width: `${Math.max(5, neuWidth)}%` }}
                                className="bg-slate-400 dark:bg-slate-600 h-full flex items-center justify-center text-[9px] text-white font-bold"
                                title={`Neutral: ${ch.neutral_count}`}
                              >
                                {ch.neutral_count}
                              </div>
                            )}
                            {ch.negative_count > 0 && (
                              <div
                                style={{ width: `${Math.max(5, negWidth)}%` }}
                                className="bg-rose-500 h-full flex items-center justify-center text-[9px] text-white font-bold"
                                title={`Negative: ${ch.negative_count}`}
                              >
                                {ch.negative_count}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedChannelId && (
                <div className="mt-3 flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60">
                  <span>फ़िल्टर सक्रिय: नीचे केवल चयनित चैनल की खबरें दिखाई जा रही हैं।</span>
                  <button
                    onClick={() => setSelectedChannelId(null)}
                    className="font-bold underline ml-2 hover:text-rose-800 cursor-pointer"
                  >
                    सभी 10 दिखाएं
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT: EDITORIAL RADAR & CRITICAL ALERTS BREAKDOWN (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Critical Channels Warning Box */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600">
                    <Flame className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      {lang === 'hi' ? 'उच्च जोखिम वाले चैनल (आलोचनात्मक फोकस)' : 'Critical Coverage Radar'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {lang === 'hi' ? 'जहाँ सीएम पर सीधे हमले और विपक्ष का कवरेज ज्यादा है' : 'Channels highlighting opposition attacks & controversy'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {biharReport?.rankings.most_critical.length ? (
                    biharReport.rankings.most_critical.map((name, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold flex items-center justify-center text-[10px]">
                            {i + 1}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{name}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                          CRITICAL
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 italic">No critical channels in this window.</div>
                  )}
                </div>
              </div>

              {/* Supportive / Neutral Channels Box */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                    <Award className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      {lang === 'hi' ? 'सकारात्मक व संतुलित चैनल' : 'Supportive / Balanced Channels'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {lang === 'hi' ? 'सरकारी नीतियां, बयान व सकारात्मक कवरेज' : 'Channels with positive development coverage'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {biharReport?.rankings.most_supportive.length ? (
                    biharReport.rankings.most_supportive.map((name, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center text-[10px]">
                            {i + 1}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{name}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                          BALANCED / PRO
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 italic">No exclusively positive channels detected.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 10 CHANNELS COMPREHENSIVE CARDS GRID */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-rose-500" />
                  <span>{lang === 'hi' ? '10 प्रमुख बिहार चैनल विस्तृत रिपोर्ट एवं खबरें' : '10 Bihar Channel Cards & Live Stories'}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'hi'
                    ? 'प्रत्येक चैनल की नवीनतम रिपोर्ट, वीडियो और रुख (क्लिक करके सीधे देखें)'
                    : 'Detailed cards with live headlines and direct watch links'}
                </p>
              </div>

              {selectedChannelId && (
                <button
                  onClick={() => setSelectedChannelId(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  Clear Channel Filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered10Channels.map(ch => (
                <div
                  key={ch.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between ${
                    ch.stance_color === 'rose'
                      ? 'border-rose-200 dark:border-rose-950'
                      : ch.stance_color === 'emerald'
                      ? 'border-emerald-200 dark:border-emerald-950'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: ch.color }}
                        />
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                            {ch.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {ch.id}
                          </span>
                        </div>
                      </div>

                      {/* Stance Badge */}
                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ch.stance_color === 'rose'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                            : ch.stance_color === 'emerald'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {ch.stance}
                        </span>
                        <div className={`text-xs font-bold mt-0.5 ${
                          ch.sentiment_score > 0 ? 'text-emerald-600' : ch.sentiment_score < 0 ? 'text-rose-600' : 'text-slate-400'
                        }`}>
                          {ch.sentiment_score > 0 ? `+${ch.sentiment_score}` : ch.sentiment_score} Score
                        </div>
                      </div>
                    </div>

                    {/* Mini Breakdown Grid */}
                    <div className="grid grid-cols-4 gap-1.5 py-2 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 mb-3 text-center">
                      <div>
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">Total</div>
                        <div className="text-xs font-black text-slate-800 dark:text-slate-200">{ch.total_posts}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-emerald-600 uppercase font-semibold">Pos</div>
                        <div className="text-xs font-black text-emerald-600">{ch.positive_count}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-rose-600 uppercase font-semibold">Neg</div>
                        <div className="text-xs font-black text-rose-600">{ch.negative_count}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">Neu</div>
                        <div className="text-xs font-black text-slate-600 dark:text-slate-400">{ch.neutral_count}</div>
                      </div>
                    </div>

                    {/* Recent Stories Covered */}
                    <div className="space-y-2 mb-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {lang === 'hi' ? 'नवीनतम रिपोर्ट व हेडलाइंस' : 'Recent Coverage / Stories'}
                      </div>

                      {ch.recent_posts.length > 0 ? (
                        ch.recent_posts.map((rp, rIdx) => (
                          <a
                            key={rIdx}
                            href={rp.permalink_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-800"
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2 font-medium">
                                {rp.title}
                              </p>
                              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px]">
                              <span className={`font-bold ${
                                rp.sentiment_verdict === 'Positive'
                                  ? 'text-emerald-600'
                                  : rp.sentiment_verdict === 'Negative'
                                  ? 'text-rose-600'
                                  : 'text-slate-500'
                              }`}>
                                {rp.sentiment_verdict}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-400 capitalize">{rp.platform}</span>
                            </div>
                          </a>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-400 italic bg-slate-50/50 dark:bg-slate-800/20 rounded-lg">
                          {lang === 'hi' ? 'इस समय सीमा में कोई नई खबर नहीं' : 'No posts in this window'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action */}
                  {ch.recent_posts[0] && (
                    <a
                      href={ch.recent_posts[0].permalink_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors border border-slate-200 dark:border-slate-700"
                    >
                      <span>{lang === 'hi' ? 'ताजा वीडियो / बुलेटिन देखें' : 'Watch Latest Broadcast'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: YOUTUBE DEDICATED CHANNELS */}
      {activeSubTab === 'youtube' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-600" />
                <span>{lang === 'hi' ? 'यूट्यूब चैनल व वीडियो कवरेज' : 'YouTube Channels & Video Broadcasts'}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'hi' ? 'यूट्यूब पर चल रहे सभी समाचार बुलेटिन, इंटरव्यू व वीडियो' : 'All monitored YouTube outlets, viewership and sentiment'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {youtubeChannels.map((ch, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950 text-red-600">
                        <Youtube className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {ch.name}
                        </h4>
                        <span className="text-[11px] text-slate-400">@{ch.handle}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ch.avgScore > 10 ? 'bg-emerald-100 text-emerald-700' : ch.avgScore < -10 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {ch.avgScore > 0 ? `+${ch.avgScore}` : ch.avgScore}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 mb-3 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Videos</div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200">{ch.totalPosts}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Views</div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200">{ch.totalViews.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Recent Videos */}
                  <div className="space-y-2 mb-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Recent Videos</div>
                    {ch.recentPosts.map((rp, pIdx) => (
                      <a
                        key={pIdx}
                        href={rp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs border border-slate-100 dark:border-slate-800 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="line-clamp-2 text-slate-800 dark:text-slate-200 font-medium">
                            {rp.title}
                          </p>
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>

                <a
                  href={ch.sampleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 text-xs font-semibold transition-colors border border-red-200 dark:border-red-900"
                >
                  <span>Open YouTube Channel</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: FACEBOOK DEDICATED PAGES */}
      {activeSubTab === 'facebook' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Facebook className="w-5 h-5 text-blue-600" />
                <span>{lang === 'hi' ? 'फेसबुक पेज व आधिकारिक पोस्ट' : 'Facebook Pages & Public Discussions'}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'hi' ? 'सम्राट चौधरी आधिकारिक पेज व बिहार के राजनीतिक फेसबुक पेज' : 'Monitored Facebook accounts, posts and feedback'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {facebookChannels.map((ch, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600">
                        <Facebook className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {ch.name}
                        </h4>
                        <span className="text-[11px] text-slate-400">@{ch.handle}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ch.avgScore > 10 ? 'bg-emerald-100 text-emerald-700' : ch.avgScore < -10 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {ch.avgScore > 0 ? `+${ch.avgScore}` : ch.avgScore}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 mb-3 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Posts</div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200">{ch.totalPosts}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Reach</div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200">{ch.totalViews.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Recent Posts */}
                  <div className="space-y-2 mb-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Recent Posts</div>
                    {ch.recentPosts.map((rp, pIdx) => (
                      <a
                        key={pIdx}
                        href={rp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs border border-slate-100 dark:border-slate-800 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="line-clamp-2 text-slate-800 dark:text-slate-200 font-medium">
                            {rp.title}
                          </p>
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>

                <a
                  href={ch.sampleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-semibold transition-colors border border-blue-200 dark:border-blue-900"
                >
                  <span>Open Facebook Page</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 4: INSTAGRAM DEDICATED HANDLES */}
      {activeSubTab === 'instagram' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Instagram className="w-5 h-5 text-pink-600" />
                <span>{lang === 'hi' ? 'इंस्टाग्राम रील्स व हैंडल्स' : 'Instagram Reels & Handles'}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'hi' ? 'इंस्टाग्राम पर चल रही रील्स, भाषण क्लिप्स व विजुअल पोस्ट' : 'Monitored Instagram accounts and reels'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {instagramChannels.map((ch, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-pink-50 dark:bg-pink-950 text-pink-600">
                        <Instagram className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {ch.name}
                        </h4>
                        <span className="text-[11px] text-slate-400">@{ch.handle}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ch.avgScore > 10 ? 'bg-emerald-100 text-emerald-700' : ch.avgScore < -10 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {ch.avgScore > 0 ? `+${ch.avgScore}` : ch.avgScore}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 mb-3 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Reels</div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200">{ch.totalPosts}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Reel Views</div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200">{ch.totalViews.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Recent Reels */}
                  <div className="space-y-2 mb-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Recent Reels</div>
                    {ch.recentPosts.map((rp, pIdx) => (
                      <a
                        key={pIdx}
                        href={rp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs border border-slate-100 dark:border-slate-800 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="line-clamp-2 text-slate-800 dark:text-slate-200 font-medium">
                            {rp.title}
                          </p>
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>

                <a
                  href={ch.sampleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 hover:bg-pink-100 text-xs font-semibold transition-colors border border-pink-200 dark:border-pink-900"
                >
                  <span>Open Instagram Handle</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 5: ALL ENTITIES (OFFICIAL, OPPOSITION, NEWS) */}
      {activeSubTab === 'all' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'hi' ? 'सभी ट्रैक किए गए चैनल एवं पेजों का रुख' : 'All Monitored Accounts & Editorial Stance'}
            </h2>
            <p className="text-xs text-slate-500">
              Rolling stance score per entity towards CM Samrat Choudhary and administration
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                  <th className="py-2.5 px-3">Channel / Page</th>
                  <th className="py-2.5 px-3">Label</th>
                  <th className="py-2.5 px-3">Platform</th>
                  <th className="py-2.5 px-3 text-right">Posts</th>
                  <th className="py-2.5 px-3 text-right">Total Reach</th>
                  <th className="py-2.5 px-3 text-right">Negative Feedback</th>
                  <th className="py-2.5 px-3 text-center">Stance Score</th>
                  <th className="py-2.5 px-3 text-center">Profile Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {allChannels.map((ch, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">{ch.name}</div>
                      <div className="text-[11px] text-slate-400">@{ch.handle}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        ch.label === 'official' ? 'bg-indigo-100 text-indigo-700' :
                        ch.label === 'supporter' ? 'bg-emerald-100 text-emerald-700' :
                        ch.label === 'opposition' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {ch.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 capitalize text-slate-600 dark:text-slate-300">
                      {ch.platform}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">{ch.totalPosts}</td>
                    <td className="py-3 px-3 text-right font-medium">{ch.totalViews.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-rose-600 font-bold">{ch.negComments}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`font-bold ${
                        ch.avgScore > 20 ? 'text-emerald-500' : ch.avgScore < -20 ? 'text-rose-600' : 'text-slate-500'
                      }`}>
                        {ch.avgScore > 0 ? `+${ch.avgScore}` : ch.avgScore}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <a
                        href={ch.sampleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sky-600 hover:text-sky-700 text-xs font-semibold"
                      >
                        Visit <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
