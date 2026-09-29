import React, { useState, useEffect } from 'react';
import {
  fetchTelegramConfig,
  updateTelegramConfig,
  sendTestTelegramAlert,
  addTelegramRecipient,
  removeTelegramRecipient,
  TelegramConfig
} from '../api';
import { Language } from '../i18n';
import {
  X, Send, CheckCircle2, AlertTriangle, ShieldCheck, Key,
  ExternalLink, Bell, Smartphone, RefreshCw, Copy, Check,
  Users, Plus, Trash2, UserCheck
} from 'lucide-react';

interface TelegramAlertModalProps {
  lang: Language;
  onClose: () => void;
}

export const TelegramAlertModal: React.FC<TelegramAlertModalProps> = ({ lang, onClose }) => {
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('7566579670, 7574720019');
  const [recipients, setRecipients] = useState<string[]>(['7566579670', '7574720019']);
  const [newRecipientInput, setNewRecipientInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await fetchTelegramConfig();
      setConfig(data);
      if (data.target_chat_ids && data.target_chat_ids.length > 0) {
        setRecipients(data.target_chat_ids);
        setChatId(data.target_chat_ids.join(', '));
      } else if (data.target_chat_id) {
        setChatId(data.target_chat_id);
        const parsed = data.target_chat_id.split(',').map(s => s.trim()).filter(Boolean);
        setRecipients(parsed);
      }
    } catch (err: any) {
      console.error('Failed to load telegram config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipient = async () => {
    if (!newRecipientInput.trim()) return;
    const clean = newRecipientInput.trim();
    try {
      await addTelegramRecipient(clean);
      setNewRecipientInput('');
      setMessage(lang === 'hi' ? `आईडी ${clean} जोड़ दी गई!` : `Added recipient ${clean}!`);
      loadConfig();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleRemoveRecipient = async (idToRemove: string) => {
    try {
      await removeTelegramRecipient(idToRemove);
      setMessage(lang === 'hi' ? `आईडी ${idToRemove} हटा दी गई!` : `Removed recipient ${idToRemove}!`);
      loadConfig();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateTelegramConfig({
        bot_token: botToken || undefined,
        target_chat_id: chatId
      });
      setMessage(lang === 'hi' ? 'सेटिंग्स सफलतापूर्वक सहेज ली गईं!' : 'Configuration updated successfully!');
      loadConfig();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await sendTestTelegramAlert({
        bot_token: botToken || undefined,
        target_chat_id: chatId || undefined
      });
      setTestResult(res);
      loadConfig();
    } catch (err: any) {
      setTestResult({ status: 'error', error: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-500">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'टेलीग्राम नेगेटिव पोस्ट अलर्ट' : 'Telegram Negative Alert Dispatcher'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  {chatId}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'hi'
                  ? 'नेगेटिव पोस्ट का लिंक और अलर्ट तुरंत टेलीग्राम पर प्राप्त करें'
                  : 'Real-time crisis alert delivery directly to your Telegram handle'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="mt-4 space-y-5 overflow-y-auto pr-1">

          {/* EXACT VISUAL PREVIEW AS UPLOADED IN USER'S PHOTO */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-sky-500" />
                <span>{lang === 'hi' ? 'टेलीग्राम संदेश प्रारूप (Exact Format)' : 'Telegram Alert Preview (Exact User Format)'}</span>
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Reference Format Verified
              </span>
            </div>

            {/* Telegram Chat Bubble Preview Mockup */}
            <div className="rounded-2xl bg-[#0f172a] text-slate-100 p-4 border border-slate-700/60 shadow-lg font-sans text-xs space-y-2.5 select-none">
              <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold border-b border-slate-800 pb-1.5">
                <span>Watch-Tower</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] border border-emerald-800">
                  Admin
                </span>
              </div>

              <div className="text-sm font-bold text-white flex items-center gap-1.5 pt-0.5">
                <span>🔴 ALERT — YouTube — Samrat Choudhary Ji</span>
              </div>

              <div className="space-y-0.5 text-xs text-slate-300">
                <div><b>Views:</b> 13.3K</div>
                <div><b>Sentiment:</b> <span className="font-extrabold text-rose-400">NEGATIVE</span></div>
                <div><b>Account:</b> Molitics</div>
              </div>

              <p className="text-xs text-slate-200 italic bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 leading-relaxed">
                निकम्मी पुलिस बिहार की, रील से होगा Crime Control? | Know The News | Nivedita and Neeraj Jha
              </p>

              <div className="pt-1 flex items-center justify-between">
                <a
                  href="https://www.youtube.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 font-bold hover:underline"
                >
                  <span>🔗 View on YouTube</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-[10px] text-slate-500">Live Delivery</span>
              </div>
            </div>
          </div>

          {/* Test Alert Result Banner */}
          {testResult && (
            <div className={`p-3.5 rounded-2xl border text-xs ${
              testResult.test_status === 'success' || testResult.status === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-900 dark:text-amber-200'
            }`}>
              <div className="flex items-center gap-2 font-bold mb-1">
                {testResult.test_status === 'success' || testResult.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span>
                  {testResult.test_status === 'success' || testResult.status === 'success'
                    ? (lang === 'hi' ? 'अलर्ट सफलतापूर्वक टेलीग्राम पर भेज दिया गया!' : 'Alert sent successfully to Telegram!')
                    : (lang === 'hi' ? 'अलर्ट तैयार है (नीचे बॉट टोकन जोड़ें):' : 'Alert Formatted (Add Bot Token below):')}
                </span>
              </div>
              <p className="text-[11px] opacity-90">
                {testResult.details?.message || testResult.details?.description || testResult.message || JSON.stringify(testResult.details || testResult)}
              </p>
              {testResult.details?.help && (
                <p className="text-[11px] mt-1 font-semibold text-rose-600 dark:text-rose-400">
                  👉 {testResult.details.help}
                </p>
              )}
            </div>
          )}

          {/* Message feedback */}
          {message && (
            <div className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200 text-xs font-medium">
              {message}
            </div>
          )}

          {/* Active Recipients Management Card */}
          <div className="p-4 rounded-2xl bg-sky-50/50 dark:bg-slate-800/60 border border-sky-200 dark:border-sky-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {lang === 'hi' ? 'सक्रिय अलर्ट प्राप्तकर्ता (Active Alert Recipients)' : 'Active Telegram Recipients'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  {recipients.length} {lang === 'hi' ? 'आईडी' : 'IDs'}
                </span>
              </div>
            </div>

            {/* Recipients Badges */}
            <div className="flex flex-wrap gap-2">
              {recipients.map((id) => (
                <div
                  key={id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-mono">{id}</span>
                  {id === '7566579670' && <span className="text-[10px] text-slate-400 font-normal">(Aakash)</span>}
                  {(id === '7574720019' || id.toLowerCase().includes('rajnish')) && (
                    <span className="text-[10px] text-sky-500 font-bold">(@Rajnish517)</span>
                  )}
                  {recipients.length > 1 && (
                    <button
                      onClick={() => handleRemoveRecipient(id)}
                      title="Remove ID"
                      className="p-0.5 hover:text-rose-500 text-slate-400 transition-colors ml-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Add Another ID */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newRecipientInput}
                onChange={(e) => setNewRecipientInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRecipient()}
                placeholder={lang === 'hi' ? 'नई टेलीग्राम आईडी या @username दर्ज करें...' : 'Enter new Telegram numeric ID or @username...'}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              />
              <button
                onClick={handleAddRecipient}
                disabled={!newRecipientInput.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'hi' ? 'आईडी जोड़ें' : 'Add ID'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              💡 {lang === 'hi'
                ? 'नई आईडी जोड़ने के बाद उस व्यक्ति को बॉट (@CMO_Bihar_Monitoring_bot) पर एक बार /start दबाना आवश्यक है।'
                : 'Recipient must click /start in @CMO_Bihar_Monitoring_bot once to allow alert messages.'}
            </p>
          </div>

          {/* Target ID & Bot Token Form */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-500" />
              <span>{lang === 'hi' ? 'टेलीग्राम बॉट एवं आईडी कॉन्फ़िगरेशन' : 'Telegram Bot & User Configuration'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {lang === 'hi' ? 'प्राप्तकर्ता टेलीग्राम आईडी (Target Handle)' : 'Recipient Telegram ID'}
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="@Rajnish517"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {lang === 'hi' ? 'टेलीग्राम बॉट टोकन (Telegram Bot Token)' : 'Telegram Bot Token'}
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder={config?.has_bot_token ? '•••••••••••••••••••• (Configured)' : '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Status: <b>{config?.has_bot_token ? 'Bot Active 🟢' : 'Token Required ⚪'}</b>
              </span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 text-xs font-bold transition-all disabled:opacity-50"
              >
                {saving ? (lang === 'hi' ? 'सहेजा जा रहा है...' : 'Saving...') : (lang === 'hi' ? 'सेव करें' : 'Save Config')}
              </button>
            </div>
          </div>

          {/* 30-Second Quick Setup Guide in Hindi */}
          <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs space-y-1.5">
            <div className="font-bold text-sky-900 dark:text-sky-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>{lang === 'hi' ? 'बॉट शुरू करने के 3 आसान कदम:' : '3 Easy Steps to Start Receiving Alerts:'}</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
              <li>Telegram खोलें और <b>@BotFather</b> सर्च करें।</li>
              <li><b>/newbot</b> भेजें, अपने बॉट का नाम (उदा. <i>SamratWatchtowerBot</i>) सेट करें और प्राप्त <b>API Token</b> यहाँ ऊपर पेस्ट करके Save करें।</li>
              <li>अपने नए बॉट के चैट में जाकर <b>START</b> बटन दबाएँ — इसके बाद Watchtower के सभी नेगेटिव अलर्ट्स सीधे <b>{chatId}</b> पर आने लगेंगे!</li>
            </ol>
          </div>

          {/* Recent Dispatched Alerts History */}
          {config?.recent_history && config.recent_history.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-rose-500" />
                <span>{lang === 'hi' ? 'हाल के भेजे गए टेलीग्राम अलर्ट्स' : 'Recent Dispatched Alerts Log'}</span>
              </h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {config.recent_history.map((h, i) => (
                  <div key={i} className="p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-[11px] flex items-center justify-between">
                    <div>
                      <span className="font-bold capitalize mr-1.5 text-slate-800 dark:text-slate-200">[{h.platform}]</span>
                      <span className="text-slate-600 dark:text-slate-400 line-clamp-1">{h.headline}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                      {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={handleSendTest}
            disabled={testing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            <Send className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            <span>
              {testing
                ? (lang === 'hi' ? 'अलर्ट भेजा जा रहा है...' : 'Sending Alert...')
                : (lang === 'hi' ? `⚡ सभी (${recipients.length}) आईडी पर टेस्ट अलर्ट भेजें` : `⚡ Send Test Alert to all (${recipients.length}) IDs`)}
            </span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
          >
            {lang === 'hi' ? 'बंद करें' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
