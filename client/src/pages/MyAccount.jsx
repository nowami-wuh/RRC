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
  const [message, setMessage] = useState('');
  const [usernameAvail, setUsernameAvail] = useState({ status: 'idle', message: '' });
  const [avatarData, setAvatarData] = useState(null);
  const fileInputRef = useRef(null);

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

  const closeModal = () => {
    setEditField(null);
    setUsernameAvail({ status: 'idle', message: '' });
  };

  const handleSave = async () => {
    if (editField === 'username' && usernameAvail.status === 'taken') return;
    try {
      if (editField === 'password') {
        await changeUserPassword(authUser.id, 'password123', fieldValue);
        setMessage('Password updated.');
      } else {
        if (editField === 'phone') {
          if (!isValidPhilippinePhone(fieldValue)) {
            setMessage('Invalid Philippine phone number. Use format 09XXXXXXXXX (11 digits).');
            return;
          }
        }
        const payload = { [editField]: fieldValue };
        if (avatarData) {
          payload.avatar = avatarData;
        }
        const updated = await updateUserProfile(authUser.id, payload);
        setUser(updated.user);
        setAuthUser({ ...authUser, ...updated.user });
        setMessage('Profile updated.');
        setAvatarData(null);
      }
      closeModal();
    } catch (err) {
      setMessage(err.message || 'Unable to save.');
    }
  };

  if (loading) return <div className="event-item">Loading account…</div>;
  if (error) return <div className="event-item">{error}</div>;

  return (
    <>
      <header className="page-header">
        <div className="header-text">
          <h1 className="page-title">My Account</h1>
          <p className="page-subtitle">Manage and protect your account</p>
        </div>
      </header>
      <div className="account-layout">
        <aside className="profile-col">
          <div className="profile-card">
            <div className="avatar-wrap">
                {user.avatar ? <img className="avatar-img visible" src={user.avatar} alt="Profile" /> : <div className="avatar-placeholder"><svg viewBox="0 0 24 24" fill="currentColor" width="52" height="52"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>}
            </div>
            <button className="pill-btn" type="button" onClick={() => fileInputRef.current?.click()}>
              Change Avatar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onloadend = () => {
                  setAvatarData(reader.result);
                };
                reader.readAsDataURL(file);
              }}
            />
            <h2 className="profile-name">{user.username}</h2>
            <div className="user-id-pill">{user.id}</div>
          </div>
        </aside>

        <div className="info-col">
          <div className="info-section">
            <div className="section-label-row"><span>Profile</span></div>
            <div className="info-card">
              {['username', 'phone', 'email'].map((field) => (
                <div key={field} className="info-row">
                  <div className="info-left">
                    <span className="info-label">{field === 'username' ? 'Username' : field === 'phone' ? 'Phone Number' : 'Email Address'}</span>
                    <span className="info-value">{user[field]}</span>
                  </div>
                  <button className="pill-btn" onClick={() => { setEditField(field); setFieldValue(user[field]); }}>
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
                <button className="pill-btn" onClick={() => { setEditField('password'); setFieldValue(''); }}>
                  Change
                </button>
              </div>
            </div>
          </div>
          {message && <div className="event-item" style={{ marginTop: 16 }}>{message}</div>}
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
              <label className="m-label">
                {editField === 'password' ? 'New Password' : editField === 'phone' ? 'Phone Number (09XXXXXXXXX)' : editField.charAt(0).toUpperCase() + editField.slice(1)}
              </label>
              <input
                className={`field-input${editField === 'username' && usernameAvail.status === 'taken' ? ' field-input--error' : ''}`}
                type={editField === 'password' ? 'password' : editField === 'phone' ? 'tel' : 'text'}
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
              <div className="m-actions">
                <button className="m-btn-cancel" type="button" onClick={closeModal}>Cancel</button>
                <button
                  className="m-btn-save"
                  type="button"
                  onClick={handleSave}
                  disabled={editField === 'username' && usernameAvail.status === 'taken'}
                  style={{ opacity: editField === 'username' && usernameAvail.status === 'taken' ? 0.5 : 1 }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
