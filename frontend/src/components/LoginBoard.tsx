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

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '1.5px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    color: '#f1f5f9',
    fontFamily: "'Poppins', sans-serif",
    fontSize: '0.875rem',
    padding: '0.65rem 1rem 0.65rem 2.5rem',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.18s, box-shadow 0.18s',
  };

  const styles = `
    .wt-input:focus {
      border-color: #e5484d !important;
      box-shadow: 0 0 0 3px rgba(229,72,77,0.18) !important;
      background: rgba(255,255,255,0.1) !important;
    }
    .wt-input::placeholder { color: rgba(255,255,255,0.25); }
    .wt-icon-wrap { position:absolute; left:13px; top:50%; transform:translateY(-50%); color:rgba(255,255,255,0.32); pointer-events:none; font-size:0.78rem; }
    .wt-btn {
      border:none; border-radius:12px; color:#fff;
      font-family:'Poppins',sans-serif; font-weight:700; font-size:0.875rem;
      padding:0.72rem 1.5rem; width:100%; cursor:pointer;
      transition:transform 0.15s, box-shadow 0.15s, opacity 0.15s;
      display:flex; align-items:center; justify-content:center; gap:8px;
    }
    .wt-btn-red { background:linear-gradient(135deg,#e5484d,#b91c1c); box-shadow:0 4px 20px rgba(229,72,77,0.35); }
    .wt-btn-red:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 28px rgba(229,72,77,0.5); }
    .wt-btn-green { background:linear-gradient(135deg,#16a34a,#15803d); box-shadow:0 4px 20px rgba(22,163,74,0.35); }
    .wt-btn-green:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 28px rgba(22,163,74,0.5); }
    .wt-btn:disabled { opacity:0.5; cursor:not-allowed; }
    .wt-tab {
      flex:1; padding:0.48rem; border-radius:10px; border:none; cursor:pointer;
      font-family:'Poppins',sans-serif; font-weight:600; font-size:0.78rem;
      display:flex; align-items:center; justify-content:center; gap:7px;
      transition:all 0.18s;
    }
    .wt-tab-on  { background:rgba(255,255,255,0.13); color:#fff; }
    .wt-tab-off { background:transparent; color:rgba(255,255,255,0.38); }
    .wt-tab-off:hover { color:rgba(255,255,255,0.65); }
    @keyframes wt-spin { to { transform:rotate(360deg); } }
    .wt-spin { animation:wt-spin 0.8s linear infinite; display:inline-block; }
    @keyframes wt-rise { from { opacity:0; transform:translateY(22px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
    .wt-card { animation:wt-rise 0.42s cubic-bezier(0.22,1,0.36,1) both; }
    .wt-slot { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:900; transition:all 0.2s; }
  `;

  const Fa = ({ icon, style }: { icon: any; style?: React.CSSProperties }) => (
    <FontAwesomeIcon icon={icon} style={style} />
  );

  const btnGold: React.CSSProperties = {
    background: 'rgba(251,191,36,0.14)',
    border: '1px solid rgba(251,191,36,0.4)',
    borderRadius: 9, color: '#fbbf24', fontSize: '0.72rem', fontWeight: 700,
    padding: '5px 14px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
  };

  return (
    <>
      <style>{styles}</style>

      {/* SHELL */}
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, #060c1b 0%, #110828 50%, #09101e 100%)',
        fontFamily: "'Poppins', 'Noto Sans Devanagari', sans-serif",
      }}>
        {/* decorative orbs */}
        <div style={{ position:'fixed', top:'-8rem', left:'-8rem', width:'28rem', height:'28rem', borderRadius:'50%', background:'radial-gradient(circle,rgba(23,105,224,0.13),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'fixed', bottom:'-6rem', right:'-6rem', width:'22rem', height:'22rem', borderRadius:'50%', background:'radial-gradient(circle,rgba(229,72,77,0.11),transparent 70%)', pointerEvents:'none' }} />

        {/* CARD */}
        <div className="wt-card" style={{
          width:'100%', maxWidth:420,
          background:'rgba(11,18,36,0.97)',
          borderRadius:24, border:'1px solid rgba(255,255,255,0.09)',
          boxShadow:'0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05) inset',
          overflow:'hidden', position:'relative', zIndex:10,
        }}>

          {/* HERO */}
          <div style={{
            background:'linear-gradient(120deg,#8b0e3a,#2a2682)',
            padding:'2rem 1.75rem 1.75rem', textAlign:'center', position:'relative', overflow:'hidden',
          }}>
            {/* grid texture */}
            <div style={{ position:'absolute', inset:0, opacity:0.07, pointerEvents:'none',
              backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 18px,rgba(255,255,255,1) 18px,rgba(255,255,255,1) 19px),repeating-linear-gradient(90deg,transparent,transparent 18px,rgba(255,255,255,1) 18px,rgba(255,255,255,1) 19px)',
            }} />
            {/* icon badge */}
            <div style={{
              width:56, height:56, borderRadius:16, margin:'0 auto 1rem',
              background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.22)',
              display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)',
            }}>
              <Fa icon={faTowerBroadcast} style={{ fontSize:'1.5rem', color:'#fbbf24' }} />
            </div>
            <h1 style={{ color:'#fff', fontWeight:800, fontSize:'1.15rem', marginBottom:'0.3rem', letterSpacing:'-0.01em' }}>
              {lang === 'hi' ? 'CM वॉर रूम — सोशल वॉचटावर' : 'Social Watchtower — CM War Room'}
            </h1>
            <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.72rem', marginBottom:'1rem' }}>
              {lang === 'hi' ? 'बिहार सरकार • जनमत निगरानी प्रणाली' : 'Government of Bihar • Public Opinion Intel'}
            </p>
            {/* session badge */}
            <span style={{
              display:'inline-flex', alignItems:'center', gap:8,
              background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.18)',
              borderRadius:999, padding:'6px 16px', fontSize:'0.72rem', color:'#fff',
            }}>
              <span style={{
                width:8, height:8, borderRadius:'50%',
                background: isFull ? '#f87171' : '#4ade80',
                boxShadow:`0 0 6px 2px ${isFull ? 'rgba(248,113,113,0.5)' : 'rgba(74,222,128,0.5)'}`,
                display:'inline-block', flexShrink:0,
              }} />
              <span style={{ fontWeight:600 }}>
                {activeCount} / {maxAllowed} {lang === 'hi' ? 'सक्रिय सत्र' : 'Active Sessions'}
              </span>
            </span>
          </div>

          {/* SLOT BAR */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0.55rem 1.5rem',
            background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.07)',
            fontSize:'0.7rem',
          }}>
            <span style={{ color:'rgba(255,255,255,0.32)', display:'flex', alignItems:'center', gap:6 }}>
              <Fa icon={faUsers} style={{ fontSize:'0.68rem' }} />
              {lang === 'hi' ? '5 स्लॉट:' : '5 Slots:'}
            </span>
            <div style={{ display:'flex', gap:5 }}>
              {Array.from({ length:5 }).map((_,i) => {
                const occ = i < activeCount;
                return (
                  <div key={i} className="wt-slot" title={`Slot #${i+1}: ${occ?'Occupied':'Free'}`} style={{
                    background: occ ? 'rgba(229,72,77,0.85)' : 'rgba(74,222,128,0.1)',
                    color: occ ? '#fff' : '#4ade80',
                    border:`1.5px solid ${occ?'rgba(229,72,77,0.6)':'rgba(74,222,128,0.3)'}`,
                  }}>#{i+1}</div>
                );
              })}
            </div>
          </div>

          {/* FORM BODY */}
          <div style={{ padding:'1.5rem 1.75rem' }}>

            {/* Session Full */}
            {isFull && (
              <div style={{ background:'rgba(220,53,69,0.1)', border:'1px solid rgba(220,53,69,0.3)', borderRadius:12, padding:'0.75rem 1rem', marginBottom:'1rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                  <Fa icon={faTriangleExclamation} style={{ color:'#f87171', fontSize:'0.85rem' }} />
                  <span style={{ color:'#f87171', fontWeight:700, fontSize:'0.8rem' }}>
                    {lang === 'hi' ? 'सत्र सीमा पूर्ण' : 'Session Limit Reached'}
                  </span>
                </div>
                <p style={{ color:'rgba(248,113,113,0.8)', fontSize:'0.72rem', marginBottom:8 }}>
                  {lang === 'hi' ? 'सभी 5 स्लॉट उपयोग में हैं।' : 'All 5 slots occupied.'}
                </p>
                <button onClick={() => setShowManageSlots(!showManageSlots)} style={{
                  background:'#dc3545', color:'#fff', border:'none', borderRadius:8,
                  padding:'4px 14px', fontSize:'0.72rem', fontWeight:700, cursor:'pointer',
                  display:'inline-flex', alignItems:'center', gap:6,
                }}>
                  <Fa icon={faPowerOff} style={{ fontSize:'0.65rem' }} />
                  {showManageSlots ? (lang === 'hi' ? 'छिपाएं' : 'Hide') : (lang === 'hi' ? 'स्लॉट मैनेज करें' : 'Manage Slots')}
                </button>
              </div>
            )}

            {/* Slots Manager */}
            {showManageSlots && sessionsStatus && (
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'0.75rem', marginBottom:'1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <span style={{ color:'#e2e8f0', fontWeight:700, fontSize:'0.78rem' }}>
                    {lang === 'hi' ? 'सक्रिय सत्र' : 'Active Sessions'}
                  </span>
                  <button onClick={loadSlots} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'0.75rem' }}>
                    <Fa icon={faRotateRight} />
                  </button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:160, overflowY:'auto' }}>
                  {sessionsStatus.slots.filter(s => s.is_occupied).map(slot => (
                    <div key={slot.slot_number} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'0.5rem 0.75rem' }}>
                      <div>
                        <div style={{ color:'#f1f5f9', fontWeight:700, fontSize:'0.78rem', display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ width:18, height:18, borderRadius:'50%', background:'#dc3545', color:'#fff', fontSize:'0.6rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900 }}>{slot.slot_number}</span>
                          {slot.display_name}
                        </div>
                        <div style={{ color:'rgba(255,255,255,0.32)', fontSize:'0.65rem', marginTop:2 }}>{slot.device_info} • {slot.ip_address}</div>
                      </div>
                      {slot.session_id && (
                        <button onClick={() => handleTerminateSlot(slot.session_id!)} disabled={terminatingSlotId === slot.session_id} style={{ background:'rgba(220,53,69,0.15)', border:'1px solid rgba(220,53,69,0.4)', borderRadius:8, color:'#f87171', fontSize:'0.65rem', fontWeight:700, padding:'3px 10px', cursor:'pointer' }}>
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
              <div style={{ background:'rgba(220,53,69,0.1)', border:'1px solid rgba(220,53,69,0.3)', borderRadius:12, padding:'0.65rem 1rem', marginBottom:'1rem', display:'flex', alignItems:'center', gap:10, fontSize:'0.78rem' }}>
                <Fa icon={faShieldHalved} style={{ color:'#f87171' }} />
                <span style={{ color:'#f87171' }}>{errorMsg}</span>
              </div>
            )}

            {/* Mode Tabs */}
            <div style={{ display:'flex', gap:4, padding:4, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, marginBottom:'1.25rem' }}>
              {([
                { mode:'password' as const, icon:faKey,        label: lang==='hi' ? 'पासवर्ड' : 'Password' },
                { mode:'otp'      as const, icon:faPaperPlane, label: 'Telegram OTP' },
              ]).map(({ mode, icon, label }) => (
                <button key={mode} onClick={() => { setLoginMode(mode); setErrorMsg(null); }} className={`wt-tab ${loginMode===mode?'wt-tab-on':'wt-tab-off'}`}>
                  <Fa icon={icon} style={{ fontSize:'0.75rem' }} /> {label}
                </button>
              ))}
            </div>

            {/* ── PASSWORD FORM ── */}
            {loginMode === 'password' && (
              <form onSubmit={handleLogin}>

                <div style={{ marginBottom:'1rem' }}>
                  <label style={{ display:'block', color:'rgba(255,255,255,0.4)', fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>
                    {lang === 'hi' ? 'यूज़रनेम' : 'Username'}
                  </label>
                  <div style={{ position:'relative' }}>
                    <span className="wt-icon-wrap"><Fa icon={faUser} /></span>
                    <input type="text" required value={username} onChange={e => setUsername(e.target.value)}
                      placeholder={lang==='hi' ? 'यूज़र आईडी' : 'Enter username'}
                      className="wt-input" style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom:'1rem' }}>
                  <label style={{ display:'block', color:'rgba(255,255,255,0.4)', fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>
                    {lang === 'hi' ? 'पासवर्ड' : 'Password'}
                  </label>
                  <div style={{ position:'relative' }}>
                    <span className="wt-icon-wrap"><Fa icon={faLock} /></span>
                    <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••••••" className="wt-input"
                      style={{ ...inputStyle, paddingRight:'2.8rem' }} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'rgba(255,255,255,0.32)', cursor:'pointer', fontSize:'0.78rem', padding:0 }}>
                      <Fa icon={showPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>

                {/* Telegram hint */}
                <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(14,165,233,0.07)', border:'1px solid rgba(14,165,233,0.18)', borderRadius:10, padding:'0.55rem 0.9rem', marginBottom:'1.25rem', fontSize:'0.72rem', color:'rgba(125,211,252,0.8)' }}>
                  <Fa icon={faTelegram} style={{ fontSize:'0.95rem', color:'#38bdf8' }} />
                  {lang === 'hi' ? 'पासवर्ड के बाद Telegram OTP आएगा।' : 'A Telegram OTP follows password verification.'}
                </div>

                <button type="submit" disabled={loading || (isFull && !showManageSlots)} className="wt-btn wt-btn-red">
                  {loading
                    ? <span className="wt-spin"><Fa icon={faCircleNotch} /></span>
                    : <><Fa icon={faRightToBracket} />{lang === 'hi' ? 'साइन इन करें' : 'Sign In'}</>
                  }
                </button>

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'1rem', paddingTop:'0.9rem', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ color:'rgba(255,255,255,0.28)', fontSize:'0.68rem', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                    {lang === 'hi' ? 'मुख्य एडमिन:' : 'Primary Admin:'}
                  </span>
                  <button type="button" onClick={() => { setUsername('admin'); setPassword('Bihar2026@CM'); setErrorMsg(null); }} style={{ ...btnGold, background: username==='admin' ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.1)', borderColor: username==='admin' ? 'rgba(251,191,36,0.6)' : 'rgba(251,191,36,0.25)' }}>
                    <Fa icon={faCrown} style={{ fontSize:'0.7rem' }} /> Admin Fill
                  </button>
                </div>
              </form>
            )}

            {/* ── OTP FORM ── */}
            {loginMode === 'otp' && (
              <div>
                {!otpSent ? (
                  <form onSubmit={handleSendOtp}>
                    <div style={{ marginBottom:'1rem' }}>
                      <label style={{ display:'block', color:'rgba(255,255,255,0.4)', fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>
                        {lang === 'hi' ? 'मोबाइल / यूज़रनेम' : 'Mobile / Username'}
                      </label>
                      <div style={{ position:'relative' }}>
                        <span className="wt-icon-wrap"><Fa icon={faMobileScreen} /></span>
                        <input type="text" required value={otpIdentifier} onChange={e => setOtpIdentifier(e.target.value)}
                          placeholder={lang==='hi' ? 'नंबर या admin' : 'Phone number or admin'}
                          className="wt-input" style={inputStyle} />
                      </div>
                    </div>

                    <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(14,165,233,0.07)', border:'1px solid rgba(14,165,233,0.18)', borderRadius:10, padding:'0.55rem 0.9rem', marginBottom:'1rem', fontSize:'0.72rem', color:'rgba(125,211,252,0.8)' }}>
                      <Fa icon={faTelegram} style={{ fontSize:'0.95rem', color:'#38bdf8' }} />
                      {lang === 'hi' ? 'OTP आपके Telegram bot पर आएगा।' : 'OTP will be sent to your Telegram bot.'}
                    </div>

                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
                      <span style={{ color:'rgba(255,255,255,0.28)', fontSize:'0.68rem' }}>{lang==='hi' ? 'त्वरित चयन:' : 'Quick select:'}</span>
                      <button type="button" onClick={() => setOtpIdentifier('admin')} style={{ ...btnGold, background: otpIdentifier==='admin' ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.1)', borderColor: otpIdentifier==='admin' ? 'rgba(251,191,36,0.6)' : 'rgba(251,191,36,0.25)' }}>
                        <Fa icon={faCrown} style={{ fontSize:'0.7rem' }} /> Admin
                      </button>
                    </div>

                    <button type="submit" disabled={otpLoading || (isFull && !showManageSlots)} className="wt-btn wt-btn-red">
                      {otpLoading
                        ? <span className="wt-spin"><Fa icon={faCircleNotch} /></span>
                        : <><Fa icon={faTelegram} />{lang === 'hi' ? 'OTP भेजें' : 'Send OTP'}</>
                      }
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.9rem' }}>
                      <button type="button" onClick={() => { setOtpSent(false); setOtpCode(''); setDevOtp(null); setGatewayNotice(null); }} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.38)', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
                        <Fa icon={faArrowLeft} style={{ fontSize:'0.7rem' }} />
                        {lang === 'hi' ? 'बदलें' : 'Change'}
                      </button>
                      <span style={{ color:'#4ade80', fontWeight:700, fontSize:'0.75rem', display:'flex', alignItems:'center', gap:5 }}>
                        <Fa icon={faCircleCheck} />
                        {lang === 'hi' ? 'OTP भेजा गया' : 'OTP Sent'}
                      </span>
                    </div>

                    {maskedPhone && (
                      <div style={{ textAlign:'center', background:'rgba(14,165,233,0.07)', border:'1px solid rgba(14,165,233,0.18)', borderRadius:12, padding:'0.85rem 1rem', marginBottom:'0.9rem' }}>
                        <div style={{ color:'#38bdf8', fontWeight:700, fontSize:'0.78rem', display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:4 }}>
                          <Fa icon={faTelegram} /> {lang==='hi' ? 'Telegram OTP भेजा' : 'OTP Sent via Telegram'}
                        </div>
                        <div style={{ color:'#f1f5f9', fontWeight:800, fontFamily:'monospace', fontSize:'1rem', letterSpacing:'0.1em' }}>{maskedPhone}</div>
                        <p style={{ color:'rgba(255,255,255,0.38)', fontSize:'0.68rem', marginTop:4, marginBottom:0 }}>
                          {lang==='hi' ? 'Telegram ऐप खोलें और कोड दर्ज करें।' : 'Open Telegram and enter the code below.'}
                        </p>
                      </div>
                    )}

                    {devOtp && (
                      <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:12, padding:'0.75rem', marginBottom:'0.9rem' }}>
                        {gatewayNotice && <p style={{ color:'rgba(252,211,77,0.8)', fontSize:'0.68rem', marginBottom:8 }}>⚠️ {gatewayNotice}</p>}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.05)', borderRadius:10, padding:'0.5rem 0.75rem' }}>
                          <div>
                            <div style={{ color:'rgba(255,255,255,0.32)', fontSize:'0.62rem', textTransform:'uppercase', fontWeight:700 }}>Dev OTP</div>
                            <div style={{ color:'#f87171', fontWeight:900, fontFamily:'monospace', fontSize:'1.4rem', letterSpacing:'0.25em' }}>{devOtp}</div>
                          </div>
                          <button type="button" onClick={() => setOtpCode(devOtp)} style={{ background:'#d97706', color:'#fff', border:'none', borderRadius:8, padding:'5px 14px', fontSize:'0.72rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                            <Fa icon={faWandMagicSparkles} style={{ fontSize:'0.7rem' }} /> Autofill
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom:'1.25rem' }}>
                      <label style={{ display:'block', color:'rgba(255,255,255,0.4)', fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6, textAlign:'center' }}>
                        {lang === 'hi' ? '6-अंकों का OTP' : '6-Digit OTP Code'}
                      </label>
                      <div style={{ position:'relative' }}>
                        <span className="wt-icon-wrap"><Fa icon={faKey} /></span>
                        <input type="text" maxLength={6} required value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g,''))}
                          placeholder="• • • • • •" className="wt-input" autoFocus
                          style={{ ...inputStyle, textAlign:'center', fontFamily:'monospace', fontSize:'1.25rem', letterSpacing:'0.4em', fontWeight:900 }} />
                      </div>
                    </div>

                    <button type="submit" disabled={loading || otpCode.length < 4 || (isFull && !showManageSlots)} className="wt-btn wt-btn-green" style={{ marginBottom:'0.75rem' }}>
                      {loading
                        ? <span className="wt-spin"><Fa icon={faCircleNotch} /></span>
                        : <><Fa icon={faCircleCheck} />{lang === 'hi' ? 'सत्यापित करें' : 'Verify & Enter'}</>
                      }
                    </button>

                    <div style={{ textAlign:'center' }}>
                      {otpCountdown > 0 ? (
                        <span style={{ color:'rgba(255,255,255,0.28)', fontSize:'0.72rem' }}>
                          {lang==='hi' ? `पुनः भेजें (${otpCountdown}s)` : `Resend in ${otpCountdown}s`}
                        </span>
                      ) : (
                        <button type="button" onClick={handleSendOtp} disabled={otpLoading} style={{ background:'none', border:'none', color:'#f87171', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', textDecoration:'underline' }}>
                          {lang==='hi' ? 'पुनः OTP भेजें' : 'Resend OTP'}
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Guest bypass */}
            {onBypassPreview && (
              <div style={{ textAlign:'center', marginTop:'1rem', paddingTop:'0.9rem', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                <button type="button" onClick={onBypassPreview} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.28)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
                  <Fa icon={faEye} style={{ fontSize:'0.7rem' }} />
                  {lang === 'hi' ? 'डेमो मोड में देखें' : 'Preview as Guest'}
                </button>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div style={{ textAlign:'center', padding:'0.65rem', background:'rgba(0,0,0,0.25)', borderTop:'1px solid rgba(255,255,255,0.06)', fontSize:'0.62rem', color:'rgba(255,255,255,0.2)' }}>
            Bihar Government • Max 5 Concurrent Sessions
          </div>
        </div>
      </div>
    </>
  );
};
