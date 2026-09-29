import React from 'react';
import { Alert } from '../types';
import { translations, Language } from '../i18n';
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, ExternalLink, Bot } from 'lucide-react';

interface AlertsCenterProps {
  alerts: Alert[];
  lang: Language;
  onAcknowledge: (id: number) => void;
  onResolve: (id: number) => void;
  onOpenTelegram?: () => void;
}

export const AlertsCenter: React.FC<AlertsCenterProps> = ({
  alerts,
  lang,
  onAcknowledge,
  onResolve,
  onOpenTelegram
}) => {
  const t = translations[lang];

  return (
    <div className="space-y-4">
      {/* Telegram Live Dispatcher Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 border border-sky-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500 text-white font-bold text-xs shadow-sm">
            TG
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {lang === 'hi' ? 'टेलीग्राम रीयल-टाइम अलर्ट प्रणाली' : 'Telegram Real-Time Crisis Dispatcher'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                Target: @Rajnish517
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              {lang === 'hi'
                ? 'सभी नकारात्मक पोस्ट, यूट्यूब वीडियो, रील्स और ट्वीट्स के लिंक सीधे टेलीग्राम पर भेजे जा रहे हैं।'
                : 'Direct dispatch of negative posts, videos, reels & tweets with direct links to Telegram.'}
            </p>
          </div>
        </div>

        {onOpenTelegram && (
          <button
            onClick={onOpenTelegram}
            className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            {lang === 'hi' ? 'सेटिंग्स एवं टेस्ट' : 'Configure & Test'}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t.tabs.alerts}
          </h2>
          <p className="text-xs text-slate-500">
            Early crisis warning triggers (500+ negative comments, velocity spikes, bot coordination signals)
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
          {alerts.filter(a => a.status === 'active').length} Active Incidents
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">
          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">All Clear</p>
          <p className="text-xs text-slate-500 mt-0.5">No critical threshold breaches currently detected.</p>
        </div>
      ) : (
        alerts.map((alert) => {
          const isCritical = alert.severity === 'critical';
          const isCoordinated = alert.alert_type === 'coordinated_campaign';

          let borderClass = 'border-rose-300 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20';
          let icon = <ShieldAlert className="w-5 h-5 text-rose-600" />;

          if (isCoordinated) {
            borderClass = 'border-amber-300 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20';
            icon = <Bot className="w-5 h-5 text-amber-600" />;
          } else if (!isCritical) {
            borderClass = 'border-orange-300 dark:border-orange-900 bg-orange-50/40 dark:bg-orange-950/20';
            icon = <AlertTriangle className="w-5 h-5 text-orange-600" />;
          }

          return (
            <div
              key={alert.id}
              className={`p-5 rounded-2xl border ${borderClass} shadow-sm transition-all`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 shadow-xs">
                    {icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                        isCritical ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                      }`}>
                        {alert.severity}
                      </span>
                      {alert.platform && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {alert.platform === 'rss' ? 'News' : alert.platform}
                        </span>
                      )}
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {alert.title}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Triggered: {new Date(alert.triggered_at).toLocaleTimeString()}
                      </span>
                      {alert.negative_comment_count > 0 && (
                        <span>Negative Comments: <b>{alert.negative_comment_count}</b></span>
                      )}
                      <span>Status: <b className="capitalize text-slate-700 dark:text-slate-200">{alert.status}</b></span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const targetLink = alert.post_permalink || (alert.top_negative_comments_json?.[0]?.permalink ? alert.top_negative_comments_json[0].permalink.split('&lc=')[0] : null);
                    if (!targetLink) return null;
                    const plat = (alert.platform || 'youtube').toLowerCase();
                    const platName = plat === 'youtube' ? 'YouTube' : plat === 'twitter' ? 'X (Twitter)' : plat === 'facebook' ? 'Facebook' : plat === 'instagram' ? 'Instagram' : plat === 'rss' ? 'News' : plat.toUpperCase();
                    return (
                      <a
                        href={targetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{lang === 'hi' ? `${platName} पर देखें` : `View on ${platName}`}</span>
                      </a>
                    );
                  })()}

                  {alert.status === 'active' && (
                    <button
                      onClick={() => onAcknowledge(alert.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 transition-colors"
                    >
                      {t.actions.acknowledge}
                    </button>
                  )}
                  {alert.status !== 'resolved' && (
                    <button
                      onClick={() => onResolve(alert.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                    >
                      {t.actions.resolve}
                    </button>
                  )}
                </div>
              </div>

              {/* Embedded Top Negative Comments with Deep Links */}
              {alert.top_negative_comments_json && alert.top_negative_comments_json.length > 0 && (
                <div className="mt-4 pt-3 border-t border-rose-200/60 dark:border-rose-900/40">
                  <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider mb-2">
                    Top Negative Comments with Direct Video Links (Evidence):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {alert.top_negative_comments_json.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-rose-100 dark:border-rose-900/60 text-xs"
                      >
                        <p className="text-slate-800 dark:text-slate-200 line-clamp-2">"{c.text}"</p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                          <span>Likes: {c.like_count || 0}</span>
                          <a
                            href={
                              c.permalink && c.permalink.startsWith('http')
                                ? (c.permalink.includes('&lc=c_') ? c.permalink.split('&lc=')[0] : c.permalink)
                                : (alert.post_permalink || 'https://www.youtube.com/watch?v=li5ptLL5Vyo')
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400 font-semibold hover:underline"
                          >
                            <span>{lang === 'hi' ? 'वीडियो देखें' : 'Watch Video'}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          );
        })
      )}
    </div>
  );
};
