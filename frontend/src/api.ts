import { Post, Comment, Alert, OverviewStats, PlatformRefreshStatus } from './types';
const getApiBase = (): string => {
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const protocol = window.location.protocol || 'http:';
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${protocol}//${host}:8000/api/v1`;
    }
  }
  let customUrl = import.meta.env.VITE_API_URL;
  if (customUrl) {
    customUrl = customUrl.trim().replace(/\/+$/, '');
    if (!customUrl.endsWith('/api/v1')) {
      customUrl = `${customUrl}/api/v1`;
    }
    return customUrl;
  }
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname || 'localhost';
    const protocol = window.location.protocol || 'http:';
    if (window.location.port === '3000') {
      return `${protocol}//${host}:8000/api/v1`;
    }
    return `${protocol}//${host}${window.location.port ? ':' + window.location.port : ''}/api/v1`;
  }
  return 'http://localhost:8000/api/v1';
};

const API_BASE = getApiBase();

export async function fetchOverviewStats(): Promise<OverviewStats> {
  const resp = await fetch(`${API_BASE}/stats/overview`);
  if (!resp.ok) throw new Error('Failed to fetch overview stats');
  return resp.json();
}

export async function fetchLinks(params: {
  tab?: string;
  platform?: string;
  source_category?: string;
  time_window?: string;
  hours?: number;
  media_type?: string;
  author_label?: string;
  sort_by?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Post[]> {
  const query = new URLSearchParams();
  if (params.tab) query.append('tab', params.tab);
  if (params.platform) query.append('platform', params.platform);
  if (params.source_category) query.append('source_category', params.source_category);
  if (params.time_window) query.append('time_window', params.time_window);
  if (params.hours) query.append('hours', params.hours.toString());
  if (params.media_type) query.append('media_type', params.media_type);
  if (params.author_label) query.append('author_label', params.author_label);
  if (params.sort_by) query.append('sort_by', params.sort_by);
  if (params.search) query.append('search', params.search);
  if (params.limit) query.append('limit', params.limit.toString());
  if (params.offset) query.append('offset', params.offset.toString());

  const resp = await fetch(`${API_BASE}/links?${query.toString()}`);
  if (!resp.ok) throw new Error('Failed to fetch links');
  return resp.json();
}

export function getExportCsvUrl(
  tab: string = 'all',
  platform?: string,
  search?: string,
  media_type?: string,
  source_category?: string,
  time_window?: string
): string {
  const query = new URLSearchParams({ tab });
  if (platform) query.append('platform', platform);
  if (source_category) query.append('source_category', source_category);
  if (time_window) query.append('time_window', time_window);
  if (media_type) query.append('media_type', media_type);
  if (search) query.append('search', search);
  return `${API_BASE}/links/export?${query.toString()}`;
}

export function getDownloadPdfUrl(): string {
  return `${API_BASE}/reports/pdf`;
}

export async function fetchPostDetail(postId: number): Promise<{
  post: Post;
  top_negative_comments: Comment[];
  top_positive_comments: Comment[];
  snapshots: any[];
}> {
  const resp = await fetch(`${API_BASE}/posts/${postId}`);
  if (!resp.ok) throw new Error('Failed to fetch post details');
  return resp.json();
}

export async function fetchAlerts(status?: string): Promise<Alert[]> {
  const query = status ? `?status=${status}` : '';
  const resp = await fetch(`${API_BASE}/alerts${query}`);
  if (!resp.ok) throw new Error('Failed to fetch alerts');
  return resp.json();
}

export async function takeAlertAction(alertId: number, action: 'acknowledge' | 'resolve'): Promise<Alert> {
  const resp = await fetch(`${API_BASE}/alerts/${alertId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, user: 'analyst' })
  });
  if (!resp.ok) throw new Error('Failed to update alert');
  return resp.json();
}

export async function triggerSeed(): Promise<void> {
  const resp = await fetch(`${API_BASE}/seed`, { method: 'POST' });
  if (!resp.ok) throw new Error('Failed to trigger database seeding');
}

export async function uploadDataFile(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await fetch(`${API_BASE}/import/file`, {
    method: 'POST',
    body: formData
  });
  if (!resp.ok) throw new Error('Failed to upload file');
  return resp.json();
}

export interface NewsChannelSummary {
  total_news_outlets: number;
  total_news_stories: number;
  total_news_reach: number;
  total_news_comments: number;
  total_negative_comments: number;
  negative_comment_pct: number;
  avg_media_stance_score: number;
  overall_media_sentiment: string;
  most_critical_outlet: string | null;
  most_supportive_outlet: string | null;
}

export interface NewsChannelItem {
  name: string;
  handle: string;
  platform: string;
  label: string;
  total_stories: number;
  total_reach: number;
  total_comments: number;
  negative_comments: number;
  positive_comments: number;
  neutral_comments: number;
  negative_comment_pct: number;
  stance_score: number;
  stance_label: string;
  stance_color: string;
  top_story: {
    title: string;
    views: number;
    sentiment: string;
    permalink: string;
  };
  most_critical_story: {
    title: string;
    negative_comments: number;
    permalink: string;
  };
  topics: string[];
}

export interface NewsChannelReport {
  summary: NewsChannelSummary;
  channels: NewsChannelItem[];
}

export async function fetchNewsChannelReport(): Promise<NewsChannelReport> {
  const resp = await fetch(`${API_BASE}/reports/news-channels`);
  if (!resp.ok) throw new Error('Failed to fetch news channels report');
  return resp.json();
}

export interface BiharMediaRecentPost {
  id: number;
  title: string;
  permalink_url: string;
  platform: string;
  sentiment_verdict: string;
  sentiment_score: number;
  views: number;
  posted_at: string | null;
}

export interface BiharMediaChannel {
  id: string;
  name: string;
  short_name: string;
  color: string;
  total_posts: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  sentiment_score: number;
  stance: string;
  stance_color: string;
  recent_posts: BiharMediaRecentPost[];
}

export interface BiharMediaReport {
  status: string;
  updated_at: string;
  summary: {
    total_channels: number;
    total_posts_tracked: number;
    total_negative_posts: number;
    total_positive_posts: number;
    total_neutral_posts: number;
    top_critical_channel: string;
    top_supportive_channel: string;
  };
  channels: BiharMediaChannel[];
  graph_data: {
    categories: string[];
    series: {
      positive: number[];
      negative: number[];
      neutral: number[];
      net_scores: number[];
    };
  };
  rankings: {
    most_critical: string[];
    most_supportive: string[];
  };
}

export async function fetchBiharMediaReport(params?: { time_window?: string; hours?: number }): Promise<BiharMediaReport> {
  const query = new URLSearchParams();
  if (params?.time_window) query.append('time_window', params.time_window);
  if (params?.hours) query.append('hours', params.hours.toString());
  const qs = query.toString() ? `?${query.toString()}` : '';
  const resp = await fetch(`${API_BASE}/reports/bihar-media${qs}`);
  if (!resp.ok) throw new Error('Failed to fetch Bihar media report');
  return resp.json();
}


export interface CollectorMetadata {
  platform: string;
  display_name: string;
  type: string;
  description: string;
  requires_api_key: boolean;
  status: string;
  rate_limit?: string;
  features: string[];
  has_api_key?: boolean;
}

export interface CollectorsResponse {
  free_public_collectors: CollectorMetadata[];
  key_based_collectors: CollectorMetadata[];
  active_llm_provider: string;
  has_gemini_key: boolean;
  target_person: string;
}

export interface RunFreeCollectorsResult {
  status: string;
  message: string;
  total_fetched: number;
  new_posts_saved: number;
  existing_posts_updated: number;
  alerts_created: number;
  platforms: Record<string, { fetched: number; new: number; error: number }>;
  executed_at: string;
}

export async function fetchCollectors(): Promise<CollectorsResponse> {
  const resp = await fetch(`${API_BASE}/collectors`);
  if (!resp.ok) throw new Error('Failed to fetch collectors');
  return resp.json();
}

export async function runFreeCollectors(params?: {
  keywords?: string[];
  max_per_platform?: number;
}): Promise<RunFreeCollectorsResult> {
  const resp = await fetch(`${API_BASE}/collectors/run-free`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {})
  });
  if (!resp.ok) throw new Error('Failed to execute free collectors');
  return resp.json();
}

export interface HourlyTrendItem {
  hour: string;
  hour_iso: string;
  post_count: number;
  reach: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  negative_pct: number;
  avg_sentiment_score: number;
  velocity: number;
  top_topics: string[];
}

export interface MinuteLogItem {
  id: number;
  timestamp: string;
  time_iso: string;
  platform: string;
  author: string;
  title: string;
  sentiment: string;
  score: number;
  topic: string;
  permalink: string;
}

export interface TimelineReport {
  summary: {
    total_posts_24h: number;
    total_reach_24h: number;
    total_negative_comments_24h: number;
    current_hour_posts: number;
    current_hour_negative_pct: number;
    current_hour_velocity: number;
    scheduler_active: boolean;
    refresh_interval_seconds: number;
    total_cycles_today: number;
    items_ingested_today: number;
    last_refreshed_at: string | null;
    next_refresh_at: string | null;
  };
  hourly_trend: HourlyTrendItem[];
  minute_logs: MinuteLogItem[];
  execution_history: any[];
}

export interface SchedulerStatus {
  is_running: boolean;
  interval_seconds: number;
  last_run: string | null;
  next_run: string | null;
  total_runs: number;
  total_new_items_today: number;
  recent_cycles: any[];
}

export async function fetchTimelineReport(): Promise<TimelineReport> {
  const resp = await fetch(`${API_BASE}/reports/timeline`);
  if (!resp.ok) throw new Error('Failed to fetch timeline report');
  return resp.json();
}

export async function fetchSchedulerStatus(): Promise<SchedulerStatus> {
  const resp = await fetch(`${API_BASE}/scheduler/status`);
  if (!resp.ok) throw new Error('Failed to fetch scheduler status');
  return resp.json();
}

export async function fetchPlatformRefreshStatuses(): Promise<PlatformRefreshStatus[]> {
  const resp = await fetch(`${API_BASE}/scheduler/platforms`);
  if (!resp.ok) throw new Error('Failed to fetch platform refresh statuses');
  return resp.json();
}

export async function triggerPlatformRefresh(platformKey: string): Promise<any> {
  const resp = await fetch(`${API_BASE}/scheduler/trigger/${platformKey}`, { method: 'POST' });
  if (!resp.ok) throw new Error(`Failed to trigger refresh for ${platformKey}`);
  return resp.json();
}

export async function triggerSchedulerRefresh(): Promise<any> {
  const resp = await fetch(`${API_BASE}/scheduler/trigger`, { method: 'POST' });
  if (!resp.ok) throw new Error('Failed to trigger immediate refresh');
  return resp.json();
}

export async function toggleScheduler(enabled: boolean): Promise<any> {
  const resp = await fetch(`${API_BASE}/scheduler/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  });
  if (!resp.ok) throw new Error('Failed to toggle scheduler');
  return resp.json();
}

export async function setSchedulerInterval(interval_seconds: number): Promise<any> {
  const resp = await fetch(`${API_BASE}/scheduler/interval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interval_seconds })
  });
  if (!resp.ok) throw new Error('Failed to set scheduler interval');
  return resp.json();
}

export interface TelegramConfig {
  target_chat_id: string;
  target_chat_ids: string[];
  recipient_count?: number;
  has_bot_token: boolean;
  recent_dispatched_count: number;
  recent_history: any[];
  format_template: string;
}

export async function fetchTelegramConfig(): Promise<TelegramConfig> {
  const resp = await fetch(`${API_BASE}/telegram/config`);
  if (!resp.ok) throw new Error('Failed to fetch telegram config');
  return resp.json();
}

export async function updateTelegramConfig(params: {
  bot_token?: string;
  target_chat_id?: string;
  target_chat_ids?: string[];
}): Promise<any> {
  const sessionId = getStoredSessionId();
  const resp = await fetch(`${API_BASE}/telegram/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId || ''
    },
    body: JSON.stringify(params)
  });
  if (!resp.ok) throw new Error('Failed to update telegram config');
  return resp.json();
}

