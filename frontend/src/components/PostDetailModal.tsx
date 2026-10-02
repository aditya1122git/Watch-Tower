import React, { useEffect, useState } from 'react';
import { Post, Comment } from '../types';
import { translations, Language } from '../i18n';
import { fetchPostDetail } from '../api';
import { X, ExternalLink, ThumbsUp, MessageSquare, AlertTriangle, ShieldCheck } from 'lucide-react';

interface PostDetailModalProps {
  post: Post;
  lang: Language;
  onClose: () => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({ post, lang, onClose }) => {
  const t = translations[lang];
  const [detail, setDetail] = useState<{
    top_negative_comments: Comment[];
    top_positive_comments: Comment[];
    snapshots: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPostDetail(post.id)
      .then(res => {
        setDetail(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [post.id]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="capitalize text-xs font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                {post.platform}
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {post.author_name} (@{post.author_handle})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Posted: {new Date(post.posted_at).toLocaleString()}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Post Text & Direct Link */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {post.text}
            </p>
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Canonical Link:
              </span>
              <a
                href={post.permalink_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline"
              >
                <span>{t.actions.openOriginal}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Metrics Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Views / Reach</span>
              <p className="text-base font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                {post.views.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Total Comments</span>
              <p className="text-base font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                {post.comment_count.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">Negative Comments</span>
              <p className="text-base font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">
                {post.negative_comment_count} ({post.negative_comment_pct.toFixed(1)}%)
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Positive Comments</span>
              <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {post.positive_comment_count}
              </p>
            </div>
          </div>

          {/* Post Intelligence & Stance Analysis */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-slate-50/60 dark:bg-slate-800/40">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-600" /> Post Intelligence & Key Insights
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px] mb-1">Sentiment Classification</span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-bold text-xs ${
                  post.sentiment_verdict === 'Negative'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : post.sentiment_verdict === 'Positive'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {post.sentiment_verdict === 'Negative' ? '🔴 Negative (आलोचनात्मक)' : post.sentiment_verdict === 'Positive' ? '🟢 Positive (समर्थक)' : '⚪ Neutral'}
                  {' '}(Score: {post.sentiment_score})
                </span>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px] mb-1">Source / Author Stance</span>
                <span className="capitalize font-semibold text-slate-800 dark:text-slate-200">
                  {post.author_label === 'news-media' ? '📺 News Channel / Media Bulletin' : post.author_label === 'opposition' ? '🔴 Opposition / Critic' : post.author_label === 'official' ? '🔵 Official Account / Office' : post.author_label === 'creator' ? '🎬 Public Creator / Reel' : post.author_label === 'supporter' ? '🟢 Pro-Government / Supporter' : '⚪ Public Citizen'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px] mb-1">Core Topic & Policy Area</span>
                <span className="capitalize font-semibold text-slate-800 dark:text-slate-200">
                  {post.top_topic || 'Governance & Public Administration'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px] mb-1">Matched Keywords</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {Array.isArray(post.matched_keywords) ? post.matched_keywords.join(', ') : 'Samrat Choudhary'}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
