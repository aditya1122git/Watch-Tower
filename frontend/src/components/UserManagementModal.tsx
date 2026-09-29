import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  User,
  Users,
  Phone,
  ShieldCheck,
  Edit2,
  Trash2,
  Plus,
  Check,
  AlertCircle,
  Lock,
  Smartphone,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  SystemUser,
  fetchUsersList,
  adminChangeUserPassword,
  adminUpdateUser,
  adminCreateUser,
  adminDeleteUser,
  linkUserPhone,
  changeMyPassword
} from '../api';
import { Language } from '../i18n';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  lang: Language;
  onUserUpdated?: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  lang,
  onUserUpdated
}) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'users' | 'phone' | 'self_password'>('users');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Password change modal state
  const [targetUserForPassword, setTargetUserForPassword] = useState<SystemUser | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [forceLogout, setForceLogout] = useState<boolean>(true);
  const [savingPassword, setSavingPassword] = useState<boolean>(false);

  // Edit user modal state
  const [targetUserForEdit, setTargetUserForEdit] = useState<SystemUser | null>(null);
  const [editUsername, setEditUsername] = useState<string>('');
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editRole, setEditRole] = useState<string>('operator');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Create new user state
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);
  const [createUsername, setCreateUsername] = useState<string>('');
  const [createPassword, setCreatePassword] = useState<string>('');
  const [createDisplayName, setCreateDisplayName] = useState<string>('');
  const [createPhone, setCreatePhone] = useState<string>('');
  const [createRole, setCreateRole] = useState<string>('operator');
  const [savingCreate, setSavingCreate] = useState<boolean>(false);

  // Admin link phone state
  const [adminPhoneInput, setAdminPhoneInput] = useState<string>('');
  const [savingPhone, setSavingPhone] = useState<boolean>(false);

  // Self change password state
  const [oldSelfPassword, setOldSelfPassword] = useState<string>('');
  const [newSelfPassword, setNewSelfPassword] = useState<string>('');
  const [confirmSelfPassword, setConfirmSelfPassword] = useState<string>('');
  const [savingSelfPassword, setSavingSelfPassword] = useState<boolean>(false);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      if (currentUser?.phone_number) {
        setAdminPhoneInput(currentUser.phone_number);
      }
    }
  }, [isOpen, currentUser]);

  const loadUsers = async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      const data = await fetchUsersList();
      setUsers(data);
      // Update admin phone in input if found in list
      const me = data.find(u => u.username === currentUser?.username);
      if (me?.phone_number) {
        setAdminPhoneInput(me.phone_number);
      }
    } catch (err: any) {
      showNotice('error', err.message || 'यूज़र सूची लोड करने में त्रुटि');
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const handleAdminPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserForPassword) return;
    if (newPassword.trim().length < 4) {
      showNotice('error', 'नया पासवर्ड कम से कम 4 अक्षरों का होना चाहिए');
      return;
    }

    try {
      setSavingPassword(true);
      await adminChangeUserPassword(targetUserForPassword.id, newPassword, forceLogout);
      showNotice('success', `यूज़र '${targetUserForPassword.username}' का पासवर्ड सफलतापूर्वक बदल दिया गया!`);
      setTargetUserForPassword(null);
      setNewPassword('');
      loadUsers();
      if (onUserUpdated) onUserUpdated();
    } catch (err: any) {
      showNotice('error', err.message || 'पासवर्ड बदलने में त्रुटि');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAdminUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserForEdit) return;

    try {
      setSavingEdit(true);
      await adminUpdateUser(targetUserForEdit.id, {
        username: editUsername,
        display_name: editDisplayName,
        phone_number: editPhone,
        role: editRole
      });
      showNotice('success', 'यूज़र विवरण सफलतापूर्वक अपडेट किया गया!');
      setTargetUserForEdit(null);
      loadUsers();
      if (onUserUpdated) onUserUpdated();
    } catch (err: any) {
      showNotice('error', err.message || 'अपडेट करने में त्रुटि');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createUsername.trim().length < 3) {
      showNotice('error', 'यूज़रनेम कम से कम 3 अक्षरों का होना चाहिए');
      return;
    }
    if (createPassword.trim().length < 4) {
      showNotice('error', 'पासवर्ड कम से कम 4 अक्षरों का होना चाहिए');
      return;
    }

    try {
      setSavingCreate(true);
      await adminCreateUser({
        username: createUsername,
        password: createPassword,
        display_name: createDisplayName || createUsername,
        phone_number: createPhone,
        role: createRole
      });
      showNotice('success', `नया ऑपरेटर '${createUsername}' सफलतापूर्वक जोड़ा गया!`);
      setIsCreatingUser(false);
      setCreateUsername('');
      setCreatePassword('');
      setCreateDisplayName('');
      setCreatePhone('');
      loadUsers();
      if (onUserUpdated) onUserUpdated();
    } catch (err: any) {
      showNotice('error', err.message || 'यूज़र बनाने में त्रुटि');
    } finally {
      setSavingCreate(false);
    }
  };

  const handleDeleteUser = async (user: SystemUser) => {
    if (user.id === currentUser?.user_id || user.username === currentUser?.username) {
      showNotice('error', 'आप स्वयं का खाता नहीं हटा सकते');
      return;
    }
    const confirm = window.confirm(`क्या आप सचमुच यूज़र '${user.display_name} (${user.username})' को हटाना चाहते हैं?`);
    if (!confirm) return;

    try {
      await adminDeleteUser(user.id);
      showNotice('success', `यूज़र '${user.username}' हटा दिया गया`);
      loadUsers();
      if (onUserUpdated) onUserUpdated();
    } catch (err: any) {
      showNotice('error', err.message || 'यूज़र हटाने में त्रुटि');
    }
  };

  const handleLinkAdminPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = adminPhoneInput.trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      showNotice('error', 'कृपया कम से कम 10-अंकों का वैध मोबाइल नंबर दर्ज करें (उदा. +91 9876543210)');
      return;
    }

    try {
      setSavingPhone(true);
      await linkUserPhone(cleanPhone);
      showNotice('success', `मोबाइल नंबर ${cleanPhone} आपके खाते से सफलतापूर्वक लिंक कर दिया गया!`);
      loadUsers();
      if (onUserUpdated) onUserUpdated();
    } catch (err: any) {
      showNotice('error', err.message || 'मोबाइल नंबर लिंक करने में त्रुटि');
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSelfPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newSelfPassword !== confirmSelfPassword) {
      showNotice('error', 'नया पासवर्ड और पुष्टि पासवर्ड मेल नहीं खाते');
      return;
    }
    if (newSelfPassword.length < 4) {
      showNotice('error', 'पासवर्ड कम से कम 4 अक्षरों का होना चाहिए');
      return;
    }

    try {
      setSavingSelfPassword(true);
      await changeMyPassword(oldSelfPassword, newSelfPassword);
      showNotice('success', 'आपका पासवर्ड सफलतापूर्वक अपडेट कर दिया गया!');
      setOldSelfPassword('');
      setNewSelfPassword('');
      setConfirmSelfPassword('');
    } catch (err: any) {
      showNotice('error', err.message || 'पासवर्ड बदलने में त्रुटि');
    } finally {
      setSavingSelfPassword(false);
    }
  };

  const startEditUser = (user: SystemUser) => {
    setTargetUserForEdit(user);
    setEditUsername(user.username);
    setEditDisplayName(user.display_name);
    setEditPhone(user.phone_number || '');
    setEditRole(user.role);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {lang === 'hi' ? 'आईडी व पासवर्ड प्रबंधन केंद्र' : 'ID & Password Management'}
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                    Admin Access
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'hi'
                  ? 'एडमिन पासवर्ड बदल सकते हैं, नए ऑपरेटर जोड़ सकते हैं और मोबाइल नंबर लिंक कर सकते हैं'
                  : 'Manage credentials, reset operator passwords, and link emergency contact numbers'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications Bar */}
        {notification && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800'
            }`}
          >
            {notification.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 gap-2 pt-2">
          {isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'users'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'सभी यूज़र्स व पासवर्ड (All Users)' : 'All Users & Passwords'}</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('phone')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'phone'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
            <span>{lang === 'hi' ? '📱 मोबाइल नंबर लिंक करें (Link Mobile)' : '📱 Link Mobile Number'}</span>
          </button>

          <button
            onClick={() => setActiveTab('self_password')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'self_password'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{lang === 'hi' ? 'मेरा पासवर्ड बदलें' : 'Change My Password'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* TAB 1: USERS & PASSWORDS LIST (ADMIN) */}
          {activeTab === 'users' && isAdmin && (
            <div className="space-y-4">
              {/* Admin Control Announcement Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50 to-sky-50 dark:from-indigo-950/40 dark:to-sky-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    👑
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {lang === 'hi' ? 'एकल एडमिन नियंत्रण प्रणाली (Custom Operator Management)' : 'Single Admin Control & Custom User Generation'}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      {lang === 'hi'
                        ? 'एडमिन अपनी आवश्यकतानुसार जितने चाहें उतने नए ऑपरेटर/विश्लेषक खाते बना सकते हैं। समवर्ती 5-लॉगिन सीमा स्वतः लागू रहेगी।'
                        : 'Admin can create unlimited operator accounts. 5 concurrent active login limit applies automatically.'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full font-bold text-[11px] bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-800">
                    {users.length} {lang === 'hi' ? 'कुल पंजीकृत खाते' : 'Total Accounts'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {lang === 'hi' ? 'पंजीकृत यूज़र्स व ऑपरेटर्स की सूची' : 'Registered Users & Operators List'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'hi'
                      ? 'किसी भी ऑपरेटर का पासवर्ड बदलें, विवरण अपडेट करें या नया खाता बनाएं।'
                      : 'Reset passwords, update credentials, or provision new operator accounts.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadUsers}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                    title="रिफ्रेश करें"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsCreatingUser(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'hi' ? '➕ नया ऑपरेटर बनाएं' : '➕ Add New User'}</span>
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  <span>यूज़र सूची लोड हो रही है...</span>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3.5">यूज़र आईडी</th>
                        <th className="py-2.5 px-3">नाम व पद</th>
                        <th className="py-2.5 px-3">लिंक्ड मोबाइल नंबर</th>
                        <th className="py-2.5 px-3">रोल</th>
                        <th className="py-2.5 px-3">सक्रिय सत्र</th>
                        <th className="py-2.5 px-3 text-right">कार्रवाई</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                            {u.username}
                          </td>
                          <td className="py-3 px-3 font-medium">
                            {u.display_name}
                          </td>
                          <td className="py-3 px-3">
                            {u.phone_number ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                <Phone className="w-3 h-3" />
                                {u.phone_number}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">लिंक नहीं है</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                u.role === 'admin'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : u.role === 'analyst'
                                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                  : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {u.active_sessions > 0 ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {u.active_sessions} स्लॉट सक्रिय
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">ऑफलाइन</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {/* Change Password Button */}
                              <button
                                onClick={() => {
                                  setTargetUserForPassword(u);
                                  setNewPassword('');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold border border-amber-300 dark:border-amber-800 transition-colors cursor-pointer"
                                title="पासवर्ड बदलें"
                              >
                                <Key className="w-3 h-3" />
                                <span>पासवर्ड</span>
                              </button>

                              {/* Edit User Button */}
                              <button
                                onClick={() => startEditUser(u)}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                                title="विवरण एडिट करें"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Button (disabled for self) */}
                              {u.id !== currentUser?.user_id && u.username !== currentUser?.username && (
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-colors"
                                  title="यूज़र हटाएं"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading && users.length === 1 && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {lang === 'hi'
                      ? 'वर्तमान में केवल मुख्य एडमिन खाता पंजीकृत है। अपनी वॉर रूम टीम को एक्सेस देने के लिए ऊपर "➕ नया ऑपरेटर बनाएं" बटन दबाएं और उनके लिए आईडी व पासवर्ड बनाएं।'
                      : 'Currently only Primary Admin exists. Click "➕ Add New User" above to create credentials for your team.'}
                  </p>
                  <button
                    onClick={() => setIsCreatingUser(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'hi' ? 'पहला ऑपरेटर खाता बनाएं' : 'Create First Operator Account'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LINK MOBILE NUMBER (ADMIN & OPERATORS) */}
          {activeTab === 'phone' && (
            <div className="max-w-xl mx-auto py-4 space-y-6">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'एडमिन / ऑपरेटर मोबाइल नंबर लिंक करें' : 'Link Contact Mobile Number'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'hi'
                    ? 'आपातकालीन अलर्ट्स और खाते के सुरक्षित प्रमाणीकरण के लिए अपना 10-अंकों का मोबाइल नंबर दर्ज करें।'
                    : 'Link your mobile phone number for emergency CM War Room alerts and secure verification.'}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">वर्तमान यूज़र आईडी:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {currentUser?.username} ({currentUser?.role?.toUpperCase()})
                  </span>
                </div>

                <form onSubmit={handleLinkAdminPhone} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {lang === 'hi' ? 'मोबाइल नंबर (Mobile Phone Number)' : 'Mobile Phone Number'}
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={adminPhoneInput}
                        onChange={e => setAdminPhoneInput(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      देश कोड के साथ या बिना (+91) 10 अंकों का सक्रिय भारतीय मोबाइल नंबर दर्ज करें।
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={savingPhone}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {savingPhone ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>{lang === 'hi' ? 'मोबाइल नंबर सुरक्षित करें व लिंक करें' : 'Save & Link Mobile Number'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: SELF PASSWORD CHANGE */}
          {activeTab === 'self_password' && (
            <div className="max-w-md mx-auto py-4 space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-inner">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'मेरा लॉगिन पासवर्ड बदलें' : 'Change My Login Password'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'hi'
                    ? 'अपने मौजूदा खाते का पासवर्ड अपडेट करें। सुरक्षा के लिए मजबूत पासवर्ड चुनें।'
                    : 'Update your current account credentials.'}
                </p>
              </div>

              <form onSubmit={handleSelfPasswordChange} className="space-y-4 bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    वर्तमान पासवर्ड (Current Password)
                  </label>
                  <input
                    type="password"
                    required
                    value={oldSelfPassword}
                    onChange={e => setOldSelfPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    नया पासवर्ड (New Password)
                  </label>
                  <input
                    type="password"
                    required
                    value={newSelfPassword}
                    onChange={e => setNewSelfPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    नए पासवर्ड की पुष्टि करें (Confirm Password)
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmSelfPassword}
                    onChange={e => setConfirmSelfPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingSelfPassword}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingSelfPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{lang === 'hi' ? 'पासवर्ड सुरक्षित करें' : 'Save New Password'}</span>
                </button>
              </form>
            </div>
          )}

        </div>

        {/* SUB-MODAL: ADMIN CHANGE PASSWORD FOR SPECIFIC USER */}
        {targetUserForPassword && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Key className="w-5 h-5" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    पासवर्ड बदलें: <span className="font-mono text-indigo-600 dark:text-indigo-400">{targetUserForPassword.username}</span>
                  </h4>
                </div>
                <button onClick={() => setTargetUserForPassword(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                <div><strong>यूज़र का नाम:</strong> {targetUserForPassword.display_name}</div>
                <div><strong>रोल:</strong> {targetUserForPassword.role}</div>
                {targetUserForPassword.phone_number && (
                  <div><strong>मोबाइल:</strong> {targetUserForPassword.phone_number}</div>
                )}
              </div>

              <form onSubmit={handleAdminPasswordChange} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    नया पासवर्ड दर्ज करें (New Password)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="उदा. WarRoom@2026"
                      className="w-full pl-3 pr-10 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="forceLogout"
                    checked={forceLogout}
                    onChange={e => setForceLogout(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="forceLogout" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    इस यूज़र के सभी सक्रिय सत्र समाप्त करें (Force re-login)
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTargetUserForPassword(null)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    रद्द करें
                  </button>
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {savingPassword ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>पासवर्ड अपडेट करें</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUB-MODAL: EDIT USER (ID, NAME, PHONE, ROLE) */}
        {targetUserForEdit && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Edit2 className="w-5 h-5" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    यूज़र विवरण संपादित करें
                  </h4>
                </div>
                <button onClick={() => setTargetUserForEdit(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAdminUpdateUser} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    यूज़र आईडी / यूज़रनेम (Login ID)
                  </label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    प्रदर्शन नाम (Display Name)
                  </label>
                  <input
                    type="text"
                    required
                    value={editDisplayName}
                    onChange={e => setEditDisplayName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    मोबाइल नंबर (Phone Number)
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    placeholder="+91 9XXXXXXXXX"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    भूमिका / रोल (Role)
                  </label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="operator">Operator (ऑपरेटर)</option>
                    <option value="analyst">Analyst (विश्लेषक)</option>
                    <option value="admin">Admin (लीड एडमिन)</option>
                    <option value="viewer">Viewer (दर्शक)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTargetUserForEdit(null)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    रद्द करें
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {savingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>अपडेट सुरक्षित करें</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUB-MODAL: CREATE NEW OPERATOR */}
        {isCreatingUser && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Plus className="w-5 h-5" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    नया ऑपरेटर / यूज़र जोड़ें
                  </h4>
                </div>
                <button onClick={() => setIsCreatingUser(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    लॉगिन यूज़र आईडी (Username / ID) *
                  </label>
                  <input
                    type="text"
                    required
                    value={createUsername}
                    onChange={e => setCreateUsername(e.target.value)}
                    placeholder="उदा. operator3"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    लॉगिन पासवर्ड (Password) *
                  </label>
                  <input
                    type="text"
                    required
                    value={createPassword}
                    onChange={e => setCreatePassword(e.target.value)}
                    placeholder="कम से कम 4 अक्षर"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    पूरा नाम / पद (Display Name)
                  </label>
                  <input
                    type="text"
                    value={createDisplayName}
                    onChange={e => setCreateDisplayName(e.target.value)}
                    placeholder="उदा. Duty Operator 3"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    मोबाइल नंबर (Phone Number - Optional)
                  </label>
                  <input
                    type="text"
                    value={createPhone}
                    onChange={e => setCreatePhone(e.target.value)}
                    placeholder="+91 9XXXXXXXXX"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    भूमिका / रोल (Role)
                  </label>
                  <select
                    value={createRole}
                    onChange={e => setCreateRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="operator">Operator (ऑपरेटर)</option>
                    <option value="analyst">Analyst (विश्लेषक)</option>
                    <option value="admin">Admin (लीड एडमिन)</option>
                    <option value="viewer">Viewer (दर्शक)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingUser(false)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    रद्द करें
                  </button>
                  <button
                    type="submit"
                    disabled={savingCreate}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {savingCreate ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>ऑपरेटर बनाएं</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