export async function addTelegramRecipient(chat_id: string): Promise<any> {
  const sessionId = getStoredSessionId();
  const resp = await fetch(`${API_BASE}/telegram/add-recipient`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId || ''
    },
    body: JSON.stringify({ chat_id })
  });
  if (!resp.ok) throw new Error('Failed to add telegram recipient');
  return resp.json();
}

export async function removeTelegramRecipient(chat_id: string): Promise<any> {
  const sessionId = getStoredSessionId();
  const resp = await fetch(`${API_BASE}/telegram/remove-recipient`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId || ''
    },
    body: JSON.stringify({ chat_id })
  });
  if (!resp.ok) throw new Error('Failed to remove telegram recipient');
  return resp.json();
}

export async function sendTestTelegramAlert(params?: { bot_token?: string; target_chat_id?: string }): Promise<any> {
  const resp = await fetch(`${API_BASE}/telegram/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {})
  });
  if (!resp.ok) throw new Error('Failed to send test telegram alert');
  return resp.json();
}

// ----------------------------------------------------
// AUTHENTICATION & 5 CONCURRENT SESSIONS MANAGEMENT
// ----------------------------------------------------

export function getStoredSessionId(): string | null {
  return localStorage.getItem('watchtower_session_id');
}

export function setStoredSession(session: any): void {
  if (session?.session_id) {
    localStorage.setItem('watchtower_session_id', session.session_id);
    localStorage.setItem('watchtower_user', JSON.stringify(session));
  }
}

export function clearStoredSession(): void {
  localStorage.removeItem('watchtower_session_id');
  localStorage.removeItem('watchtower_user');
}

export function getStoredUser(): any | null {
  const data = localStorage.getItem('watchtower_user');
  return data ? JSON.parse(data) : null;
}

export async function loginUser(username: string, password: string): Promise<any> {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const body = await resp.json();
  if (!resp.ok) {
    const errorDetail = body.detail;
    if (typeof errorDetail === 'object' && errorDetail.error === 'MAX_CONCURRENT_SESSIONS_EXCEEDED') {
      const err: any = new Error(errorDetail.message || 'सत्र सीमा पूर्ण: अधिकतम 5 सक्रिय लॉगिन की अनुमति है।');
      err.isLimitExceeded = true;
      err.activeSlots = errorDetail.active_slots;
      throw err;
    }
    throw new Error(typeof errorDetail === 'string' ? errorDetail : 'लॉगिन विफल (Login failed)');
  }

  setStoredSession(body.data);
  return body.data;
}

export interface OtpSendResponse {
  username: string;
  display_name: string;
  role: string;
  masked_phone: string;
  expires_in_seconds: number;
}

export async function sendLoginOtp(identifier: string, phoneFallback?: string): Promise<OtpSendResponse> {
  const resp = await fetch(`${API_BASE}/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, phone_fallback: phoneFallback })
  });

  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(body.detail || 'OTP भेजने में त्रुटि (Failed to send OTP)');
  }
  return body.data;
}

