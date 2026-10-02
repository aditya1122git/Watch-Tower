import React, { useState, useEffect } from 'react';
import { Post } from '../types';
import { Language } from '../i18n';
import { fetchLinks } from '../api';
import {
  Youtube, Facebook, Instagram, Twitter, ExternalLink,
  MessageSquare, Eye, ShieldAlert, Award, Clock, RefreshCw,
  TrendingUp, Radio, Flame, Sparkles
} from 'lucide-react';

interface SocialMediaReportProps {
  lang: Language;
}

export const SocialMediaReport: React.FC<SocialMediaReportProps> = ({ lang }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'youtube' | 'facebook' | 'instagram' | 'twitter'>('all');
  const [timeWindow, setTimeWindow] = useState<'4h' | '12h' | '24h' | 'all'>('4h');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'negative' | 'positive'>('all');
  const [isFallback, setIsFallback] = useState(false);

  const loadPosts = async () => {
    setLoading(true);
    setIsFallback(false);
    try {
      let data = await fetchLinks({
        platform: selectedPlatform !== 'all' ? selectedPlatform : undefined,
        time_window: timeWindow !== 'all' ? timeWindow : undefined,
        limit: 100,
        sort_by: 'newest'
      });
      // Exclude pure news channel bulletins if viewing all social media to keep it strictly social
      let socialPosts = data.filter(p => p.platform !== 'rss');

      if (socialPosts.length === 0 && timeWindow === '4h') {
        const fallbackData = await fetchLinks({
          platform: selectedPlatform !== 'all' ? selectedPlatform : undefined,
          limit: 100,
          sort_by: 'newest'
        });
        socialPosts = fallbackData.filter(p => p.platform !== 'rss');
        if (socialPosts.length > 0) {
          setIsFallback(true);
        }
      }

      setPosts(socialPosts);
    } catch (err) {
      console.error('Failed to load social posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [selectedPlatform, timeWindow]);

  // Aggregate stats per platform
  const ytPosts = posts.filter(p => p.platform === 'youtube');
  const fbPosts = posts.filter(p => p.platform === 'facebook');
  const igPosts = posts.filter(p => p.platform === 'instagram');
  const twPosts = posts.filter(p => p.platform === 'twitter');

  const getPlatformScore = (items: Post[]) => {
    if (!items.length) return 0;
    const total = items.reduce((acc, p) => acc + (p.sentiment_score || 0), 0);
    return Math.round(total / items.length);
  };

  // Group by author to build Line-Wise Accounts / Influencers list
  const accountMap: Record<string, {
    name: string;
    handle: string;
    label: string;
    platform: string;
    totalPosts: number;
    totalViews: number;
    totalNegComments: number;
    avgScore: number;
    profileUrl: string;
    latestPostTitle: string;
    latestPostUrl: string;
    latestVerdict: string;
  }> = {};

  posts.forEach(p => {
    const key = `${p.platform}_${p.author_handle || p.author_name}`;
    if (!accountMap[key]) {
      const cleanHandle = (p.author_handle || '').replace(/^@/, '');
      const profileUrl = p.platform === 'youtube'
        ? `https://www.youtube.com/@${cleanHandle.replace(/^UC_?/, '')}`
        : p.platform === 'twitter'
        ? `https://x.com/${cleanHandle}`
        : p.platform === 'facebook'
        ? `https://www.facebook.com/${cleanHandle}`
        : p.platform === 'instagram'
        ? `https://www.instagram.com/${cleanHandle}`
        : p.permalink_url;

      accountMap[key] = {
        name: p.author_name || cleanHandle,
        handle: p.author_handle || cleanHandle,
        label: p.author_label || 'neutral',
        platform: p.platform,
        totalPosts: 0,
        totalViews: 0,
        totalNegComments: 0,
        avgScore: 0,
        profileUrl,
        latestPostTitle: p.text,
        latestPostUrl: p.permalink_url,
        latestVerdict: p.sentiment_verdict
      };
    }
    const acc = accountMap[key];
    acc.totalPosts += 1;
    acc.totalViews += (p.views || 0);
    acc.totalNegComments += (p.negative_comment_count || 0);
    acc.avgScore += (p.sentiment_score || 0);
  });

  const accountsList = Object.values(accountMap).map(a => ({
    ...a,
    avgScore: Math.round(a.avgScore / Math.max(1, a.totalPosts))
  })).sort((a, b) => b.totalViews - a.totalViews);

  // Filter posts for the feed
  const displayPosts = posts.filter(p => {
    if (sentimentFilter === 'negative') return p.sentiment_verdict === 'Negative';
    if (sentimentFilter === 'positive') return p.sentiment_verdict === 'Positive';
    return true;
  });

  const formatRelativeTime = (isoString?: string | null) => {
    if (!isoString) return '4h';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'अभी-अभी';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = (diffMins / 60).toFixed(1);
      return `${diffHours}h ago`;
    } catch {
      return 'ताज़ा';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube': return <Youtube className="w-4 h-4 text-red-600" />;
      case 'facebook': return <Facebook className="w-4 h-4 text-blue-600" />;
      case 'instagram': return <Instagram className="w-4 h-4 text-pink-600" />;
      case 'twitter': return <Twitter className="w-4 h-4 text-sky-500" />;
      default: return <Radio className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-red-500 via-pink-500 to-sky-500 text-white shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{lang === 'hi' ? '📱 सोशल मीडिया संयुक्त रिपोर्ट (YouTube • FB • Insta • X)' : '📱 Unified Social Media Report (YouTube • FB • Insta • X)'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  {timeWindow === '4h' ? (lang === 'hi' ? '⚡ 4 घंटे की ताज़ा हलचल' : '⚡ Last 4h Fresh') : timeWindow}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'hi'
                  ? 'यूट्यूब, फेसबुक पेज, इंस्टाग्राम रील्स और एक्स का एक ही जगह पर एकीकृत विश्लेषण व लाइव सामग्री।'
                  : 'Consolidated social intelligence across all 4 major consumer platforms in a single unified view.'}
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Platform Selector & Freshness & Refresh */}
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

          <button
            onClick={loadPosts}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="Refresh Social Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Fallback notification if strict 4h window had 0 posts */}
      {isFallback && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {lang === 'hi'
                ? '⚡ पिछले 4 घंटे में कोई नई सोशल पोस्ट नहीं मिली — सबसे हालिया उपलब्ध लाइव पोस्ट्स दिखाई जा रही हैं।'
                : '⚡ 0 posts in strict last 4h — displaying latest available recent posts.'}
            </span>
          </div>
          <button
            onClick={() => setTimeWindow('all')}
            className="font-bold underline text-amber-900 dark:text-amber-100 hover:text-amber-700 cursor-pointer"
          >
            {lang === 'hi' ? 'सभी समय देखें' : 'View All'}
          </button>
        </div>
      )}

      {/* 4 PLATFORM COMPARATIVE CARDS (YOUTUBE, FB, INSTA, X) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* YouTube Card */}
        <div
          onClick={() => setSelectedPlatform(selectedPlatform === 'youtube' ? 'all' : 'youtube')}
          className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm cursor-pointer transition-all ${
            selectedPlatform === 'youtube'
              ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Youtube className="w-4 h-4 text-red-600" />
              <span>YouTube</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
              यूट्यूब
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {ytPosts.length} <span className="text-xs font-normal text-slate-400">Videos</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Net Score:</span>
            <span className={`font-bold ${getPlatformScore(ytPosts) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {getPlatformScore(ytPosts) > 0 ? `+${getPlatformScore(ytPosts)}` : getPlatformScore(ytPosts)}
            </span>
          </div>
        </div>

        {/* Facebook Card */}
        <div
          onClick={() => setSelectedPlatform(selectedPlatform === 'facebook' ? 'all' : 'facebook')}
          className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm cursor-pointer transition-all ${
            selectedPlatform === 'facebook'
              ? 'border-blue-500 ring-2 ring-blue-400 bg-blue-50/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Facebook className="w-4 h-4 text-blue-600" />
              <span>Facebook</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              फेसबुक
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {fbPosts.length} <span className="text-xs font-normal text-slate-400">Posts</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Net Score:</span>
            <span className={`font-bold ${getPlatformScore(fbPosts) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {getPlatformScore(fbPosts) > 0 ? `+${getPlatformScore(fbPosts)}` : getPlatformScore(fbPosts)}
            </span>
          </div>
        </div>

        {/* Instagram Card */}
        <div
          onClick={() => setSelectedPlatform(selectedPlatform === 'instagram' ? 'all' : 'instagram')}
          className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm cursor-pointer transition-all ${
            selectedPlatform === 'instagram'
              ? 'border-pink-500 ring-2 ring-pink-400 bg-pink-50/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-pink-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Instagram className="w-4 h-4 text-pink-600" />
              <span>Instagram</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300">
              इंस्टाग्राम
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {igPosts.length} <span className="text-xs font-normal text-slate-400">Reels/Posts</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Net Score:</span>
            <span className={`font-bold ${getPlatformScore(igPosts) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {getPlatformScore(igPosts) > 0 ? `+${getPlatformScore(igPosts)}` : getPlatformScore(igPosts)}
            </span>
          </div>
        </div>

        {/* Twitter / X Card */}
        <div
          onClick={() => setSelectedPlatform(selectedPlatform === 'twitter' ? 'all' : 'twitter')}
          className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm cursor-pointer transition-all ${
            selectedPlatform === 'twitter'
              ? 'border-sky-500 ring-2 ring-sky-400 bg-sky-50/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-sky-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Twitter className="w-4 h-4 text-sky-500" />
              <span>X (Twitter)</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
              ट्विटर
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {twPosts.length} <span className="text-xs font-normal text-slate-400">Tweets</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Net Score:</span>
            <span className={`font-bold ${getPlatformScore(twPosts) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {getPlatformScore(twPosts) > 0 ? `+${getPlatformScore(twPosts)}` : getPlatformScore(twPosts)}
            </span>
          </div>
        </div>
      </div>

      {/* PLATFORM SWITCHER TABS & SENTIMENT FILTERS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Platform Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'all', label: lang === 'hi' ? '🌟 सभी सोशल मीडिया' : '🌟 All Social Media' },
            { id: 'youtube', label: '📹 YouTube' },
            { id: 'facebook', label: '📘 Facebook' },
            { id: 'instagram', label: '📸 Instagram' },
            { id: 'twitter', label: '🐦 X / Twitter' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPlatform(p.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedPlatform === p.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Sentiment Filter */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setSentimentFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
              sentimentFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500'
            }`}
          >
            {lang === 'hi' ? 'सभी' : 'All'}
          </button>
          <button
            onClick={() => setSentimentFilter('negative')}
            className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
              sentimentFilter === 'negative'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-600'
            }`}
          >
            {lang === 'hi' ? '🔴 नकारात्मक' : '🔴 Negative'}
          </button>
          <button
            onClick={() => setSentimentFilter('positive')}
            className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
              sentimentFilter === 'positive'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-600'
            }`}
          >
            {lang === 'hi' ? '🟢 सकारात्मक' : '🟢 Positive'}
          </button>
        </div>
      </div>

      {/* SECTION 1: LINE-WISE TOP SOCIAL MEDIA HANDLES & PAGES */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-500" />
              <span>{lang === 'hi' ? 'प्रमुख सोशल मीडिया पेज व चैनल (लाइन-वाइज सूची)' : 'Top Monitored Pages & Influencers (Line-Wise)'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'hi'
                ? 'प्रत्येक पेज/हैंडल का प्लेटफॉर्म, रीच, पोस्ट संख्या, और रुख'
                : 'Line-by-line summary of tracked profiles, viewership reach, and stance'}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {accountsList.length} {lang === 'hi' ? 'अकाउंट सक्रिय' : 'Profiles'}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {accountsList.slice(0, 10).map((acc, idx) => (
            <div
              key={idx}
              className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-3 sm:w-72 shrink-0">
                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                  {getPlatformIcon(acc.platform)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {acc.name}
                    </h4>
                    {acc.label === 'opposition' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">🔴 विपक्ष</span>}
                    {acc.label === 'news-media' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">📺 न्यूज़</span>}
                    {acc.label === 'creator' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">🎬 क्रिएटर</span>}
                    {acc.label === 'official' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">🔵 ऑफिशियल</span>}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono block">
                    @{acc.handle}
                  </span>
                </div>
              </div>

              {/* Score & Stance */}
              <div className="flex items-center gap-2 sm:w-40 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  acc.avgScore > 10
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : acc.avgScore < -10
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {acc.avgScore > 10 ? 'Supportive' : acc.avgScore < -10 ? 'Critical' : 'Neutral'}
                </span>
                <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                  {acc.avgScore > 0 ? `+${acc.avgScore}` : acc.avgScore}
                </span>
              </div>

              {/* Views & Post count */}
              <div className="flex items-center gap-4 sm:w-48 shrink-0 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Posts in 4h</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{acc.totalPosts}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Views</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{acc.totalViews.toLocaleString()}</span>
                </div>
              </div>

              {/* Latest post snippet */}
              <div className="flex-1 min-w-[180px] text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                "{acc.latestPostTitle.slice(0, 80)}..."
              </div>

              {/* Direct Profile Link */}
              <div className="shrink-0">
                <a
                  href={acc.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                >
                  <span>{lang === 'hi' ? 'प्रोफ़ाइल देखें' : 'View Profile'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: LIVE SOCIAL MEDIA POSTS FEED (WITHIN 4 HOURS) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-sky-500 animate-pulse" />
              <span>{lang === 'hi' ? 'ताज़ा सोशल मीडिया फ़ीड (पिछले 4 घंटे की पोस्ट्स)' : 'Fresh Social Media Stream (Last 4h Posts)'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'hi'
                ? 'YouTube, Facebook, Instagram और X पर वायरल हो रही ताज़ा पोस्ट्स व प्रतिक्रियाएँ'
                : 'Real-time social media posts detected within the selected freshness window'}
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {displayPosts.length} {lang === 'hi' ? 'पोस्ट्स' : 'Items'}
          </span>
        </div>

        {displayPosts.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">
              {lang === 'hi' ? 'पिछले 4 घंटे में कोई सोशल पोस्ट नहीं मिली।' : 'No social posts found within this freshness window.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayPosts.map(post => (
              <div
                key={post.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Platform & Author header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-white dark:bg-slate-900 shadow-2xs">
                        {getPlatformIcon(post.platform)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block line-clamp-1">
                            {post.author_name}
                          </span>
                          {post.author_label === 'opposition' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">🔴 विपक्ष</span>
                          )}
                          {post.author_label === 'news-media' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">📺 न्यूज़</span>
                          )}
                          {post.author_label === 'creator' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">🎬 क्रिएटर</span>
                          )}
                          {post.author_label === 'official' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">🔵 ऑफिशियल</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          @{post.author_handle}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded">
                      {formatRelativeTime(post.posted_at)}
                    </span>
                  </div>

                  {/* Post Text */}
                  <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-3 mb-3 leading-relaxed">
                    {post.text}
                  </p>
                </div>

                {/* Footer with sentiment & engagement */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      post.sentiment_verdict === 'Positive'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : post.sentiment_verdict === 'Negative'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {post.sentiment_verdict}
                    </span>

                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {(post.views || 0).toLocaleString()}
                    </span>

                    {post.negative_comment_count > 0 && (
                      <span className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        {post.negative_comment_count}
                      </span>
                    )}
                  </div>

                  <a
                    href={post.permalink_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 hover:underline"
                  >
                    <span>{lang === 'hi' ? 'पोस्ट खोलें' : 'Open'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
