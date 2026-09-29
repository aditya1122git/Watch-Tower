import { translations, Language } from '../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileLines, faArrowsRotate, faMoon, faSun, faShieldHalved,
  faTowerBroadcast, faBolt, faPaperPlane, faUsers, faRightFromBracket, faKey
} from '@fortawesome/free-solid-svg-icons';
import { getDownloadPdfUrl } from '../api';

interface HeaderProps {
  lang: Language;
  setLang: (lang: Language) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  isLive: boolean;
  activeAlertCount: number;
  currentUser?: any | null;
  activeSessionsCount?: number;
  onOpenSessionsModal?: () => void;
  onOpenUserManagement?: () => void;
  onLogout?: () => void;
  onRefreshSeed: () => void;
  onOpenImport: () => void;
  onOpenCollectors: () => void;
  onOpenTelegram: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  setLang,
  darkMode,
  setDarkMode,
  isLive,
  activeAlertCount,
  currentUser,
  activeSessionsCount = 1,
  onOpenSessionsModal,
  onOpenUserManagement,
  onLogout,
  onRefreshSeed,
  onOpenImport,
  onOpenCollectors,
  onOpenTelegram
}) => {
  const t = translations[lang];

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        
        {/* Brand & CM Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <FontAwesomeIcon icon={faTowerBroadcast} className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {t.appTitle}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                Bihar CM: Samrat Choudhary
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.subTitle}
            </p>
          </div>
        </div>

        {/* Status Indicators & Control Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Live SSE Pulse */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {isLive ? t.connected : t.disconnected}
            </span>
          </div>

          {/* Active Alerts Pill */}
          {activeAlertCount > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-bounce">
              <FontAwesomeIcon icon={faShieldHalved} className="w-3.5 h-3.5" />
              <span>{activeAlertCount} {lang === 'hi' ? 'गंभीर अलर्ट' : 'Critical'}</span>
            </div>
          )}

          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            {lang === 'en' ? '🇮🇳 हिंदी' : '🇬🇧 EN'}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Toggle Theme"
          >
            {darkMode ? <FontAwesomeIcon icon={faSun} className="w-4 h-4 text-amber-400" /> : <FontAwesomeIcon icon={faMoon} className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Live Feeds Button */}
          <button
            onClick={onOpenCollectors}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="View Live Stream Ingestion & Platform Feeds"
          >
            <FontAwesomeIcon icon={faBolt} className="w-3.5 h-3.5" />
            <span>{lang === 'hi' ? 'लाइव फ़ीड एपीआई (9 Sources)' : 'Live Feed APIs (9 Sources)'}</span>
          </button>

          {/* Telegram Alert Button */}
          <button
            onClick={onOpenTelegram}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Telegram Real-Time Alerts (@Rajnish517)"
          >
            <FontAwesomeIcon icon={faPaperPlane} className="w-3.5 h-3.5" />
            <span>{lang === 'hi' ? 'टेलीग्राम अलर्ट्स' : 'Telegram Alerts'}</span>
          </button>

          {/* Download PDF Report */}
          <a
            href={getDownloadPdfUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition-colors"
          >
            <FontAwesomeIcon icon={faFileLines} className="w-3.5 h-3.5" />
            <span>{t.actions.downloadPdf}</span>
          </a>

          {/* Reload Seed Data */}
          <button
            onClick={onRefreshSeed}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium shadow-sm transition-colors"
            title="Reload synthetic test dataset"
          >
            <FontAwesomeIcon icon={faArrowsRotate} className="w-3.5 h-3.5" />
            <span>{t.actions.seedData}</span>
          </button>

          {/* Active 5 Sessions Board Trigger */}
          {onOpenSessionsModal && (
            <button
              onClick={onOpenSessionsModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                activeSessionsCount >= 5
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
              }`}
              title="Active Concurrent Sessions Board (Max 5)"
            >
              <FontAwesomeIcon icon={faUsers} className="w-3.5 h-3.5" />
              <span>{activeSessionsCount} / 5 {lang === 'hi' ? 'सत्र' : 'Slots'}</span>
            </button>
          )}

          {/* User & Password Management Button */}
          {currentUser && onOpenUserManagement && (
            <button
              onClick={onOpenUserManagement}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              title="आईडी व पासवर्ड प्रबंधन (User & Password Management)"
            >
              <FontAwesomeIcon icon={faKey} className="w-3.5 h-3.5" />
              <span>
                {currentUser.role === 'admin'
                  ? (lang === 'hi' ? '🔑 यूज़र व पासवर्ड' : '🔑 Users & Auth')
                  : (lang === 'hi' ? '🔑 पासवर्ड / मोबाइल' : '🔑 Password / Phone')}
              </span>
            </button>
          )}

          {/* User Profile & Logout */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">
                  {currentUser.display_name || currentUser.username}
                </span>
                <div className="flex items-center justify-end gap-1.5">
                  {currentUser.phone_number && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      📱 {currentUser.phone_number}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 capitalize font-mono">
                    ({currentUser.role || 'Operator'})
                  </span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                  title="लॉगआउट करें (स्लॉट खाली करें)"
                >
                  <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