export async function verifyLoginOtp(identifier: string, otp: string): Promise<any> {
  const resp = await fetch(`${API_BASE}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, otp })
  });

  const body = await resp.json();
  if (!resp.ok) {
    const errorDetail = body.detail;
    if (typeof errorDetail === 'object' && errorDetail.error === 'MAX_CONCURRENT_SESSIONS_EXCEEDED') {
      const err: any = new Error(errorDetail.message || 'सत्र सीमा पूर्ण: अधिकतम 5 सक्रिय लॉगिन की अनुमति है।');
      err.isLimitExceeded = true;
      err.activeSlots = errorDetail.active_slots;
      throw err;
    }
    throw new Error(typeof errorDetail === 'string' ? errorDetail : 'OTP सत्यापन विफल (OTP verification failed)');
  }

  setStoredSession(body.data);
  return body.data;
}

export async function logoutUser(): Promise<any> {
  const sessionId = getStoredSessionId();
  if (sessionId) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({ session_id: sessionId })
      });
    } catch (e) {
      console.error('Logout error:', e);
    }
  }
  clearStoredSession();
}

export async function fetchSessionsStatus(): Promise<any> {
  const resp = await fetch(`${API_BASE}/auth/sessions`);
  if (!resp.ok) throw new Error('Failed to fetch session slots');
  return resp.json();
}

export async function terminateSession(sessionId: string): Promise<any> {
  const resp = await fetch(`${API_BASE}/auth/sessions/${sessionId}/terminate`, {
    method: 'POST'
  });
  if (!resp.ok) throw new Error('Failed to terminate session');
  return resp.json();
}

export async function fetchCurrentUser(): Promise<any | null> {
  const sessionId = getStoredSessionId();
  if (!sessionId) return null;

  try {
    const resp = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'X-Session-ID': sessionId }
    });
    if (!resp.ok) {
      clearStoredSession();
      return null;
    }
    const data = await resp.json();
    return data.user;
  } catch {
    return null;
  }
}

export async function sendHeartbeat(): Promise<void> {
  const sessionId = getStoredSessionId();
  if (!sessionId) return;
  try {
    await fetch(`${API_BASE}/auth/heartbeat`, {
      method: 'POST',
      headers: { 'X-Session-ID': sessionId }
    });
  } catch {
    // Silent fail on heartbeat
  }
}

export interface SystemUser {
  id: number;
  username: string;
  display_name: string;
  phone_number?: string | null;
  role: string;
  is_active: boolean;
  created_at?: string;
  active_sessions: number;
}

export async function fetchUsersList(): Promise<SystemUser[]> {
  const sessionId = getStoredSessionId();
  const resp = await fetch(`${API_BASE}/auth/users`, {
    headers: { 'X-Session-ID': sessionId || '' }
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch users list');
  }
  const data = await resp.json();
  return data.users || [];
}

export async function adminChangeUserPassword(
  userId: number,
  newPassword: string,
  terminateSessions: boolean = true
): Promise<any> {
  const sessionId = getStoredSessionId();
  const resp = await fetch(`${API_BASE}/auth/users/${userId}/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId || ''
    },
    body: JSON.stringify({
      new_password: newPassword,
      terminate_sessions: terminateSessions
    })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to change password');
  }
  return resp.json();
}

