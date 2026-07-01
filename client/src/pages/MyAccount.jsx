import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchUser, updateUserProfile, changeUserPassword, checkUsernameAvailability } from '../api/api';
import '../styles/my-account.css';

function isValidPhilippinePhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 11 && cleaned.startsWith('09');
}

function sanitizePhilippinePhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length === 1) {
    return digits === '0' ? '0' : '';
  }
  if (!digits.startsWith('09')) {
    if (digits[0] === '0') {
      return '0';
    }
    return '';
  }
  return digits;
}

export default function MyAccount() {
  const { user: authUser, login: setAuthUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editField, setEditField] = useState(null);
  const [fieldValue, setFieldValue] = useState('');
  // For password modal
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [saving, setSaving] = useState(false);
  const [usernameAvail, setUsernameAvail] = useState({ status: 'idle', message: '' });
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileInputRef = useRef(null);

  const isAdmin = typeof authUser?.id === 'string' && authUser.id.startsWith('ADMIN-');

  useEffect(() => {
    if (!authUser?.id) {
      setError('Please sign in to view your account.');
      setLoading(false);
      return;
    }

    fetchUser(authUser.id).then((data) => setUser(data.user)).catch(() => setError('Unable to load user.')).finally(() => setLoading(false));
  }, [authUser?.id]);

  // Debounced username availability check — only runs when editing username
  useEffect(() => {
    if (editField !== 'username') {
      setUsernameAvail({ status: 'idle', message: '' });
      return undefined;
    }
    const trimmed = fieldValue.trim();
    // If unchanged from current username, no need to check
    if (!trimmed || trimmed === user?.username) {
      setUsernameAvail({ status: 'idle', message: '' });
      return undefined;
    }
    let active = true;
    const tid = window.setTimeout(async () => {
      setUsernameAvail({ status: 'checking', message: 'Checking username availability...' });
      try {
        const result = await checkUsernameAvailability(trimmed);
        if (!active) return;
        if (result.available) {
          setUsernameAvail({ status: 'available', message: 'Username is available.' });
        } else {
          setUsernameAvail({ status: 'taken', message: 'Username is already taken.' });
        }
      } catch { if (active) setUsernameAvail({ status: 'idle', message: '' }); }
    }, 350);
    return () => { active = false; window.clearTimeout(tid); };
  }, [fieldValue, editField, user?.username]);

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const closeModal = () => {
    setEditField(null);
    setCurrentPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setUsernameAvail({ status: 'idle', message: '' });
  };

  // ── Avatar: save immediately on file pick ─────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const avatarData = reader.result;
      setAvatarSaving(true);
      try {
        const updated = await updateUserProfile(authUser.id, { avatar: avatarData });
        setUser(updated.user);
        setAuthUser({ ...authUser, ...updated.user });
        showMsg('Avatar updated successfully.');
      } catch (err) {
        showMsg(err.message || 'Failed to update avatar.', 'error');
      } finally {
        setAvatarSaving(false);
        // Reset file input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (editField === 'username' && usernameAvail.status === 'taken') return;
    setSaving(true);
    try {
      if (editField === 'password') {
        if (!currentPassword) {
          showMsg('Please enter your current password.', 'error');
          setSaving(false);
          return;
        }
        if (!fieldValue || fieldValue.length < 8) {
          showMsg('New password must be at least 8 characters.', 'error');
          setSaving(false);
          return;
        }
        await changeUserPassword(authUser.id, currentPassword, fieldValue);
        showMsg('Password updated successfully.');
        closeModal();
      } else {
        if (editField === 'phone') {
          if (!isValidPhilippinePhone(fieldValue)) {
            showMsg('Invalid phone number. Use format 09XXXXXXXXX (11 digits).', 'error');
            setSaving(false);
            return;
          }
        }
        if (editField === 'email') {
          const trimmed = fieldValue.trim();
          if (!trimmed || !trimmed.includes('@')) {
            showMsg('Please enter a valid email address.', 'error');
            setSaving(false);
            return;
          }
        }
        const payload = { [editField]: editField === 'email' ? fieldValue.trim().toLowerCase() : fieldValue };
        const updated = await updateUserProfile(authUser.id, payload);
        setUser(updated.user);
        setAuthUser({ ...authUser, ...updated.user });
        showMsg('Profile updated successfully.');
        closeModal();
      }
    } catch (err) {
      showMsg(err.message || 'Unable to save changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="event-item">Loading account…</div>;
  if (error) return <div className="event-item">{error}</div>;

  // Fields to show: hide phone for admin users
  const profileFields = isAdmin ? ['username', 'email'] : ['username', 'phone', 'email'];

  return (
    <>
      <header className="page-header">
        <div className="header-text">
          <h1 className="page-title">Account</h1>
          <p className="page-subtitle">Manage and protect your account</p>
        </div>
      </header>
      <div className="account-layout">
        <aside className="profile-col">
          <div className="profile-card">
            <div className="avatar-wrap" style={{ position: 'relative' }}>
              {user.avatar
                ? <img className="avatar-img visible" src={user.avatar} alt="Profile" />
                : <div className="avatar-placeholder"><svg viewBox="0 0 24 24" fill="currentColor" width="52" height="52"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg></div>}
              {avatarSaving && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', borderRadius: '50%' }}>
                  <span style={{ color: '#fff', fontSize: 12 }}>Saving…</span>
                </div>
              )}
            </div>
            <button className="pill-btn" type="button" disabled={avatarSaving} onClick={() => fileInputRef.current?.click()}>
              {avatarSaving ? 'Saving…' : 'Change Photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <h2 className="profile-name">{user.username}</h2>
            <div className="user-id-pill">{user.id}</div>
          </div>
        </aside>

        <div className="info-col">
          <div className="info-section">
            <div className="section-label-row"><span>Profile</span></div>
            <div className="info-card">
              {profileFields.map((field) => (
                <div key={field} className="info-row">
                  <div className="info-left">
                    <span className="info-label">{field === 'username' ? 'Username' : field === 'phone' ? 'Phone Number' : 'Email Address'}</span>
                    <span className="info-value">{user[field] || <em style={{ opacity: 0.45 }}>Not set</em>}</span>
                  </div>
                  <button className="pill-btn" onClick={() => { setEditField(field); setFieldValue(field === 'phone' ? (user[field] || '') : (user[field] || '')); }}>
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="info-section">
            <div className="section-label-row"><span>Security</span></div>
            <div className="info-card">
              <div className="info-row">
                <div className="info-left">
                  <span className="info-label">Password</span>
                  <span className="info-value pw-dots"><span className="dot" /><span className="dot" /><span className="dot" /><span className="dot" /><span className="dot" /><span className="dot" /></span>
                </div>
                <button className="pill-btn" onClick={() => { setEditField('password'); setFieldValue(''); setCurrentPassword(''); }}>
                  Change
                </button>
              </div>
            </div>
          </div>
          {message.text && (
            <div
              className="event-item"
              style={{
                marginTop: 16,
                color: message.type === 'error' ? 'var(--accent-red, #e05)' : 'var(--accent-green, #2a9d5c)',
                background: message.type === 'error' ? 'rgba(220,30,60,0.08)' : 'rgba(42,157,92,0.08)',
                border: `1px solid ${message.type === 'error' ? 'rgba(220,30,60,0.25)' : 'rgba(42,157,92,0.25)'}`,
              }}
            >
              {message.type === 'error' ? '✕ ' : '✓ '}{message.text}
            </div>
          )}
        </div>
      </div>

      {/* Floating Edit Modal */}
      {editField && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                Update {editField === 'username' ? 'Username' : editField === 'phone' ? 'Phone Number' : editField === 'email' ? 'Email Address' : 'Password'}
              </span>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              {/* Password modal: current password + new password */}
              {editField === 'password' ? (
                <>
                  <label className="m-label">Current Password</label>
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <input
                      className="field-input"
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      autoFocus
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      style={{ width: '100%', boxSizing: 'border-box', paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((v) => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', opacity: 0.6 }}
                      tabIndex={-1}
                    >
                      {showCurrent ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <label className="m-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="field-input"
                      type={showNew ? 'text' : 'password'}
                      value={fieldValue}
                      onChange={(e) => setFieldValue(e.target.value)}
                      placeholder="Min. 8 characters"
                      style={{ width: '100%', boxSizing: 'border-box', paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', opacity: 0.6 }}
                      tabIndex={-1}
                    >
                      {showNew ? '🙈' : '👁️'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="m-label">
                    {editField === 'phone' ? 'Phone Number (09XXXXXXXXX)' : editField.charAt(0).toUpperCase() + editField.slice(1)}
                  </label>
                  <input
                    className={`field-input${editField === 'username' && usernameAvail.status === 'taken' ? ' field-input--error' : ''}`}
                    type={editField === 'phone' ? 'tel' : 'text'}
                    inputMode={editField === 'phone' ? 'numeric' : undefined}
                    pattern={editField === 'phone' ? '09[0-9]{9}' : undefined}
                    value={fieldValue}
                    autoFocus
                    onChange={(e) => {
                      let val = e.target.value;
                      if (editField === 'phone') {
                        val = sanitizePhilippinePhone(val);
                      }
                      if (editField === 'username') {
                        val = val.slice(0, 11);
                      }
                      setFieldValue(val);
                    }}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                  {/* Username availability status */}
                  {editField === 'username' && usernameAvail.message && (
                    <span className={`account-field-status ${usernameAvail.status}`}>
                      {usernameAvail.status === 'checking' && '⏳ '}
                      {usernameAvail.status === 'available' && '✓ '}
                      {usernameAvail.status === 'taken' && '✕ '}
                      {usernameAvail.message}
                    </span>
                  )}
                </>
              )}
              <div className="m-actions">
                <button className="m-btn-cancel" type="button" onClick={closeModal}>Cancel</button>
                <button
                  className="m-btn-save"
                  type="button"
                  onClick={handleSave}
                  disabled={saving || (editField === 'username' && usernameAvail.status === 'taken')}
                  style={{ opacity: saving || (editField === 'username' && usernameAvail.status === 'taken') ? 0.5 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
