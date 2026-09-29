import React, { useState } from 'react';
import { Post } from '../types';
import { translations, Language } from '../i18n';
import {
  ExternalLink, Copy, Check, Download, Search, AlertTriangle,
  Youtube, Twitter, Facebook, Instagram, Rss, Eye, ThumbsUp, MessageSquare,
  ShieldAlert, Radio, Clock, Globe, Film, Zap, Tv, Play, FileText, Flame, ArrowUpDown, ChevronDown, CheckCircle
} from 'lucide-react';
import { getExportCsvUrl } from '../api';

interface LinksExplorerProps {
  posts: Post[];
  lang: Language;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  platformFilter: string;
  setPlatformFilter: (p: string) => void;
  sourceCategory?: string;
  setSourceCategory?: (c: string) => void;
  timeWindow?: string;
  setTimeWindow?: (w: string) => void;
  mediaTypeFilter?: string;
  setMediaTypeFilter?: (m: string) => void;
  authorLabelFilter?: string;
  setAuthorLabelFilter?: (a: string) => void;
  sortBy?: string;
  setSortBy?: (s: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelectPost: (post: Post) => void;
}

function formatRelativeTime(dateStr: string | null): { text: string; isFresh4h: boolean; isSuperFresh: boolean } {
  if (!dateStr) return { text: 'Live', isFresh4h: true, isSuperFresh: true };
  const d = new Date(dateStr);
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 60) {
    return { text: `${diffMin}m ago (ताजा)`, isFresh4h: true, isSuperFresh: true };
  }
  if (diffHr < 4) {
    return { text: `${diffHr}h ${diffMin % 60}m ago`, isFresh4h: true, isSuperFresh: false };
  }
  if (diffHr < 24) {
    return { text: `${diffHr}h ago`, isFresh4h: false, isSuperFresh: false };
  }
  return { text: `${diffDay}d ago`, isFresh4h: false, isSuperFresh: false };
}