export async function adminUpdateUser(
  userId: number,
  data: {
    username?: string;
    display_name?: string;
    phone_number?: string;
    role?: string;
    is_active?: boolean;
  }
): Promise<any> {
  const sessionId = getStoredSessionId();
  const resp = await fetch(`${API_BASE}/auth/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId || ''
    },
    body: JSON.stringify(data)
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update user');
  }
  return resp.json();
}

export async function adminCreateUser(data: {
  username: string;
  password: string;
  display_name: string;
  phone_number?: string;
  role?: string;
}): Promise<any> {
  const sessionId = getStoredSessionId();
  const resp = await fetch(`${API_BASE}/auth/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId || ''
    },
    body: JSON.stringify(data)
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create user');
  }
  return resp.json();
}

export async function adminDeleteUser(userId: number): Promise<any> {
  const sessionId = getStoredSessionId();
  const resp = await fetch(`${API_BASE}/auth/users/${userId}`, {
    method: 'DELETE',
    headers: { 'X-Session-ID': sessionId || '' }
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete user');
  }
  return resp.json();
}

export async function linkUserPhone(phoneNumber: string): Promise<any> {
  const sessionId = getStoredSessionId();
  const resp = await fetch(`${API_BASE}/auth/link-phone`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId || ''
    },
    body: JSON.stringify({ phone_number: phoneNumber })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to link phone number');
  }
  return resp.json();
}

export async function changeMyPassword(oldPassword: string, newPassword: string): Promise<any> {
  const sessionId = getStoredSessionId();
  const resp = await fetch(`${API_BASE}/auth/change-my-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId || ''
    },
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to change password');
  }
  return resp.json();
}




