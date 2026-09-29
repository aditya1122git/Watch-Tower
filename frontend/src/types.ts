export interface Post {
  id: number;
  platform: string;
  platform_item_id: string;
  author_handle: string;
  author_name: string;
  author_label: string;
  permalink_url: string;
  canonical_url: string;
  text: string;
  media_type: string;
  language: string;
  posted_at: string;
  first_seen_at: string;
  last_checked_at: string;
  link_status: 'active' | 'deleted' | 'private' | 'unavailable';
  sentiment_verdict: 'Positive' | 'Negative' | 'Neutral' | 'Mixed' | 'Needs Review';
  sentiment_score: number;
  confidence: number;
  top_topic: string;
  views: number;
  likes: number;
  shares: number;
  comment_count: number;
  negative_comment_count: number;
  positive_comment_count: number;
  neutral_comment_count: number;
  mixed_comment_count: number;
  negative_comment_pct: number;
  growth_velocity: number;
  alert_flag: boolean;
  alert_milestone: number;
  matched_keywords: string[];
}

export interface Comment {
  id: number;
  post_id: number;
  platform_comment_id: string;
  commenter_hash: string;
  text: string;
  language: string;
  timestamp: string;
  like_count: number;
  sentiment_label: string;
  sentiment_score: number;
  confidence: number;
  target_of_sentiment: string;
  topic: string;
  is_sarcastic: boolean;
  is_abusive: boolean;
  reason_short: string;
  permalink_url: string;
}

export interface Alert {
  id: number;
  post_id: number;
  post_permalink?: string;
  post_title?: string;
  platform?: string;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  milestone_value: number;
  title: string;
  message: string;
  negative_comment_count: number;
  negative_pct: number;
  growth_rate: number;
  top_topics_json: string[];
  top_negative_comments_json: Array<{
    text: string;
    permalink: string;
    like_count?: number;
    platform_comment_id?: string;
  }>;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by?: string;
  resolved_by?: string;
  triggered_at: string;
  resolved_at?: string;
}

export interface OverviewStats {
  overall_sentiment_score: number;
  total_posts: number;
  total_comments: number;
  active_alerts: number;
  total_negative_comments: number;
  total_positive_comments: number;
  total_neutral_comments: number;
  platforms: Record<string, number>;
  verdicts: Record<string, number>;
  top_negative_posts: Post[];
  top_positive_posts: Post[];
}

export interface UserSession {
  session_id: string;
  username: string;
  display_name: string;
  role: string;
  active_sessions_count: number;
  max_allowed: number;
}

export interface SessionSlot {
  slot_number: number;
  is_occupied: boolean;
  session_id: string | null;
  user_id?: number | null;
  username: string | null;
  display_name: string;
  ip_address?: string;
  user_agent?: string;
  device_info?: string;
  created_at: string | null;
  last_active_at?: string | null;
}

export interface SessionsStatus {
  status: string;
  max_concurrent_logins: number;
  active_sessions_count: number;
  available_slots: number;
  slots: SessionSlot[];
}

export interface PlatformRefreshStatus {
  platform: string;
  display_name: string;
  refresh_interval: string;
  interval_minutes: number | null;
  last_updated: string | null;
  last_updated_display: string;
  next_refresh: string | null;
  next_refresh_display: string;
  status: 'Current' | 'Updating' | 'Failed' | 'New';
  seconds_remaining?: number | null;
  last_successful_update?: string | null;
  last_successful_update_display?: string;
  last_error?: string | null;
  items_fetched?: number;
  new_saved?: number;
  deduplicated_count?: number | null;
}


