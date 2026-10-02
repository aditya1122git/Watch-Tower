import React, { useState, useEffect } from 'react';
import { Post, Alert, OverviewStats } from './types';
import { Language, translations } from './i18n';
import {
  fetchOverviewStats, fetchLinks, fetchAlerts, takeAlertAction, triggerSeed,
  getStoredUser, fetchCurrentUser, logoutUser, sendHeartbeat, fetchSessionsStatus
} from './api';
import { Header } from './components/Header';
import { LoginBoard } from './components/LoginBoard';
import { ActiveSessionsModal } from './components/ActiveSessionsModal';
import { SentimentGauge } from './components/SentimentGauge';
import { MetricCard } from './components/MetricCard';
import { LinksExplorer } from './components/LinksExplorer';
import { AlertsCenter } from './components/AlertsCenter';
import { ChannelsView } from './components/ChannelsView';
import { TopicsView } from './components/TopicsView';
import { PostDetailModal } from './components/PostDetailModal';
import { DataImportModal } from './components/DataImportModal';
import { FreeCollectorsModal } from './components/FreeCollectorsModal';
import { TimelineView } from './components/TimelineView';
import { TelegramAlertModal } from './components/TelegramAlertModal';
import { NewsChannelsReport } from './components/NewsChannelsReport';
import { SocialMediaReport } from './components/SocialMediaReport';
import { UserManagementModal } from './components/UserManagementModal';
import { DataRefreshStatus } from './components/DataRefreshStatus';
import {
  MessageSquare, Users, ShieldAlert, BarChart3, TrendingDown,
  TrendingUp, Link2, Bell, Layers, UploadCloud, Radio, Zap, Clock, Send,
  Tv, Sparkles
} from 'lucide-react';

