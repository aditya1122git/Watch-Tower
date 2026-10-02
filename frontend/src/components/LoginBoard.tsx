import React, { useState, useEffect } from 'react';
import { Language } from '../i18n';
import { loginUser, sendLoginOtp, verifyLoginOtp } from '../api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTowerBroadcast, faKey, faPaperPlane, faUser, faLock,
  faEye, faEyeSlash, faShieldHalved, faArrowLeft, faCircleCheck,
  faMobileScreen, faCircleNotch, faRightToBracket,
  faEye as faEyeIcon
} from '@fortawesome/free-solid-svg-icons';
import { faTelegram } from '@fortawesome/free-brands-svg-icons';

interface LoginBoardProps {
  lang: Language;
  onLoginSuccess: (userData: any) => void;
}

export const LoginBoard: React.FC<LoginBoardProps> = ({ lang, onLoginSuccess }) => {
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [otpIdentifier, setOtpIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [gatewayNotice, setGatewayNotice] = useState<string | null>(null);

  useEffect(() => {
    if (otpCountdown > 0) {
      const t = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpCountdown]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg(lang === 'hi' ? 'कृपया यूज़र आईडी और पासवर्ड दर्ज करें' : 'Please enter username and password');
      return;
    }
    setErrorMsg(null); setLoading(true);
    try {
      const userData = await loginUser(username.trim(), password);
      onLoginSuccess(userData);
    } catch (err: any) {
      setErrorMsg(err.message || (lang === 'hi' ? 'लॉगिन विफल' : 'Login failed'));
    } finally { setLoading(false); }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = otpIdentifier.trim();
    if (!cleanId) { setErrorMsg(lang === 'hi' ? 'मोबाइल नंबर या यूज़र आईडी दर्ज करें' : 'Enter phone number or username'); return; }
    try {
      setOtpLoading(true); setErrorMsg(null);
      const res = await sendLoginOtp(cleanId);
      setOtpSent(true); setMaskedPhone(res.masked_phone);
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
    } finally { setLoading(false); }
  };

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

    /* ── Hero Title Area (Inside Card) ── */
    .fb-hero {
      text-align: center;
      margin-bottom: 1.75rem;
    }
    .fb-hero-logo {
      width: 62px;
      height: 62px;
      border-radius: 16px;
      background: linear-gradient(135deg, #1877F2 0%, #0d62d1 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 0.85rem;
      box-shadow: 0 8px 24px rgba(24, 119, 242, 0.32);
    }
    .fb-hero h1 {
      color: #1877F2;
      font-size: 1.85rem;
      font-weight: 700;
      margin: 0 0 0.35rem;
      letter-spacing: -0.02em;
    }
    .fb-hero p {
      color: #606770;
      font-size: 0.88rem;
      margin: 0;
      line-height: 1.45;
    }

    /* ── Main Card ── */
    .fb-card {
      width: 100%;
      max-width: 480px;
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 20px 40px -8px rgba(0, 0, 0, 0.12);
      padding: 2.5rem 2.25rem 2.25rem;
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
    @media (max-width: 520px) {
      .fb-card {
        padding: 1.75rem 1.25rem;
        max-width: 100%;
      }
      .fb-hero h1 {
        font-size: 1.5rem;
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

        {/* ── MAIN CARD ── */}
        <div className="fb-card">

          {/* ── HERO / LOGO INSIDE CARD ── */}
          <div className="fb-hero">
            <div className="fb-hero-logo">
              <Fa icon={faTowerBroadcast} style={{ fontSize: '1.6rem', color: '#fff' }} />
            </div>
            <h1>{lang === 'hi' ? 'सोशल वॉचटावर' : 'Social Watchtower'}</h1>
            <p>{lang === 'hi' ? 'CM वॉर रूम — बिहार सरकार • जनमत निगरानी प्रणाली' : 'CM War Room — Government of Bihar • Public Opinion Intel'}</p>
          </div>

          {/* Error */}
          {errorMsg && (
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
            <form onSubmit={handleLogin} autoComplete="off">
              <div className="fb-input-group">
                <span className="fb-input-icon"><Fa icon={faUser} /></span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={lang === 'hi' ? 'यूज़र आईडी दर्ज करें' : 'Username'}
                  className="fb-input"
                  autoComplete="off"
                  name="custom_user_id"
                />
              </div>

              <div className="fb-input-group">
                <span className="fb-input-icon"><Fa icon={faLock} /></span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={lang === 'hi' ? 'पासवर्ड दर्ज करें' : 'Password'}
                  className="fb-input"
                  style={{ paddingRight: '2.8rem' }}
                  autoComplete="off"
                  name="custom_user_secret"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="fb-pass-toggle">
                  <Fa icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>

              <button type="submit" disabled={loading} className="fb-btn-primary">
                {loading
                  ? <span className="fb-spin"><Fa icon={faCircleNotch} /></span>
                  : <><Fa icon={faRightToBracket} />{lang === 'hi' ? 'लॉग इन करें' : 'Log In'}</>
                }
              </button>
            </form>
          )}

          {/* ── OTP FORM ── */}
          {loginMode === 'otp' && (
            <div>
              {!otpSent ? (
                <form onSubmit={handleSendOtp} autoComplete="off">
                  <div className="fb-input-group">
                    <span className="fb-input-icon"><Fa icon={faMobileScreen} /></span>
                    <input
                      type="text"
                      required
                      value={otpIdentifier}
                      onChange={e => setOtpIdentifier(e.target.value)}
                      placeholder={lang === 'hi' ? 'मोबाइल नंबर या यूज़र आईडी' : 'Phone number or username'}
                      className="fb-input"
                      autoComplete="off"
                      name="custom_otp_id"
                    />
                  </div>

                  <div className="fb-alert-info">
                    <Fa icon={faTelegram} style={{ fontSize: '1rem', color: '#1877F2' }} />
                    {lang === 'hi' ? 'OTP आपके Telegram bot पर आएगा।' : 'OTP will be sent to your Telegram bot.'}
                  </div>

                  <button type="submit" disabled={otpLoading} className="fb-btn-primary">
                    {otpLoading
                      ? <span className="fb-spin"><Fa icon={faCircleNotch} /></span>
                      : <><Fa icon={faTelegram} />{lang === 'hi' ? 'OTP भेजें' : 'Send OTP'}</>
                    }
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
                    <button type="button" onClick={() => { setOtpSent(false); setOtpCode(''); setGatewayNotice(null); }}
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

                  <button type="submit" disabled={loading || otpCode.length < 4} className="fb-btn-green" style={{ marginBottom: '0.75rem' }}>
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



        </div>
      </div>
    </>
  );
};
