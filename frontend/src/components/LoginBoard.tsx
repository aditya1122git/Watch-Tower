import React, { useState, useEffect } from 'react';
import { Language } from '../i18n';
import { loginUser, sendLoginOtp, verifyLoginOtp, fetchSessionsStatus, terminateSession } from '../api';
import { SessionsStatus } from '../types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTowerBroadcast, faKey, faPaperPlane, faUser, faLock,
  faEye, faEyeSlash, faUsers, faTriangleExclamation, faPowerOff,
  faRotateRight, faShieldHalved, faArrowLeft, faCircleCheck,
  faMobileScreen, faCircleNotch, faRightToBracket, faCrown,
  faWandMagicSparkles, faEye as faEyeIcon
} from '@fortawesome/free-solid-svg-icons';
import { faTelegram } from '@fortawesome/free-brands-svg-icons';

interface LoginBoardProps {
  lang: Language;
  onLoginSuccess: (userData: any) => void;
  onBypassPreview?: () => void;
}

export const LoginBoard: React.FC<LoginBoardProps> = ({ lang, onLoginSuccess, onBypassPreview }) => {
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Bihar2026@CM');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionsStatus, setSessionsStatus] = useState<SessionsStatus | null>(null);
  const [showManageSlots, setShowManageSlots] = useState(false);
  const [terminatingSlotId, setTerminatingSlotId] = useState<string | null>(null);

  const [otpIdentifier, setOtpIdentifier] = useState('admin');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [gatewayNotice, setGatewayNotice] = useState<string | null>(null);

  const loadSlots = async () => {
    try { const data = await fetchSessionsStatus(); setSessionsStatus(data); }
    catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadSlots();
    const interval = setInterval(loadSlots, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (otpCountdown > 0) {
      const t = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpCountdown]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null); setLoading(true);
    try {
      const userData = await loginUser(username.trim(), password);
      if (userData.requires_otp) {
        setOtpIdentifier(userData.username || username.trim());
        setMaskedPhone(userData.masked_phone || '+91 9140****71');
        setOtpSent(true); setOtpCountdown(30);
        if (userData.dev_otp) setDevOtp(userData.dev_otp);
        if (userData.gateway_notice) setGatewayNotice(userData.gateway_notice);
        setLoginMode('otp'); return;
      }
      onLoginSuccess(userData);
    } catch (err: any) {
      setErrorMsg(err.message || (lang === 'hi' ? 'लॉगिन विफल' : 'Login failed'));
      await loadSlots();
      if (err.isLimitExceeded) setShowManageSlots(true);
    } finally { setLoading(false); }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = otpIdentifier.trim();
    if (!cleanId) { setErrorMsg(lang === 'hi' ? 'मोबाइल / यूज़रनेम दर्ज करें' : 'Enter mobile or username'); return; }
    try {
      setOtpLoading(true); setErrorMsg(null);
      const res = await sendLoginOtp(cleanId);
      setOtpSent(true); setMaskedPhone(res.masked_phone);
      if ((res as any).dev_otp) setDevOtp((res as any).dev_otp);
      if ((res as any).gateway_notice) setGatewayNotice((res as any).gateway_notice);
      setOtpCountdown(30);
    } catch (err: any) { setErrorMsg(err.message || 'OTP send failed'); }
    finally { setOtpLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length < 4) { setErrorMsg(lang === 'hi' ? '6-अंकों का OTP दर्ज करें' : 'Enter the 6-digit OTP'); return; }
    try {
      setLoading(true); setErrorMsg(null);
      const userData = await verifyLoginOtp(otpIdentifier.trim(), otpCode.trim());
      onLoginSuccess(userData);
    } catch (err: any) {
      setErrorMsg(err.message || 'OTP verification failed');
      await loadSlots();
      if (err.isLimitExceeded) setShowManageSlots(true);
    } finally { setLoading(false); }
  };

  const handleTerminateSlot = async (sessionId: string) => {
    setTerminatingSlotId(sessionId);
    try {
      await terminateSession(sessionId); await loadSlots();
      setErrorMsg(lang === 'hi' ? 'सत्र समाप्त! अब लॉगिन करें।' : 'Session terminated! You may log in now.');
    } catch (err: any) { setErrorMsg(err.message || 'Termination failed'); }
    finally { setTerminatingSlotId(null); }
  };

  const activeCount = sessionsStatus?.active_sessions_count ?? 0;
  const maxAllowed  = sessionsStatus?.max_concurrent_logins ?? 5;
  const isFull      = activeCount >= maxAllowed;

  /* ── Facebook-style CSS ── */
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Helvetica+Neue:wght@400;700&family=Segoe+UI:wght@400;600;700&display=swap');

    .fb-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    /* ── Hero Title Area ── */
    .fb-hero {
      text-align: center;
      margin-bottom: 1.5rem;
      max-width: 500px;
    }
    .fb-hero-logo {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: #1877F2;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 0.75rem;
      box-shadow: 0 4px 16px rgba(24, 119, 242, 0.3);
    }
    .fb-hero h1 {
      color: #1877F2;
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0 0 0.35rem;
      letter-spacing: -0.02em;
    }
    .fb-hero p {
      color: #606770;
      font-size: 0.95rem;
      margin: 0;
      line-height: 1.5;
    }

    /* ── Main Card ── */
    .fb-card {
      width: 100%;
      max-width: 396px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1);
      padding: 1.25rem 1rem;
      animation: fb-rise 0.35s ease both;
    }

    @keyframes fb-rise {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Session Badge ── */
    .fb-session-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #e7f3ff;
      border: 1px solid #d0e5fc;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 0.8rem;
      color: #1877F2;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .fb-session-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }
    .fb-session-dot.green { background: #42b72a; box-shadow: 0 0 6px rgba(66,183,42,0.5); }
    .fb-session-dot.red   { background: #fa3e3e; box-shadow: 0 0 6px rgba(250,62,62,0.5); }

    /* ── Slot Bar ── */
    .fb-slot-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0;
      border-bottom: 1px solid #dadde1;
      margin-bottom: 1rem;
      font-size: 0.75rem;
    }
    .fb-slot-label {
      color: #8a8d91;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .fb-slots {
      display: flex;
      gap: 5px;
    }
    .fb-slot {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6rem;
      font-weight: 900;
      transition: all 0.2s;
    }
    .fb-slot.occupied {
      background: #fa3e3e;
      color: #fff;
      border: 1.5px solid #e63535;
    }
    .fb-slot.free {
      background: #e6f4ea;
      color: #42b72a;
      border: 1.5px solid #c6e6cc;
    }

    /* ── Inputs ── */
    .fb-input-group {
      margin-bottom: 0.75rem;
      position: relative;
    }
    .fb-input {
      width: 100%;
      padding: 14px 16px 14px 42px;
      border: 1px solid #dddfe2;
      border-radius: 6px;
      font-size: 1rem;
      color: #1d2129;
      background: #fff;
      outline: none;
      font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
      transition: border-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;
    }
    .fb-input:focus {
      border-color: #1877F2;
      box-shadow: 0 0 0 2px rgba(24, 119, 242, 0.2);
    }
    .fb-input::placeholder {
      color: #8a8d91;
    }
    .fb-input-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: #8a8d91;
      font-size: 0.85rem;
      pointer-events: none;
    }

    /* ── Buttons ── */
    .fb-btn-primary {
      width: 100%;
      padding: 0.75rem 1rem;
      background: #1877F2;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 1.05rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
      transition: background 0.2s, transform 0.15s, box-shadow 0.15s;
    }
    .fb-btn-primary:hover:not(:disabled) {
      background: #166fe5;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(24, 119, 242, 0.35);
    }
    .fb-btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .fb-btn-green {
      width: 100%;
      padding: 0.75rem 1rem;
      background: #42b72a;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 1.05rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
      transition: background 0.2s, transform 0.15s, box-shadow 0.15s;
    }
    .fb-btn-green:hover:not(:disabled) {
      background: #36a420;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(66, 183, 42, 0.35);
    }
    .fb-btn-green:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* ── Tabs ── */
    .fb-tabs {
      display: flex;
      gap: 0;
      border: 1px solid #dadde1;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 1rem;
    }
    .fb-tab {
      flex: 1;
      padding: 0.6rem;
      border: none;
      cursor: pointer;
      font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
      font-weight: 600;
      font-size: 0.82rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      transition: all 0.18s;
    }
    .fb-tab-active {
      background: #e7f3ff;
      color: #1877F2;
    }
    .fb-tab-inactive {
      background: #f5f6f7;
      color: #8a8d91;
    }
    .fb-tab-inactive:hover {
      background: #ebedf0;
      color: #606770;
    }

    /* ── Divider ── */
    .fb-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 1rem 0;
    }
    .fb-divider-line {
      flex: 1;
      height: 1px;
      background: #dadde1;
    }
    .fb-divider-text {
      color: #8a8d91;
      font-size: 0.78rem;
      font-weight: 600;
    }

    /* ── Alerts ── */
    .fb-alert-error {
      background: #ffebe9;
      border: 1px solid #ffc1c0;
      border-radius: 6px;
      padding: 0.65rem 1rem;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.82rem;
      color: #c4302b;
    }
    .fb-alert-info {
      background: #e7f3ff;
      border: 1px solid #d0e5fc;
      border-radius: 6px;
      padding: 0.6rem 0.9rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.78rem;
      color: #1877F2;
    }
    .fb-alert-warning {
      background: #fff4e5;
      border: 1px solid #ffd699;
      border-radius: 6px;
      padding: 0.65rem 1rem;
      margin-bottom: 0.75rem;
      font-size: 0.82rem;
      color: #8a6d3b;
    }
    .fb-alert-full {
      background: #ffebe9;
      border: 1px solid #ffc1c0;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      margin-bottom: 0.75rem;
    }

    /* ── Session Manager ── */
    .fb-sessions-panel {
      background: #f5f6f7;
      border: 1px solid #dadde1;
      border-radius: 6px;
      padding: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .fb-session-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fff;
      border: 1px solid #dadde1;
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
    }

    /* ── OTP Section ── */
    .fb-otp-sent-box {
      text-align: center;
      background: #e7f3ff;
      border: 1px solid #d0e5fc;
      border-radius: 6px;
      padding: 0.85rem 1rem;
      margin-bottom: 0.9rem;
    }
    .fb-dev-otp-box {
      background: #fff4e5;
      border: 1px solid #ffd699;
      border-radius: 6px;
      padding: 0.75rem;
      margin-bottom: 0.9rem;
    }

    /* ── Footer ── */
    .fb-footer {
      text-align: center;
      padding: 0.65rem;
      background: #f5f6f7;
      border-top: 1px solid #dadde1;
      border-radius: 0 0 8px 8px;
      font-size: 0.68rem;
      color: #8a8d91;
      margin: 0 -1rem -1.25rem;
    }

    /* ── Spin ── */
    @keyframes fb-spin { to { transform: rotate(360deg); } }
    .fb-spin { animation: fb-spin 0.8s linear infinite; display: inline-block; }

    /* ── Toggle password ── */
    .fb-pass-toggle {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #8a8d91;
      cursor: pointer;
      font-size: 0.85rem;
      padding: 0;
    }

    /* ── Quick select button ── */
    .fb-quick-btn {
      background: #e7f3ff;
      border: 1px solid #d0e5fc;
      border-radius: 6px;
      color: #1877F2;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 5px 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .fb-quick-btn:hover {
      background: #d0e5fc;
    }

    /* ── Responsive ── */
    @media (max-width: 500px) {
      .fb-card {
        padding: 1rem 0.85rem;
        max-width: 100%;
      }
      .fb-hero h1 {
        font-size: 1.35rem;
      }
    }
  `;

  const Fa = ({ icon, style }: { icon: any; style?: React.CSSProperties }) => (
    <FontAwesomeIcon icon={icon} style={style} />
  );

  return (
    <>
      <style>{styles}</style>

      <div className="fb-shell">

        {/* ── HERO ── */}
        <div className="fb-hero">
          <div className="fb-hero-logo">
            <Fa icon={faTowerBroadcast} style={{ fontSize: '1.5rem', color: '#fff' }} />
          </div>
          <h1>{lang === 'hi' ? 'सोशल वॉचटावर' : 'Social Watchtower'}</h1>
          <p>{lang === 'hi' ? 'CM वॉर रूम — बिहार सरकार • जनमत निगरानी प्रणाली' : 'CM War Room — Government of Bihar • Public Opinion Intel'}</p>
        </div>

        {/* ── MAIN CARD ── */}
        <div className="fb-card">

          {/* Session Badge */}
          <div className="fb-session-badge">
            <span className={`fb-session-dot ${isFull ? 'red' : 'green'}`} />
            <span>
              {activeCount} / {maxAllowed} {lang === 'hi' ? 'सक्रिय सत्र' : 'Active Sessions'}
            </span>
          </div>

          {/* Slot Bar */}
          <div className="fb-slot-bar">
            <span className="fb-slot-label">
              <Fa icon={faUsers} style={{ fontSize: '0.72rem' }} />
              {lang === 'hi' ? '5 स्लॉट:' : '5 Slots:'}
            </span>
            <div className="fb-slots">
              {Array.from({ length: 5 }).map((_, i) => {
                const occ = i < activeCount;
                return (
                  <div key={i} className={`fb-slot ${occ ? 'occupied' : 'free'}`} title={`Slot #${i + 1}: ${occ ? 'Occupied' : 'Free'}`}>
                    #{i + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session Full Alert */}
          {isFull && (
            <div className="fb-alert-full">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <Fa icon={faTriangleExclamation} style={{ color: '#c4302b', fontSize: '0.85rem' }} />
                <span style={{ color: '#c4302b', fontWeight: 700, fontSize: '0.85rem' }}>
                  {lang === 'hi' ? 'सत्र सीमा पूर्ण' : 'Session Limit Reached'}
                </span>
              </div>
              <p style={{ color: '#c4302b', fontSize: '0.78rem', marginBottom: 8 }}>
                {lang === 'hi' ? 'सभी 5 स्लॉट उपयोग में हैं।' : 'All 5 slots occupied.'}
              </p>
              <button onClick={() => setShowManageSlots(!showManageSlots)} style={{
                background: '#c4302b', color: '#fff', border: 'none', borderRadius: 6,
                padding: '5px 14px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Fa icon={faPowerOff} style={{ fontSize: '0.65rem' }} />
                {showManageSlots ? (lang === 'hi' ? 'छिपाएं' : 'Hide') : (lang === 'hi' ? 'स्लॉट मैनेज करें' : 'Manage Slots')}
              </button>
            </div>
          )}

          {/* Slots Manager */}
          {showManageSlots && sessionsStatus && (
            <div className="fb-sessions-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: '#1d2129', fontWeight: 700, fontSize: '0.82rem' }}>
                  {lang === 'hi' ? 'सक्रिय सत्र' : 'Active Sessions'}
                </span>
                <button onClick={loadSlots} style={{ background: 'none', border: 'none', color: '#8a8d91', cursor: 'pointer', fontSize: '0.8rem' }}>
                  <Fa icon={faRotateRight} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                {sessionsStatus.slots.filter(s => s.is_occupied).map(slot => (
                  <div key={slot.slot_number} className="fb-session-row">
                    <div>
                      <div style={{ color: '#1d2129', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#c4302b', color: '#fff', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{slot.slot_number}</span>
                        {slot.display_name}
                      </div>
                      <div style={{ color: '#8a8d91', fontSize: '0.7rem', marginTop: 2 }}>{slot.device_info} • {slot.ip_address}</div>
                    </div>
                    {slot.session_id && (
                      <button onClick={() => handleTerminateSlot(slot.session_id!)} disabled={terminatingSlotId === slot.session_id} style={{
                        background: '#ffebe9', border: '1px solid #ffc1c0', borderRadius: 6,
                        color: '#c4302b', fontSize: '0.7rem', fontWeight: 700, padding: '4px 12px', cursor: 'pointer',
                      }}>
                        {terminatingSlotId === slot.session_id ? '...' : (lang === 'hi' ? 'खाली करें' : 'End')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {errorMsg && !isFull && (
            <div className="fb-alert-error">
              <Fa icon={faShieldHalved} style={{ color: '#c4302b' }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="fb-tabs">
            {([
              { mode: 'password' as const, icon: faKey, label: lang === 'hi' ? 'पासवर्ड' : 'Password' },
              { mode: 'otp' as const, icon: faPaperPlane, label: 'Telegram OTP' },
            ]).map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => { setLoginMode(mode); setErrorMsg(null); }}
                className={`fb-tab ${loginMode === mode ? 'fb-tab-active' : 'fb-tab-inactive'}`}
              >
                <Fa icon={icon} style={{ fontSize: '0.78rem' }} /> {label}
              </button>
            ))}
          </div>

          {/* ── PASSWORD FORM ── */}
          {loginMode === 'password' && (
            <form onSubmit={handleLogin}>
              <div className="fb-input-group">
                <span className="fb-input-icon"><Fa icon={faUser} /></span>
                <input
                  type="text" required value={username} onChange={e => setUsername(e.target.value)}
                  placeholder={lang === 'hi' ? 'यूज़र आईडी दर्ज करें' : 'Username'}
                  className="fb-input"
                />
              </div>

              <div className="fb-input-group">
                <span className="fb-input-icon"><Fa icon={faLock} /></span>
                <input
                  type={showPassword ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={lang === 'hi' ? 'पासवर्ड दर्ज करें' : 'Password'}
                  className="fb-input"
                  style={{ paddingRight: '2.8rem' }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="fb-pass-toggle">
                  <Fa icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>

              <button type="submit" disabled={loading || (isFull && !showManageSlots)} className="fb-btn-primary">
                {loading
                  ? <span className="fb-spin"><Fa icon={faCircleNotch} /></span>
                  : <><Fa icon={faRightToBracket} />{lang === 'hi' ? 'लॉग इन करें' : 'Log In'}</>
                }
              </button>

              {/* Telegram hint */}
              <div className="fb-alert-info" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                <Fa icon={faTelegram} style={{ fontSize: '1rem', color: '#1877F2' }} />
                {lang === 'hi' ? 'पासवर्ड के बाद Telegram OTP आएगा।' : 'A Telegram OTP follows password verification.'}
              </div>

            </form>
          )}

          {/* ── OTP FORM ── */}
          {loginMode === 'otp' && (
            <div>
              {!otpSent ? (
                <form onSubmit={handleSendOtp}>
                  <div className="fb-input-group">
                    <span className="fb-input-icon"><Fa icon={faMobileScreen} /></span>
                    <input
                      type="text" required value={otpIdentifier}
                      onChange={e => setOtpIdentifier(e.target.value)}
                      placeholder={lang === 'hi' ? 'नंबर या admin' : 'Phone number or admin'}
                      className="fb-input"
                    />
                  </div>

                  <div className="fb-alert-info">
                    <Fa icon={faTelegram} style={{ fontSize: '1rem', color: '#1877F2' }} />
                    {lang === 'hi' ? 'OTP आपके Telegram bot पर आएगा।' : 'OTP will be sent to your Telegram bot.'}
                  </div>

                  <button type="submit" disabled={otpLoading || (isFull && !showManageSlots)} className="fb-btn-primary">
                    {otpLoading
                      ? <span className="fb-spin"><Fa icon={faCircleNotch} /></span>
                      : <><Fa icon={faTelegram} />{lang === 'hi' ? 'OTP भेजें' : 'Send OTP'}</>
                    }
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
                    <button type="button" onClick={() => { setOtpSent(false); setOtpCode(''); setDevOtp(null); setGatewayNotice(null); }}
                      style={{ background: 'none', border: 'none', color: '#8a8d91', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Fa icon={faArrowLeft} style={{ fontSize: '0.72rem' }} />
                      {lang === 'hi' ? 'बदलें' : 'Change'}
                    </button>
                    <span style={{ color: '#42b72a', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Fa icon={faCircleCheck} />
                      {lang === 'hi' ? 'OTP भेजा गया' : 'OTP Sent'}
                    </span>
                  </div>

                  {maskedPhone && (
                    <div className="fb-otp-sent-box">
                      <div style={{ color: '#1877F2', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                        <Fa icon={faTelegram} /> {lang === 'hi' ? 'Telegram OTP भेजा' : 'OTP Sent via Telegram'}
                      </div>
                      <div style={{ color: '#1d2129', fontWeight: 800, fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '0.1em' }}>{maskedPhone}</div>
                      <p style={{ color: '#8a8d91', fontSize: '0.72rem', marginTop: 4, marginBottom: 0 }}>
                        {lang === 'hi' ? 'Telegram ऐप खोलें और कोड दर्ज करें।' : 'Open Telegram and enter the code below.'}
                      </p>
                    </div>
                  )}

                  {devOtp && (
                    <div className="fb-dev-otp-box">
                      {gatewayNotice && <p style={{ color: '#8a6d3b', fontSize: '0.72rem', marginBottom: 8 }}>⚠️ {gatewayNotice}</p>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 6, padding: '0.5rem 0.75rem', border: '1px solid #ffd699' }}>
                        <div>
                          <div style={{ color: '#8a8d91', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700 }}>Dev OTP</div>
                          <div style={{ color: '#c4302b', fontWeight: 900, fontFamily: 'monospace', fontSize: '1.4rem', letterSpacing: '0.25em' }}>{devOtp}</div>
                        </div>
                        <button type="button" onClick={() => setOtpCode(devOtp)} style={{
                          background: '#1877F2', color: '#fff', border: 'none', borderRadius: 6,
                          padding: '6px 16px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <Fa icon={faWandMagicSparkles} style={{ fontSize: '0.72rem' }} /> Autofill
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="fb-input-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', color: '#606770', fontSize: '0.75rem', fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>
                      {lang === 'hi' ? '6-अंकों का OTP' : '6-Digit OTP Code'}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span className="fb-input-icon"><Fa icon={faKey} /></span>
                      <input
                        type="text" maxLength={6} required value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="• • • • • •" className="fb-input" autoFocus
                        style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '1.25rem', letterSpacing: '0.4em', fontWeight: 900 }}
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading || otpCode.length < 4 || (isFull && !showManageSlots)} className="fb-btn-green" style={{ marginBottom: '0.75rem' }}>
                    {loading
                      ? <span className="fb-spin"><Fa icon={faCircleNotch} /></span>
                      : <><Fa icon={faCircleCheck} />{lang === 'hi' ? 'सत्यापित करें' : 'Verify & Enter'}</>
                    }
                  </button>

                  <div style={{ textAlign: 'center' }}>
                    {otpCountdown > 0 ? (
                      <span style={{ color: '#8a8d91', fontSize: '0.78rem' }}>
                        {lang === 'hi' ? `पुनः भेजें (${otpCountdown}s)` : `Resend in ${otpCountdown}s`}
                      </span>
                    ) : (
                      <button type="button" onClick={handleSendOtp} disabled={otpLoading} style={{
                        background: 'none', border: 'none', color: '#1877F2',
                        fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline',
                      }}>
                        {lang === 'hi' ? 'पुनः OTP भेजें' : 'Resend OTP'}
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Guest bypass */}
          {onBypassPreview && (
            <>
              <div className="fb-divider">
                <div className="fb-divider-line" />
                <span className="fb-divider-text">{lang === 'hi' ? 'या' : 'or'}</span>
                <div className="fb-divider-line" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <button type="button" onClick={onBypassPreview} className="fb-btn-green" style={{ fontSize: '0.9rem', padding: '0.65rem 1rem' }}>
                  <Fa icon={faEye} style={{ fontSize: '0.78rem' }} />
                  {lang === 'hi' ? 'डेमो मोड में देखें' : 'Preview as Guest'}
                </button>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="fb-footer">
            Bihar Government • Max 5 Concurrent Sessions
          </div>
        </div>
      </div>
    </>
  );
};