export const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('en');
  const [darkMode, setDarkMode] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<'news_channels' | 'social_media' | 'links' | 'alerts' | 'overview' | 'timeline' | 'channels' | 'topics'>('news_channels');

  // Links explorer state
  const [linksTab, setLinksTab] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('');
  const [sourceCategory, setSourceCategory] = useState<string>('all');
  const [timeWindow, setTimeWindow] = useState<string>('4h');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('');
  const [authorLabelFilter, setAuthorLabelFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Auth & 5-Concurrent Sessions State
  const [currentUser, setCurrentUser] = useState<any | null>(getStoredUser());
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [activeSessionsCount, setActiveSessionsCount] = useState<number>(1);

  // Data states
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCollectorsOpen, setIsCollectorsOpen] = useState(false);
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const t = translations[lang];

  // Verify session on mount & periodic keep-alive heartbeat
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const user = await fetchCurrentUser();
        if (user) {
          setCurrentUser(user);
        } else if (currentUser) {
          setCurrentUser(null);
        }
        const sessions = await fetchSessionsStatus();
        if (sessions) {
          setActiveSessionsCount(sessions.active_sessions_count);
        }
      } catch (e) {
        console.error('Auth verification error:', e);
      }
    };
    verifyAuth();

    // Heartbeat every 45s to maintain active slot & refresh slot count
    const interval = setInterval(async () => {
      await sendHeartbeat();
      try {
        const sessions = await fetchSessionsStatus();
        if (sessions) {
          setActiveSessionsCount(sessions.active_sessions_count);
        }
      } catch (e) {
        // silent
      }
    }, 45000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    try {
      const sessions = await fetchSessionsStatus();
      if (sessions) setActiveSessionsCount(sessions.active_sessions_count);
    } catch (e) {
      // silent
    }
  };

  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const loadData = async () => {
    try {
      const [s, l, a] = await Promise.all([
        fetchOverviewStats(),
        fetchLinks({
          tab: linksTab,
          platform: platformFilter || undefined,
          source_category: sourceCategory !== 'all' ? sourceCategory : undefined,
          time_window: timeWindow !== 'all' ? timeWindow : undefined,
          media_type: mediaTypeFilter || undefined,
          author_label: authorLabelFilter || undefined,
          sort_by: sortBy,
          search: searchQuery || undefined
        }),
        fetchAlerts()
      ]);
      setStats(s);
      setPosts(l);
      setAlerts(a);
    } catch (err) {
      console.error('Failed to load watchtower data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [linksTab, platformFilter, sourceCategory, timeWindow, mediaTypeFilter, authorLabelFilter, sortBy, searchQuery]);

  // Connect to SSE for real-time alerts
  useEffect(() => {
    const sseUrl = 'http://localhost:8000/api/v1/sse/alerts';
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(sseUrl);
      eventSource.onopen = () => setIsLive(true);
      eventSource.addEventListener('alert', (event: any) => {
        try {
          const alertPayload = JSON.parse(event.data);
          setToastMessage(`🚨 ALERT: ${alertPayload.title}`);
          loadData();
          setTimeout(() => setToastMessage(null), 6000);
        } catch (e) {
          console.error(e);
        }
      });
      eventSource.addEventListener('new_posts', (event: any) => {
        try {
          const payload = JSON.parse(event.data);
          setToastMessage(`⚡ ${payload.count} new public posts/news auto-ingested (${payload.platform})!`);
          loadData();
          setTimeout(() => setToastMessage(null), 5000);
        } catch (e) {
          console.error(e);
        }
      });
      eventSource.onerror = () => {
        setIsLive(false);
      };
    } catch (e) {
      setIsLive(false);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleAcknowledgeAlert = async (id: number) => {
    await takeAlertAction(id, 'acknowledge');
    loadData();
  };

  const handleResolveAlert = async (id: number) => {
    await takeAlertAction(id, 'resolve');
    loadData();
  };

  const handleRefreshSeed = async () => {
    await triggerSeed();
    await loadData();
    setToastMessage('✅ Demo dataset reloaded with fresh 501+ negative comments alert.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (!currentUser) {
    return (
      <LoginBoard
        lang={lang}
        onLoginSuccess={(userData) => {
          setCurrentUser(userData);
          setActiveSessionsCount(userData.active_sessions_count || 1);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Real-time Alert Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-2xl flex items-center gap-3 animate-slide-up border border-slate-700">
          <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
          <p className="text-xs font-semibold">{toastMessage}</p>
        </div>
      )}

      {/* Header */}
      <Header
        lang={lang}
        setLang={setLang}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        isLive={isLive}
        activeAlertCount={alerts.filter(a => a.status === 'active').length}
        currentUser={currentUser}
        activeSessionsCount={activeSessionsCount}
        onOpenSessionsModal={() => setIsSessionsModalOpen(true)}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
        onLogout={handleLogout}
        onRefreshSeed={handleRefreshSeed}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenCollectors={() => setIsCollectorsOpen(true)}
        onOpenTelegram={() => setIsTelegramOpen(true)}
      />

      {/* Navigation Sub-header */}
      {/* Navigation Sub-header */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between overflow-x-auto gap-3">
          <div className="flex space-x-1 py-2">
            {[
              { id: 'news_channels', label: lang === 'hi' ? '📺 न्यूज़ चैनल रिपोर्ट (लाइन-वाइज)' : '📺 News Channels (Line-Wise)', icon: <Tv className="w-4 h-4 text-rose-500" /> },
              { id: 'social_media', label: lang === 'hi' ? '📱 सोशल मीडिया रिपोर्ट (YT • FB • Insta • X)' : '📱 Social Media (YT • FB • Insta • X)', icon: <Sparkles className="w-4 h-4 text-indigo-500" /> },
              { id: 'links', label: lang === 'hi' ? '🌐 समस्त 360° फ़ीड' : '🌐 All Feeds Explorer', icon: <Link2 className="w-4 h-4 text-sky-500" /> },
              { id: 'alerts', label: t.tabs.alerts, icon: <Bell className="w-4 h-4 text-rose-500" /> },
              { id: 'overview', label: t.tabs.overview, icon: <BarChart3 className="w-4 h-4 text-amber-500" /> },
              { id: 'timeline', label: t.tabs.timeline, icon: <Clock className="w-4 h-4 text-emerald-500" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveMainTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeMainTab === tab.id
                    ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.id === 'alerts' && alerts.filter(a => a.status === 'active').length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {alerts.filter(a => a.status === 'active').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0 my-2">
            {/* Telegram Alerts Button */}
            <button
              onClick={() => setIsTelegramOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-sky-500" />
              <span>@Rajnish517 Alert</span>
            </button>

            {/* Live Feeds Quick Button */}
            <button
              onClick={() => setIsCollectorsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{lang === 'hi' ? 'लाइव फ़ीड एपीआई (9 Sources)' : 'Live Feed APIs (9 Sources)'}</span>
            </button>

            <button
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{t.actions.uploadFile}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* GLOBAL CATEGORY & 4-HOUR FRESHNESS QUICK BAR (Separate News Channel, FB, Insta, YT) */}
      <div className="bg-slate-900 border-b border-slate-800 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs: Separate News Channel, Facebook, Instagram, YouTube */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-rose-400" />
              {lang === 'hi' ? 'सीधा सेक्शन स्विच:' : 'Direct Section:'}
            </span>
            {[
              { id: 'news_channel', label: lang === 'hi' ? '📺 न्यूज़ चैनल (लाइन-वाइज)' : '📺 News Channels (Line-Wise)' },
              { id: 'youtube', label: '📹 YouTube' },
              { id: 'facebook', label: '📘 Facebook' },
              { id: 'instagram', label: '📸 Instagram' },
              { id: 'twitter', label: '🐦 X / Twitter' },
              { id: 'all', label: lang === 'hi' ? '🌟 सभी फ़ीड (All 360°)' : '🌟 All Sources' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSourceCategory(cat.id);
                  setPlatformFilter('');
                  if (cat.id === 'news_channel') {
                    setActiveMainTab('news_channels');
                  } else if (['youtube', 'facebook', 'instagram', 'twitter'].includes(cat.id)) {
                    setActiveMainTab('social_media');
                  } else if (cat.id === 'all') {
                    setActiveMainTab('links');
                  }
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  (activeMainTab === 'news_channels' && cat.id === 'news_channel') ||
                  (activeMainTab === 'social_media' && ['youtube', 'facebook', 'instagram', 'twitter'].includes(cat.id)) ||
                  (activeMainTab === 'links' && cat.id === 'all')
                    ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400 font-extrabold'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700/60'
                }`}
              >
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* 4-Hour Freshness Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-700 text-xs">
            <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px]">
              <Clock className="w-3.5 h-3.5" />
              {lang === 'hi' ? 'समय विंडो:' : 'Time Window:'}
            </span>
            {[
              { id: '4h', label: lang === 'hi' ? '⚡ 4 घंटे (ताजा)' : '⚡ 4 Hours (Fresh)' },
              { id: '12h', label: '12h' },
              { id: '24h', label: '24h' },
              { id: 'all', label: lang === 'hi' ? 'सभी' : 'All' }
            ].map(tw => (
              <button
                key={tw.id}
                onClick={() => setTimeWindow(tw.id)}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeWindow === tw.id
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tw.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        
        {/* COMPACT DATA REFRESH STATUS SECTION (80m FB/Insta, 10m Other, Telegram Dedup) */}
        <DataRefreshStatus lang={lang} onRefreshCompleted={loadData} />

        {/* VIEW 0A: 10 BIHAR NEWS CHANNELS LINE-WISE REPORT */}
        {activeMainTab === 'news_channels' && (
          <NewsChannelsReport lang={lang} />
        )}

        {/* VIEW 0B: UNIFIED SOCIAL MEDIA REPORT (YOUTUBE, FB, INSTA, X) */}
        {activeMainTab === 'social_media' && (
          <SocialMediaReport lang={lang} />
        )}

        {/* VIEW 1: OVERVIEW DASHBOARD */}
        {activeMainTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Top Row: Gauge + Key Metric Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Sentiment Gauge */}
              <SentimentGauge
                score={stats?.overall_sentiment_score ?? 0}
                lang={lang}
              />

              {/* 4 Metrics in 2x2 grid */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MetricCard
                  title={t.metrics.totalPosts}
                  value={stats?.total_posts ?? 0}
                  subtext="Monitored across YouTube, X, FB & RSS"
                  icon={<MessageSquare className="w-5 h-5" />}
                />
                <MetricCard
                  title={t.metrics.totalComments}
                  value={stats?.total_comments?.toLocaleString() ?? 0}
                  subtext="Hashed IDs | DPDP Act 2023 Compliant"
                  icon={<Users className="w-5 h-5" />}
                />
                <MetricCard
                  title={t.metrics.activeAlerts}
                  value={stats?.active_alerts ?? 0}
                  subtext="Critical 500+ negative comment breaches"
                  icon={<ShieldAlert className="w-5 h-5" />}
                  variant={stats?.active_alerts ? 'rose' : 'emerald'}
                />
                <MetricCard
                  title={t.metrics.negativeRatio}
                  value={
                    stats && stats.total_comments > 0
                      ? `${((stats.total_negative_comments / stats.total_comments) * 100).toFixed(1)}%`
                      : '0.0%'
                  }
                  subtext={`${stats?.total_negative_comments.toLocaleString() ?? 0} critical comments`}
                  icon={<TrendingDown className="w-5 h-5" />}
                  variant="amber"
                />
              </div>

            </div>

            {/* Middle Row: Most Critical vs Most Supportive Leaderboards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Top 5 Most Negative Posts */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4" /> Top Negative Posts (High Crisis Risk)
                  </h3>
                  <span className="text-[11px] text-slate-400">By Negative Volume</span>
                </div>
                <div className="space-y-3">
                  {stats?.top_negative_posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="p-3 rounded-xl bg-rose-50/30 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 hover:border-rose-300 cursor-pointer transition-colors text-xs"
                    >
                      <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
                        <span className="font-semibold uppercase">{post.platform} • {post.author_name}</span>
                        <span className="font-bold text-rose-600">{post.negative_comment_count} Neg ({post.negative_comment_pct.toFixed(1)}%)</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 line-clamp-2 font-medium">
                        {post.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 5 Most Positive Posts */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Top Supportive Posts (Pro-CM Sentiment)
                  </h3>
                  <span className="text-[11px] text-slate-400">By Positive Volume</span>
                </div>
                <div className="space-y-3">
                  {stats?.top_positive_posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="p-3 rounded-xl bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 hover:border-emerald-300 cursor-pointer transition-colors text-xs"
                    >
                      <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
                        <span className="font-semibold uppercase">{post.platform} • {post.author_name}</span>
                        <span className="font-bold text-emerald-600">+{post.sentiment_score} Score</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 line-clamp-2 font-medium">
                        {post.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Quick Links Explorer Preview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t.tabs.links}
                </h3>
                <button
                  onClick={() => setActiveMainTab('links')}
                  className="text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline"
                >
                  View All Links &rarr;
                </button>
              </div>
              <LinksExplorer
                posts={posts.slice(0, 10)}
                lang={lang}
                activeTab={linksTab}
                setActiveTab={setLinksTab}
                platformFilter={platformFilter}
                setPlatformFilter={setPlatformFilter}
                mediaTypeFilter={mediaTypeFilter}
                setMediaTypeFilter={setMediaTypeFilter}
                authorLabelFilter={authorLabelFilter}
                setAuthorLabelFilter={setAuthorLabelFilter}
                sortBy={sortBy}
                setSortBy={setSortBy}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSelectPost={(p) => setSelectedPost(p)}
              />
            </div>

          </div>
        )}

        {/* VIEW: TIMELINE & HOURLY-MINUTE LIVE FEED */}
        {activeMainTab === 'timeline' && (
          <TimelineView
            lang={lang}
            onPostSelect={(p) => setSelectedPost(p)}
          />
        )}

        {/* VIEW 2: FULL LINKS EXPLORER */}
        {activeMainTab === 'links' && (
          <LinksExplorer
            posts={posts}
            lang={lang}
            activeTab={linksTab}
            setActiveTab={setLinksTab}
            platformFilter={platformFilter}
            setPlatformFilter={setPlatformFilter}
            sourceCategory={sourceCategory}
            setSourceCategory={setSourceCategory}
            timeWindow={timeWindow}
            setTimeWindow={setTimeWindow}
            mediaTypeFilter={mediaTypeFilter}
            setMediaTypeFilter={setMediaTypeFilter}
            authorLabelFilter={authorLabelFilter}
            setAuthorLabelFilter={setAuthorLabelFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSelectPost={(p) => setSelectedPost(p)}
          />
        )}

        {/* VIEW 3: ALERTS CENTER */}
        {activeMainTab === 'alerts' && (
          <AlertsCenter
            alerts={alerts}
            lang={lang}
            onAcknowledge={handleAcknowledgeAlert}
            onResolve={handleResolveAlert}
            onOpenTelegram={() => setIsTelegramOpen(true)}
          />
        )}

        {/* VIEW 4: CHANNELS & STANCE */}
        {activeMainTab === 'channels' && (
          <ChannelsView
            posts={posts}
            lang={lang}
          />
        )}

        {/* VIEW 5: TOPICS HEATMAP */}
        {activeMainTab === 'topics' && (
          <TopicsView
            posts={posts}
            lang={lang}
          />
        )}

      </main>

      {/* Drill-down Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          lang={lang}
          onClose={() => setSelectedPost(null)}
        />
      )}

      {/* Data Import Modal */}
      {isImportOpen && (
        <DataImportModal
          lang={lang}
          onClose={() => setIsImportOpen(false)}
          onSuccess={() => {
            setIsImportOpen(false);
            loadData();
          }}
        />
      )}

      {/* Free Collectors & Public APIs Modal */}
      {isCollectorsOpen && (
        <FreeCollectorsModal
          lang={lang}
          onClose={() => setIsCollectorsOpen(false)}
          onDataUpdated={() => {
            loadData();
            setToastMessage('✅ Live feeds updated from 9 free public APIs.');
            setTimeout(() => setToastMessage(null), 4000);
          }}
        />
      )}

      {/* Telegram Alert Dispatcher Modal */}
      {isTelegramOpen && (
        <TelegramAlertModal
          lang={lang}
          onClose={() => setIsTelegramOpen(false)}
        />
      )}

      {/* Active 5-Concurrent Sessions Modal */}
      {isSessionsModalOpen && (
        <ActiveSessionsModal
          lang={lang}
          onClose={() => setIsSessionsModalOpen(false)}
          onSessionTerminated={async () => {
            const s = await fetchSessionsStatus();
            if (s) setActiveSessionsCount(s.active_sessions_count);
          }}
        />
      )}

      {/* User & Password & Mobile Management Modal */}
      {isUserManagementOpen && (
        <UserManagementModal
          isOpen={isUserManagementOpen}
          onClose={() => setIsUserManagementOpen(false)}
          currentUser={currentUser}
          lang={lang}
          onUserUpdated={async () => {
            try {
              const user = await fetchCurrentUser();
              if (user) setCurrentUser(user);
            } catch (e) {
              // silent
            }
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 bg-white dark:bg-slate-900 text-center text-xs text-slate-400">
        <p>Bihar CM Social Media Watchtower • Complies with DPDP Act 2023 Principles • Public Data Only</p>
      </footer>
    </div>
  );
};