export const LinksExplorer: React.FC<LinksExplorerProps> = ({
  posts,
  lang,
  activeTab,
  setActiveTab,
  platformFilter,
  setPlatformFilter,
  sourceCategory = 'all',
  setSourceCategory,
  timeWindow = '4h',
  setTimeWindow,
  mediaTypeFilter = '',
  setMediaTypeFilter,
  authorLabelFilter = '',
  setAuthorLabelFilter,
  sortBy = 'newest',
  setSortBy,
  searchQuery,
  setSearchQuery,
  onSelectPost
}) => {
  const t = translations[lang];
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopy = (id: number, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const urls = posts.map(p => p.permalink_url).join('\n');
    navigator.clipboard.writeText(urls);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'youtube': return <Youtube className="w-4 h-4 text-red-600" />;
      case 'twitter': return <Twitter className="w-4 h-4 text-sky-500" />;
      case 'facebook': return <Facebook className="w-4 h-4 text-blue-600" />;
      case 'instagram': return <Instagram className="w-4 h-4 text-pink-500" />;
      case 'reddit': return <MessageSquare className="w-4 h-4 text-orange-500" />;
      case 'mastodon': return <Radio className="w-4 h-4 text-purple-500" />;
      case 'telegram': return <Radio className="w-4 h-4 text-sky-400" />;
      case 'wikipedia': return <Globe className="w-4 h-4 text-slate-500" />;
      default: return <Rss className="w-4 h-4 text-amber-500" />;
    }
  };

  const getFormatBadge = (mediaType: string) => {
    switch (mediaType) {
      case 'reel':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-950/70 dark:to-pink-950/70 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-800">
            <Film className="w-3 h-3 text-pink-600" /> Reel (रील)
          </span>
        );
      case 'short':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
            <Zap className="w-3 h-3 text-red-600" /> Short (शॉर्ट)
          </span>
        );
      case 'news_bulletin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Tv className="w-3 h-3 text-amber-600" /> Bulletin (बुलेटिन)
          </span>
        );
      case 'video':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
            <Play className="w-3 h-3 text-sky-600" /> Video (वीडियो)
          </span>
        );
      case 'article':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <FileText className="w-3 h-3 text-slate-600" /> Article (खबर)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            Post
          </span>
        );
    }
  };

  const getStanceBadge = (authorLabel: string) => {
    switch (authorLabel) {
      case 'opposition':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            🔴 {lang === 'hi' ? 'विपक्ष / आलोचक' : 'Opposition'}
          </span>
        );
      case 'official':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
            🔵 {lang === 'hi' ? 'आधिकारिक (Official)' : 'Official'}
          </span>
        );
      case 'supporter':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            🟢 {lang === 'hi' ? 'पक्ष / समर्थक' : 'Supporter'}
          </span>
        );
      case 'news-media':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            📺 {lang === 'hi' ? 'न्यूज़ चैनल' : 'News Media'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            ⚪ {lang === 'hi' ? 'तटस्थ' : 'Neutral'}
          </span>
        );
    }
  };

  const getSentimentBadge = (verdict: string, score: number) => {
    if (verdict === 'Positive') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs">
          🟢 +{Math.abs(score)} {lang === 'hi' ? 'सकारात्मक' : 'Positive'}
        </span>
      );
    }
    if (verdict === 'Negative') {
      const isSevere = score <= -70.0;
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border shadow-xs ${
          isSevere
            ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
            : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
        }`}>
          🔴 {score} {lang === 'hi' ? 'आलोचनात्मक' : 'Critical'}
        </span>
      );
    }
    if (verdict === 'Mixed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          🟡 Mixed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
        ⚪ Neutral
      </span>
    );
  };

  const isHighNegativeActive = activeTab === 'negative' && sortBy === 'most_negative';

  const toggleHighNegativeFocus = () => {
    if (isHighNegativeActive) {
      setActiveTab('all');
      if (setSortBy) setSortBy('newest');
    } else {
      setActiveTab('negative');
      if (setSortBy) setSortBy('most_negative');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      
      {/* 1. SEPARATE SOURCE CATEGORIES BAR: News Channels | YouTube | Facebook | Instagram */}
      <div className="p-3 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 mr-2 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-rose-400" />
            {lang === 'hi' ? 'स्रोत अलग-अलग देखें:' : 'Source Category:'}
          </span>
          {[
            { id: 'all', label: lang === 'hi' ? '🌟 सभी फ़ीड (All 360°)' : '🌟 All Sources' },
            { id: 'news_channel', label: lang === 'hi' ? '📺 न्यूज़ चैनल (News Media)' : '📺 News Channels' },
            { id: 'youtube', label: '📹 YouTube (यूट्यूब)' },
            { id: 'facebook', label: '📘 Facebook (फेसबुक पेज)' },
            { id: 'instagram', label: '📸 Instagram (इंस्टाग्राम)' },
            { id: 'twitter', label: '🐦 X / Twitter' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                if (setSourceCategory) setSourceCategory(cat.id);
                setPlatformFilter('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                sourceCategory === cat.id
                  ? 'bg-white text-slate-900 shadow-md ring-2 ring-rose-400 font-extrabold'
                  : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* TIME FRESHNESS WINDOW SELECTOR (Within 4 Hours Default) */}
        <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-700 text-xs">
          <span className="text-slate-400 px-2 font-bold text-[11px] flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            {lang === 'hi' ? 'ताजा समय सीमा:' : 'Freshness:'}
          </span>
          {[
            { id: '4h', label: lang === 'hi' ? '⚡ 4 घंटे (ताजा)' : '⚡ 4 Hours (Fresh)' },
            { id: '12h', label: '12h' },
            { id: '24h', label: '24h' },
            { id: 'all', label: lang === 'hi' ? 'सभी' : 'All' }
          ].map(tw => (
            <button
              key={tw.id}
              onClick={() => setTimeWindow && setTimeWindow(tw.id)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                timeWindow === tw.id
                  ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tw.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. FRESHNESS BANNER NOTIFICATION */}
      {timeWindow === '4h' && (
        <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>
              {lang === 'hi'
                ? '⚡ केवल पिछले 4 घंटे की ताज़ा खबरें दिखाई जा रही हैं (4 घंटे से पुरानी खबरें फ़िल्टर कर हटा दी गई हैं)।'
                : '⚡ Live Freshness: Showing only coverage within the last 4 hours (older news excluded).'}
            </span>
          </div>
          <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded">
            {posts.length} {lang === 'hi' ? 'ताजा पोस्ट' : 'Fresh Posts'}
          </span>
        </div>
      )}

      {/* 3. Sentiment Tabs + Actions */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        {/* Navigation Tabs + High Negative Focus Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct Negative Priority Trigger */}
          <button
            onClick={toggleHighNegativeFocus}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
              isHighNegativeActive
                ? 'bg-rose-600 text-white ring-2 ring-rose-400 ring-offset-1 dark:ring-offset-slate-900'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900'
            }`}
            title="Focus exclusively on negative criticism, attack reels & bulletins"
          >
            <Flame className={`w-3.5 h-3.5 ${isHighNegativeActive ? 'animate-bounce text-white' : 'text-rose-600'}`} />
            <span>{t.focusNegative}</span>
          </button>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-1" />

          {[
            { id: 'all', label: t.linksTabs.all },
            { id: 'negative', label: `🔴 ${t.linksTabs.negative}` },
            { id: 'positive', label: `🟢 ${t.linksTabs.positive}` },
            { id: 'neutral', label: t.linksTabs.neutral },
            { id: 'mixed', label: t.linksTabs.mixed },
            { id: 'needs_review', label: t.linksTabs.needsReview },
            { id: 'alerted', label: `🚨 ${t.linksTabs.alerted}` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-sky-600 text-white shadow-sm font-semibold'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bulk Export & Copy Links */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium transition-colors cursor-pointer"
            title="Copy all URLs in current view"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? (lang === 'hi' ? 'सभी कॉपी हो गए!' : 'Copied All!') : (lang === 'hi' ? 'सभी लिंक कॉपी करें' : 'Copy All Links')}</span>
          </button>

          <a
            href={getExportCsvUrl(activeTab, platformFilter, searchQuery, mediaTypeFilter, sourceCategory !== 'all' ? sourceCategory : undefined, timeWindow !== 'all' ? timeWindow : undefined)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.actions.exportCsv}</span>
          </a>
        </div>
      </div>

      {/* 4. Format & Stance Filter */}
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-600 dark:text-slate-300 font-bold mr-1 flex items-center gap-1">
            <Film className="w-3.5 h-3.5 text-indigo-500" />
            {lang === 'hi' ? 'प्रारूप (Format):' : 'Content Format:'}
          </span>
          {[
            { id: '', label: t.formats.all },
            { id: 'reel', label: t.formats.reel },
            { id: 'short', label: t.formats.short },
            { id: 'news_bulletin', label: t.formats.news_bulletin },
            { id: 'video', label: t.formats.video },
            { id: 'article', label: t.formats.article },
            { id: 'tweet', label: t.formats.tweet }
          ].map(fmt => (
            <button
              key={fmt.id}
              onClick={() => setMediaTypeFilter && setMediaTypeFilter(fmt.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                mediaTypeFilter === fmt.id
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {fmt.label}
            </button>
          ))}
        </div>

        {/* Stance Filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-600 dark:text-slate-300 font-bold mr-1">
            {lang === 'hi' ? 'दृष्टिकोण (Stance):' : 'Stance:'}
          </span>
          {[
            { id: '', label: t.stances.all },
            { id: 'opposition', label: t.stances.opposition },
            { id: 'supporter', label: t.stances.supporter },
            { id: 'news-media', label: t.stances.newsMedia }
          ].map(st => (
            <button
              key={st.id}
              onClick={() => setAuthorLabelFilter && setAuthorLabelFilter(st.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                authorLabelFilter === st.id
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Search Bar & Sorting */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'hi' ? 'पोस्ट टेक्स्ट, चैनल, रील या कीवर्ड खोजें...' : 'Search post text, author, reel or topic...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {setSortBy && (
          <div className="flex items-center gap-1.5 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="newest">{lang === 'hi' ? '⏱ नवीनतम (Newest First)' : '⏱ Newest First'}</option>
              <option value="most_negative">{lang === 'hi' ? '🚨 सर्वाधिक गंभीर नकारात्मक (Attack Severity)' : '🚨 Most Critical / Attack Severity'}</option>
              <option value="highest_reach">{lang === 'hi' ? '👁 सर्वाधिक पहुंच / व्यूज (Highest Reach)' : '👁 Highest Reach / Views'}</option>
              <option value="engagement">{lang === 'hi' ? '📈 उच्च जुड़ाव (High Engagement)' : '📈 High Engagement'}</option>
              <option value="most_positive">{lang === 'hi' ? '🟢 सर्वाधिक समर्थक (Most Supportive)' : '🟢 Most Supportive'}</option>
            </select>
          </div>
        )}
      </div>

      {/* 6. Main Feed Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
              <th className="py-3 px-4">{lang === 'hi' ? 'प्रारूप एवं प्लेटफ़ॉर्म' : 'Format & Source'}</th>
              <th className="py-3 px-4">{t.table.author}</th>
              <th className="py-3 px-4">{t.table.content}</th>
              <th className="py-3 px-3">{lang === 'hi' ? 'समय (Freshness)' : 'Freshness'}</th>
              <th className="py-3 px-3">{t.table.topic}</th>
              <th className="py-3 px-3">{t.table.sentiment}</th>
              <th className="py-3 px-3 text-right">Reach / Views</th>
              <th className="py-3 px-4 text-center">{t.table.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertTriangle className="w-8 h-8 text-slate-400" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">
                      {lang === 'hi' ? 'चुने गए स्रोत और 4 घंटे की समय सीमा में कोई नई पोस्ट नहीं मिली।' : 'No posts found in this 4-hour window matching selected filters.'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {lang === 'hi' ? 'समय सीमा बदलकर 12h या "सभी" पर क्लिक करें।' : 'Try switching time window to 12h or All.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              posts.map((post) => {
                const relTime = formatRelativeTime(post.posted_at);

                return (
                  <tr
                    key={post.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                      post.sentiment_verdict === 'Negative' ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                    }`}
                  >
                    {/* Format & Platform */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div>{getFormatBadge(post.media_type)}</div>
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-[11px]">
                          {getPlatformIcon(post.platform)}
                          <span className="capitalize font-semibold">{post.platform}</span>
                        </div>
                      </div>
                    </td>

                    {/* Author / Channel & Stance */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-slate-100 max-w-[170px] truncate" title={post.author_name}>
                        {post.author_name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[170px]">
                        @{post.author_handle}
                      </div>
                      <div className="mt-1">
                        {getStanceBadge(post.author_label)}
                      </div>
                    </td>

                    {/* Content snippet */}
                    <td className="py-3 px-4 max-w-sm">
                      <p
                        className="line-clamp-2 text-slate-800 dark:text-slate-200 cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 font-medium leading-relaxed"
                        onClick={() => onSelectPost(post)}
                        title="Click to view full drill-down"
                      >
                        {post.text}
                      </p>
                      {post.alert_flag && (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white shadow-xs">
                          <ShieldAlert className="w-3 h-3" /> Critical Alert Sent
                        </span>
                      )}
                    </td>

                    {/* Freshness / Time Tag */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className={`font-semibold text-xs ${
                          relTime.isSuperFresh
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : relTime.isFresh4h
                            ? 'text-sky-600 dark:text-sky-400'
                            : 'text-slate-500'
                        }`}>
                          {relTime.text}
                        </span>
                      </div>
                    </td>

                    {/* Topic */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 capitalize">
                        {post.top_topic}
                      </span>
                    </td>

                    {/* Sentiment & Score */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getSentimentBadge(post.sentiment_verdict, post.sentiment_score)}
                    </td>

                    {/* Reach / Views */}
                    <td className="py-3 px-3 text-right whitespace-nowrap text-slate-800 dark:text-slate-200 font-semibold">
                      {post.views > 0 ? post.views.toLocaleString() : 'N/A'}
                    </td>

                    {/* Actions: Direct Link, Copy, Details */}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <a
                          href={post.permalink_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 transition-colors cursor-pointer"
                          title={t.actions.openOriginal}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          onClick={() => handleCopy(post.id, post.permalink_url)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                          title={t.actions.copyLink}
                        >
                          {copiedId === post.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => onSelectPost(post)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-[11px] font-medium hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          {t.actions.viewDetails}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
