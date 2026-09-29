import React, { useState, useEffect } from 'react';
import { SessionsStatus, SessionSlot } from '../types';
import { fetchSessionsStatus, terminateSession, getStoredSessionId } from '../api';
import { Language } from '../i18n';
import {
  Users, ShieldAlert, X, RefreshCw, PowerOff, CheckCircle2,
  Clock, Monitor, Smartphone, Globe
} from 'lucide-react';

interface ActiveSessionsModalProps {
  lang: Language;
  onClose: () => void;
  onSessionTerminated?: () => void;
}

export const ActiveSessionsModal: React.FC<ActiveSessionsModalProps> = ({
  lang,
  onClose,
  onSessionTerminated
}) => {
  const [sessionsData, setSessionsData] = useState<SessionsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const currentSessionId = getStoredSessionId();

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await fetchSessionsStatus();
      setSessionsData(data);
    } catch (err: any) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleTerminate = async (sessionId: string) => {
    setTerminatingId(sessionId);
    try {
      await terminateSession(sessionId);
      setMsg(lang === 'hi' ? 'सत्र सफलतापूर्वक समाप्त कर स्लॉट खाली कर दिया गया।' : 'Session terminated successfully. Slot is now free.');
      await loadSessions();
      if (onSessionTerminated) onSessionTerminated();
      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setMsg(err.message || 'Termination failed');
    } finally {
      setTerminatingId(null);
    }
  };

  const activeCount = sessionsData?.active_sessions_count ?? 0;
  const maxAllowed = sessionsData?.max_concurrent_logins ?? 5;
  const isFull = activeCount >= maxAllowed;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl ${isFull ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{lang === 'hi' ? 'सक्रिय सत्र बोर्ड (अधिकतम 5 समवर्ती लॉगिन)' : 'Active Sessions Board (Max 5 Concurrent Logins)'}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isFull ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {activeCount} / {maxAllowed} {lang === 'hi' ? 'स्लॉट' : 'Slots'}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'hi'
                  ? 'सुरक्षा नीति: सीएम वॉर रूम में एक समय में केवल 5 सक्रिय ऑपरेटर लॉगिन रह सकते हैं।'
                  : 'Policy: Strict maximum 5 concurrent active operators allowed in the War Room.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSessions}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              title="Refresh Slots"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {msg && (
          <div className="mt-4 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-200">
            {msg}
          </div>
        )}

        {/* Slots Overview Status */}
        <div className="mt-4 grid grid-cols-5 gap-2">
          {sessionsData?.slots.map((s, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                s.is_occupied
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 border-dashed'
              }`}
            >
              <div className="text-[10px] font-mono text-slate-400">स्लॉट #{s.slot_number}</div>
              <div className="mt-1 flex items-center justify-center">
                <span className={`w-2.5 h-2.5 rounded-full ${s.is_occupied ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </div>
              <div className="text-[11px] font-bold mt-1 text-slate-800 dark:text-slate-200 truncate">
                {s.is_occupied ? s.username : (lang === 'hi' ? 'खाली' : 'Free')}
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Slots List */}
        <div className="mt-5 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {sessionsData?.slots.map((slot: SessionSlot) => {
            const isCurrent = slot.session_id === currentSessionId;

            return (
              <div
                key={slot.slot_number}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  slot.is_occupied
                    ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                    : 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 border-dashed'
                }`}
              >
                {/* Left: Slot & User info */}
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center ${
                    slot.is_occupied
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}>
                    #{slot.slot_number}
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {slot.display_name}
                      </span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                          {lang === 'hi' ? 'यह डिवाइस (आप)' : 'This Device (You)'}
                        </span>
                      )}
                    </div>

                    {slot.is_occupied ? (
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Globe className="w-3 h-3 text-slate-400" />
                          {slot.ip_address}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Monitor className="w-3 h-3 text-slate-400" />
                          {slot.device_info}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">
                        {lang === 'hi' ? 'स्लॉट उपलब्ध है — कोई भी ऑपरेटर लॉगिन कर सकता है' : 'Slot available for incoming operator'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                {slot.is_occupied && slot.session_id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTerminate(slot.session_id!)}
                      disabled={terminatingId === slot.session_id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 transition-colors cursor-pointer"
                      title="Force terminate this session to free up a slot"
                    >
                      <PowerOff className="w-3.5 h-3.5" />
                      <span>{lang === 'hi' ? 'सत्र समाप्त करें' : 'Terminate'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>{lang === 'hi' ? 'नियम: अधिकतम 5 सक्रिय सत्र एक साथ' : 'Rule: Strictly max 5 concurrent sessions'}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            {lang === 'hi' ? 'बंद करें' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
