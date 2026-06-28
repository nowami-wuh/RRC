import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  checkUsernameAvailability,
  login,
  loginWithGoogle,
  signupInitiate,
  signupVerify,
  resetInitiate,
  resetVerify,
} from '../api/api';
import '../styles/login.css';

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

function isValidUsername(username) {
  return username.length > 0 && username.length <= 11 && /^[a-zA-Z0-9_-]+$/.test(username);
}

function getPasswordStrength(password) {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };
  const passedCount = Object.values(checks).filter(Boolean).length;
  const strong = passedCount === 4;
  if (!password) return { label: 'Use 8+ characters with uppercase, lowercase, and a number.', tone: 'idle', progress: 0, strong: false };
  if (strong) return { label: 'Strong password', tone: 'strong', progress: 100, strong: true };
  return { label: 'Weak password. Add uppercase, lowercase, and a number.', tone: passedCount >= 2 ? 'warning' : 'weak', progress: passedCount * 25, strong: false };
}

const EyeOpen = () => (
  <svg className="eye-icon" viewBox="0 0 24 24">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
  </svg>
);
const EyeOff = () => (
  <svg className="eye-icon" viewBox="0 0 24 24">
    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.82l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.74-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.34-4.3c-.62-.06-1.25-.06-1.87 0l2.67 2.67c.22-.05.44-.08.65-.08 1.66 0 3 1.34 3 3 0 .22-.03.44-.08.65l2.67 2.67c.06-.62.06-1.25 0-1.87z"/>
  </svg>
);

// Reusable 6-digit OTP input component
function OtpInput({ value, onChange, onKeyDown, onPaste, refs, hasError }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={i === 0 ? onPaste : undefined}
          style={{
            width: '46px', height: '56px', textAlign: 'center',
            fontSize: '24px', fontWeight: 700, fontFamily: 'Garet, sans-serif',
            border: hasError ? '2px solid #dc3545' : '2px solid rgba(255,255,255,0.35)',
            borderRadius: '10px', background: 'rgba(255,255,255,0.1)',
            color: '#fff', outline: 'none', caretColor: '#fff', transition: 'border-color 0.2s',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#4f8ef7'; }}
          onBlur={(e) => { e.target.style.borderColor = hasError ? '#dc3545' : 'rgba(255,255,255,0.35)'; }}
        />
      ))}
    </div>
  );
}

export default function LoginSignup() {
  const { login: signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminMode = location.pathname.startsWith('/admin');

  // modes: login | signup | verify_otp | google_signup |
  //        forgot_password | reset_otp | reset_new_password
  const [mode, setMode] = useState('login');

  const [formData, setFormData] = useState({
    loginUsername: '',
    loginPassword: '',
    signupUsername: '',
    signupContact: '',
    signupEmail: '',
    signupPassword: '',
    resetEmail: '',
    resetPassword: '',
    confirmPassword: '',
  });

  // Shared OTP state (used for both signup & reset)
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const signupOtpRefs = useRef([]);
  const resetOtpRefs  = useRef([]);

  const [googleRegData, setGoogleRegData] = useState({ email: '', name: '', token: '', username: '', contact: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [usernameAvailability, setUsernameAvailability] = useState({ status: 'idle', message: '' });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAdminMode) setMode('login');
  }, [isAdminMode]);

  // Username availability check
  useEffect(() => {
    if ((mode !== 'signup' && mode !== 'google_signup') || isAdminMode) {
      setUsernameAvailability({ status: 'idle', message: '' });
      return undefined;
    }
    const username = mode === 'google_signup' ? googleRegData.username.trim() : formData.signupUsername.trim();
    if (!username) { setUsernameAvailability({ status: 'idle', message: '' }); return undefined; }
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setUsernameAvailability({ status: 'checking', message: 'Checking username availability...' });
      try {
        const result = await checkUsernameAvailability(username);
        if (!active) return;
        if (result.available) {
          setUsernameAvailability({ status: 'available', message: 'Username is available.' });
          setFieldErrors((prev) => ({ ...prev, signupUsername: '' }));
        } else {
          setUsernameAvailability({ status: 'taken', message: 'Username is already taken.' });
          setFieldErrors((prev) => ({ ...prev, signupUsername: 'Username is already taken.' }));
        }
      } catch { if (!active) return; setUsernameAvailability({ status: 'idle', message: '' }); }
    }, 300);
    return () => { active = false; window.clearTimeout(timeoutId); };
  }, [formData.signupUsername, googleRegData.username, isAdminMode, mode]);

  // Resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // Google (only for google_signup flow if applicable)
  const handleGoogleSignupSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const errors = {};
    const trimmedUsername = googleRegData.username.trim();
    const trimmedContact = googleRegData.contact.trim();
    if (!trimmedUsername) errors.signupUsername = 'Username is required';
    else if (!isValidUsername(trimmedUsername)) errors.signupUsername = 'Username must be 1-11 characters (letters, numbers, underscore, hyphen only)';
    if (!trimmedContact) errors.signupContact = 'Contact number is required';
    else if (!isValidPhilippinePhone(trimmedContact)) errors.signupContact = 'Invalid Philippine phone number (must be 11 digits and start with 09)';
    if (usernameAvailability.status === 'taken') errors.signupUsername = 'Username is already taken.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      const result = await loginWithGoogle(googleRegData.token, trimmedUsername, trimmedContact);
      if (result.user) { signIn(result.user); navigate('/'); }
    } catch (err) {
      if (err.code === 'USERNAME_TAKEN' || err.field === 'signupUsername') {
        setFieldErrors((prev) => ({ ...prev, signupUsername: err.message }));
        setUsernameAvailability({ status: 'taken', message: err.message });
        return;
      }
      setError(err.message || 'Registration failed');
    }
  };

  const setField = (key, value) => {
    if (key === 'signupContact') {
      value = sanitizePhilippinePhone(value);
    }
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: '' }));
  };

  // ── LOGIN ────────────────────────────────────────────────────────────────
  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const errors = {};
    if (!formData.loginUsername.trim()) errors.loginUsername = 'Username is required';
    if (!formData.loginPassword) errors.loginPassword = 'Password is required';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsSubmitting(true);
    try {
      const profile = await login(formData.loginUsername.trim(), formData.loginPassword, isAdminMode ? 'admin' : 'customer');
      signIn(profile.user || profile);
      navigate(isAdminMode ? '/admin' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── SIGNUP ───────────────────────────────────────────────────────────────
  const handleSignupSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const errors = {};
    if (!formData.signupUsername.trim()) errors.signupUsername = 'Username is required';
    else if (!isValidUsername(formData.signupUsername.trim())) errors.signupUsername = 'Username must be 1-11 characters (letters, numbers, underscore, hyphen only)';
    if (!formData.signupContact.trim()) errors.signupContact = 'Contact number is required';
    else if (!isValidPhilippinePhone(formData.signupContact)) errors.signupContact = 'Invalid Philippine phone number (must be 11 digits and start with 09)';
    if (!formData.signupEmail.trim()) errors.signupEmail = 'Email is required';
    const pwStrength = getPasswordStrength(formData.signupPassword);
    if (!formData.signupPassword) errors.signupPassword = 'Password is required';
    else if (!pwStrength.strong) errors.signupPassword = pwStrength.label;
    if (usernameAvailability.status === 'taken') errors.signupUsername = 'Username is already taken.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsSubmitting(true);
    try {
      await signupInitiate(formData.signupUsername.trim(), formData.signupEmail.trim(), formData.signupContact.trim(), formData.signupPassword);
      setOtpEmail(formData.signupEmail.trim());
      setOtpCode(['', '', '', '', '', '']);
      setOtpError('');
      setResendCooldown(60);
      setMode('verify_otp');
    } catch (err) {
      if (err.code === 'USERNAME_TAKEN' || err.field === 'signupUsername') {
        setFieldErrors((prev) => ({ ...prev, signupUsername: err.message }));
        setUsernameAvailability({ status: 'taken', message: err.message });
      } else if (err.field) {
        setFieldErrors((prev) => ({ ...prev, [err.field]: err.message }));
      } else {
        setError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── SIGNUP OTP ───────────────────────────────────────────────────────────
  const handleOtpChange = (index, value, refs) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpCode];
    next[index] = digit;
    setOtpCode(next);
    setOtpError('');
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e, refs) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) refs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpCode(next);
  };

  const handleSignupOtpVerify = async () => {
    const code = otpCode.join('');
    if (code.length < 6) { setOtpError('Please enter the complete 6-digit code.'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const result = await signupVerify(otpEmail, code);
      if (result.user) { signIn(result.user); navigate('/'); }
    } catch (err) {
      setOtpError(err.message || 'Invalid or expired code.');
      setOtpCode(['', '', '', '', '', '']);
      signupOtpRefs.current[0]?.focus();
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendSignupOtp = async () => {
    if (resendCooldown > 0) return;
    setOtpError('');
    try {
      await signupInitiate(formData.signupUsername.trim(), formData.signupEmail.trim(), formData.signupContact.trim(), formData.signupPassword);
      setResendCooldown(60);
      setOtpCode(['', '', '', '', '', '']);
      signupOtpRefs.current[0]?.focus();
    } catch (err) {
      setOtpError(err.message || 'Failed to resend. Try again.');
    }
  };

  // ── FORGOT PASSWORD — step 1: enter email ────────────────────────────────
  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const email = formData.resetEmail.trim();
    if (!email) { setFieldErrors((prev) => ({ ...prev, resetEmail: 'Email is required.' })); return; }
    setIsSubmitting(true);
    try {
      await resetInitiate(email);
      setOtpEmail(email);
      setOtpCode(['', '', '', '', '', '']);
      setOtpError('');
      setResendCooldown(60);
      setMode('reset_otp');
    } catch (err) {
      setError(err.message || 'Could not send reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── RESET OTP — step 2: verify code ─────────────────────────────────────
  const handleResetOtpVerify = async () => {
    const code = otpCode.join('');
    if (code.length < 6) { setOtpError('Please enter the complete 6-digit code.'); return; }
    // Store code and advance — actual reset happens with the new password
    setFormData((prev) => ({ ...prev, _resetCode: code }));
    setMode('reset_new_password');
    setOtpError('');
  };

  const handleResendResetOtp = async () => {
    if (resendCooldown > 0) return;
    setOtpError('');
    try {
      await resetInitiate(otpEmail);
      setResendCooldown(60);
      setOtpCode(['', '', '', '', '', '']);
      resetOtpRefs.current[0]?.focus();
    } catch (err) {
      setOtpError(err.message || 'Failed to resend. Try again.');
    }
  };

  // ── RESET NEW PASSWORD — step 3: set new password ────────────────────────
  const handleResetNewPassword = async (event) => {
    event.preventDefault();
    setError('');
    const errors = {};
    const strength = getPasswordStrength(formData.resetPassword);
    if (!formData.resetPassword) errors.resetPassword = 'Password is required.';
    else if (!strength.strong) errors.resetPassword = strength.label;
    if (formData.resetPassword !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsSubmitting(true);
    try {
      await resetVerify(otpEmail, formData._resetCode || formData.resetCode, formData.resetPassword);
      setMode('login');
      setError('');
      setFormData((prev) => ({ ...prev, resetEmail: '', resetPassword: '', confirmPassword: '', _resetCode: '' }));
      // Show a success message on the login form
      setFieldErrors({});
      // Reuse error state as success (green) — or just set a generic success
      alert('Password reset successful! You can now log in with your new password.');
    } catch (err) {
      setError(err.message || 'Reset failed. The code may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPasswordStrength = getPasswordStrength(formData.resetPassword || '');
  const signupPasswordStrength = getPasswordStrength(formData.signupPassword);

  const goToLogin  = () => { setMode('login');  setError(''); setFieldErrors({}); setShowLoginPassword(false); setShowSignupPassword(false); };
  const goToSignup = () => { setMode('signup'); setError(''); setFieldErrors({}); setShowLoginPassword(false); setShowSignupPassword(false); };

  // Helper: resend button UI
  const ResendButton = ({ cooldown, onResend }) => (
    <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', textAlign: 'center', fontFamily: 'Garet', marginBottom: '20px' }}>
      Didn&apos;t receive the code?{' '}
      {cooldown > 0
        ? <span style={{ color: 'rgba(255,255,255,0.45)' }}>Resend in {cooldown}s</span>
        : <button type="button" onClick={onResend} style={{ background: 'none', border: 'none', color: '#4f8ef7', cursor: 'pointer', fontFamily: 'Garet', fontSize: '13px', fontWeight: 700, padding: 0, textDecoration: 'underline' }}>Resend</button>
      }
    </p>
  );

  return (
    <div className="container">
      <div className="left-panel">
        <div className="logo-icons">
          <img src="/light-icon.png" alt="Lights Icon" className="light-icon" />
          <img src="/rrc-logo.jpg" alt="RRC Logo" className="rrc-logo" />
        </div>
        <div className="brand-content">
          <h1 className="brand-title">
            <span className="rrc-text">RRC</span>
            <span className="lights-text">Lights &amp; Sounds</span>
            <span className="booking-badge">BOOKING</span>
          </h1>
          <p className="tagline">Book, Schedule, Inquire</p>
          <div className="tagline-line"></div>
        </div>
      </div>

      <div className="right-panel">

        {/* ── Google Complete Sign Up (kept for Google OAuth accounts) ── */}
        {mode === 'google_signup' && (
          <div className="form-container active">
            <h2 className="form-title">COMPLETE SIGN UP</h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', marginBottom: '25px', textAlign: 'center', fontFamily: 'Garet', lineHeight: '1.4' }}>
              Select a username and enter your contact number to register your Google account <strong>{googleRegData.email}</strong>.
            </p>
            <form onSubmit={handleGoogleSignupSubmit} noValidate>
              <div className="input-wrapper">
                <div className={`input-group ${fieldErrors.signupUsername ? 'error' : ''}`}>
                  <svg className="input-icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  <input type="text" value={googleRegData.username} onChange={(e) => setGoogleRegData(prev => ({ ...prev, username: e.target.value.slice(0, 11) }))} placeholder="Username" />
                </div>
                <span className="error-message">{fieldErrors.signupUsername}</span>
                {usernameAvailability.message && <span className={`field-status ${usernameAvailability.status}`}>{usernameAvailability.message}</span>}
              </div>
              <div className="input-wrapper">
                <div className={`input-group ${fieldErrors.signupContact ? 'error' : ''}`}>
                  <svg className="input-icon" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                  <input type="tel" inputMode="numeric" pattern="09[0-9]{9}" value={googleRegData.contact} onChange={(e) => setGoogleRegData(prev => ({ ...prev, contact: sanitizePhilippinePhone(e.target.value) }))} placeholder="Contact Number (09XXXXXXXXX)" />
                </div>
                <span className="error-message">{fieldErrors.signupContact}</span>
              </div>
              {error && <div className="form-error" style={{ color: '#dc3545', textAlign: 'center', fontSize: '14px', fontFamily: 'Garet' }}>{error}</div>}
              <button type="submit" className="submit-btn">COMPLETE SIGN UP</button>
              <p className="toggle-form"><button type="button" className="toggle-link" onClick={goToLogin}>Cancel</button></p>
            </form>
          </div>
        )}

        {/* ── FORGOT PASSWORD — Step 1: Enter Email ── */}
        {mode === 'forgot_password' && (
          <div className="form-container active">
            <h2 className="form-title">FORGOT PASSWORD</h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', marginBottom: '25px', textAlign: 'center', fontFamily: 'Garet', lineHeight: '1.5' }}>
              Enter the email address registered to your account and we&apos;ll send you a verification code.
            </p>
            <form onSubmit={handleForgotSubmit} noValidate>
              <div className="input-wrapper">
                <div className={`input-group ${fieldErrors.resetEmail ? 'error' : ''}`}>
                  <svg className="input-icon" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                  <input
                    type="email"
                    value={formData.resetEmail}
                    onChange={(e) => setField('resetEmail', e.target.value)}
                    placeholder="Registered Email Address"
                    autoFocus
                  />
                </div>
                <span className="error-message">{fieldErrors.resetEmail}</span>
              </div>
              {error && <div className="form-error" style={{ color: '#dc3545', textAlign: 'center', fontSize: '14px', fontFamily: 'Garet' }}>{error}</div>}
              <button type="submit" className="submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Sending Code...' : 'SEND RESET CODE'}
              </button>
              <p className="toggle-form">
                <button type="button" className="toggle-link" onClick={goToLogin}>← Back to Login</button>
              </p>
            </form>
          </div>
        )}

        {/* ── RESET OTP — Step 2: Enter Code ── */}
        {mode === 'reset_otp' && (
          <div className="form-container active">
            <h2 className="form-title">ENTER CODE</h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', marginBottom: '8px', textAlign: 'center', fontFamily: 'Garet', lineHeight: '1.5' }}>
              We sent a 6-digit reset code to
            </p>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '15px', marginBottom: '28px', textAlign: 'center', fontFamily: 'Garet' }}>
              {otpEmail}
            </p>
            <OtpInput
              value={otpCode}
              onChange={(i, v) => handleOtpChange(i, v, resetOtpRefs)}
              onKeyDown={(i, e) => handleOtpKeyDown(i, e, resetOtpRefs)}
              onPaste={handleOtpPaste}
              refs={resetOtpRefs}
              hasError={!!otpError}
            />
            {otpError && (
              <p style={{ color: '#dc3545', textAlign: 'center', fontSize: '13px', fontFamily: 'Garet', marginBottom: '8px' }}>{otpError}</p>
            )}
            <ResendButton cooldown={resendCooldown} onResend={handleResendResetOtp} />
            <button
              type="button"
              className="submit-btn"
              onClick={handleResetOtpVerify}
              disabled={otpCode.join('').length < 6}
              style={{ opacity: otpCode.join('').length < 6 ? 0.6 : 1 }}
            >
              VERIFY CODE
            </button>
            <p className="toggle-form">
              <button type="button" className="toggle-link" onClick={() => { setMode('forgot_password'); setOtpError(''); }}>← Change Email</button>
            </p>
          </div>
        )}

        {/* ── RESET NEW PASSWORD — Step 3: Set New Password ── */}
        {mode === 'reset_new_password' && (
          <div className="form-container active">
            <h2 className="form-title">NEW PASSWORD</h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', marginBottom: '25px', textAlign: 'center', fontFamily: 'Garet', lineHeight: '1.5' }}>
              Create a new password for <strong>{otpEmail}</strong>.
            </p>
            <form onSubmit={handleResetNewPassword} noValidate>
              <div className="input-wrapper">
                <div className={`input-group ${fieldErrors.resetPassword ? 'error' : ''}`}>
                  <svg className="input-icon" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    value={formData.resetPassword}
                    onChange={(e) => setField('resetPassword', e.target.value)}
                    placeholder="New Password"
                    autoFocus
                  />
                  <button type="button" className="toggle-password" onClick={() => setShowResetPassword(!showResetPassword)}>
                    {showResetPassword ? <EyeOpen /> : <EyeOff />}
                  </button>
                </div>
                <span className="error-message">{fieldErrors.resetPassword}</span>
                <div className={`password-strength ${resetPasswordStrength.tone}`}>
                  <div className="password-strength-bar" aria-hidden="true"><span style={{ width: `${resetPasswordStrength.progress}%` }} /></div>
                  <span className="password-strength-text">{resetPasswordStrength.label}</span>
                  <span className="password-strength-rules">Required: 8+ characters, uppercase, lowercase, and a number.</span>
                </div>
              </div>

              <div className="input-wrapper">
                <div className={`input-group ${fieldErrors.confirmPassword ? 'error' : ''}`}>
                  <svg className="input-icon" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setField('confirmPassword', e.target.value)}
                    placeholder="Confirm New Password"
                  />
                  <button type="button" className="toggle-password" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOpen /> : <EyeOff />}
                  </button>
                </div>
                <span className="error-message">{fieldErrors.confirmPassword}</span>
              </div>

              {error && <div className="form-error" style={{ color: '#dc3545', textAlign: 'center', fontSize: '14px', fontFamily: 'Garet' }}>{error}</div>}
              <button type="submit" className="submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Resetting...' : 'RESET PASSWORD'}
              </button>
              <p className="toggle-form">
                <button type="button" className="toggle-link" onClick={() => { setMode('reset_otp'); setError(''); setFieldErrors({}); }}>← Back</button>
              </p>
            </form>
          </div>
        )}

        {/* ── SIGNUP OTP Verification ── */}
        {mode === 'verify_otp' && (
          <div className="form-container active">
            <h2 className="form-title">VERIFY EMAIL</h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', marginBottom: '8px', textAlign: 'center', fontFamily: 'Garet', lineHeight: '1.5' }}>
              We sent a 6-digit code to
            </p>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '15px', marginBottom: '28px', textAlign: 'center', fontFamily: 'Garet' }}>
              {otpEmail}
            </p>
            <OtpInput
              value={otpCode}
              onChange={(i, v) => handleOtpChange(i, v, signupOtpRefs)}
              onKeyDown={(i, e) => handleOtpKeyDown(i, e, signupOtpRefs)}
              onPaste={handleOtpPaste}
              refs={signupOtpRefs}
              hasError={!!otpError}
            />
            {otpError && (
              <p style={{ color: '#dc3545', textAlign: 'center', fontSize: '13px', fontFamily: 'Garet', marginBottom: '8px' }}>{otpError}</p>
            )}
            <ResendButton cooldown={resendCooldown} onResend={handleResendSignupOtp} />
            <button
              type="button"
              className="submit-btn"
              onClick={handleSignupOtpVerify}
              disabled={otpLoading || otpCode.join('').length < 6}
              style={{ opacity: otpCode.join('').length < 6 ? 0.6 : 1 }}
            >
              {otpLoading ? 'Verifying...' : 'VERIFY & CREATE ACCOUNT'}
            </button>
            <p className="toggle-form">
              <button type="button" className="toggle-link" onClick={goToSignup}>← Back to Sign Up</button>
            </p>
          </div>
        )}

        {/* ── LOGIN & SIGN UP ── */}
        {mode !== 'google_signup' && mode !== 'forgot_password' && mode !== 'reset_otp' && mode !== 'reset_new_password' && mode !== 'verify_otp' && (
          <>
            {/* LOGIN */}
            <div className={`form-container ${mode === 'login' ? 'active' : ''}`}>
              <h2 className="form-title">{isAdminMode ? 'ADMIN LOGIN' : 'LOGIN'}</h2>
              <form onSubmit={handleLoginSubmit} noValidate>
                <div className="input-wrapper">
                  <div className={`input-group ${fieldErrors.loginUsername ? 'error' : ''}`}>
                    <svg className="input-icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    <input type="text" value={formData.loginUsername} onChange={(e) => setField('loginUsername', e.target.value)} placeholder="Username" />
                  </div>
                  <span className="error-message">{fieldErrors.loginUsername}</span>
                </div>
                <div className="input-wrapper">
                  <div className={`input-group ${fieldErrors.loginPassword ? 'error' : ''}`}>
                    <svg className="input-icon" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                    <input type={showLoginPassword ? 'text' : 'password'} value={formData.loginPassword} onChange={(e) => setField('loginPassword', e.target.value)} placeholder="Password" />
                    <button type="button" className="toggle-password" onClick={() => setShowLoginPassword(!showLoginPassword)} aria-label={showLoginPassword ? 'Hide password' : 'Show password'}>
                      {showLoginPassword ? <EyeOpen /> : <EyeOff />}
                    </button>
                  </div>
                  <span className="error-message">{fieldErrors.loginPassword}</span>
                </div>
                <button
                  type="button"
                  className="forgot-password"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', color: '#000', fontWeight: 600, fontSize: '16px', alignSelf: 'flex-end', marginTop: '4px', marginBottom: '10px' }}
                  onClick={() => { setMode('forgot_password'); setError(''); setFieldErrors({}); setFormData((prev) => ({ ...prev, resetEmail: '' })); }}
                >
                  Forgot Password?
                </button>
                {error && <div className="form-error" style={{ color: '#dc3545', textAlign: 'center', fontSize: '14px', fontFamily: 'Garet' }}>{error}</div>}
                <button type="submit" className="submit-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Logging in...' : (isAdminMode ? 'ADMIN LOGIN' : 'LOGIN')}
                </button>
                {!isAdminMode && (
                  <p className="toggle-form">
                    Don&apos;t have an account?{' '}
                    <button type="button" className="toggle-link" onClick={goToSignup}>Sign Up</button>
                  </p>
                )}
              </form>
            </div>

            {/* SIGN UP */}
            {!isAdminMode && (
              <div className={`form-container ${mode === 'signup' ? 'active' : ''}`}>
                <h2 className="form-title">SIGN UP</h2>
                <form onSubmit={handleSignupSubmit} noValidate>
                  <div className="input-wrapper">
                    <div className={`input-group ${fieldErrors.signupUsername ? 'error' : ''}`}>
                      <svg className="input-icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                      <input type="text" value={formData.signupUsername} onChange={(e) => setField('signupUsername', e.target.value.slice(0, 11))} placeholder="Username" />
                    </div>
                    <span className="error-message">{fieldErrors.signupUsername}</span>
                    {usernameAvailability.message && <span className={`field-status ${usernameAvailability.status}`}>{usernameAvailability.message}</span>}
                  </div>
                  <div className="input-wrapper">
                    <div className={`input-group ${fieldErrors.signupContact ? 'error' : ''}`}>
                      <svg className="input-icon" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                      <input type="tel" inputMode="numeric" pattern="09[0-9]{9}" value={formData.signupContact} onChange={(e) => setField('signupContact', e.target.value)} placeholder="Contact Number (09XXXXXXXXX)" />
                    </div>
                    <span className="error-message">{fieldErrors.signupContact}</span>
                  </div>
                  <div className="input-wrapper">
                    <div className={`input-group ${fieldErrors.signupEmail ? 'error' : ''}`}>
                      <svg className="input-icon" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                      <input type="email" value={formData.signupEmail} onChange={(e) => setField('signupEmail', e.target.value)} placeholder="Email" />
                    </div>
                    <span className="error-message">{fieldErrors.signupEmail}</span>
                  </div>
                  <div className="input-wrapper">
                    <div className={`input-group ${fieldErrors.signupPassword ? 'error' : ''}`}>
                      <svg className="input-icon" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                      <input type={showSignupPassword ? 'text' : 'password'} value={formData.signupPassword} onChange={(e) => setField('signupPassword', e.target.value)} placeholder="Password" />
                      <button type="button" className="toggle-password" onClick={() => setShowSignupPassword(!showSignupPassword)} aria-label={showSignupPassword ? 'Hide password' : 'Show password'}>
                        {showSignupPassword ? <EyeOpen /> : <EyeOff />}
                      </button>
                    </div>
                    <span className="error-message">{fieldErrors.signupPassword}</span>
                    <div className={`password-strength ${signupPasswordStrength.tone}`}>
                      <div className="password-strength-bar" aria-hidden="true"><span style={{ width: `${signupPasswordStrength.progress}%` }} /></div>
                      <span className="password-strength-text">{signupPasswordStrength.label}</span>
                      <span className="password-strength-rules">Required: 8+ characters, uppercase, lowercase, and a number.</span>
                    </div>
                  </div>
                  {error && <div className="form-error" style={{ color: '#dc3545', textAlign: 'center', fontSize: '14px', fontFamily: 'Garet' }}>{error}</div>}
                  <button type="submit" className="submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending Code...' : 'SIGN UP'}
                  </button>
                  <p className="toggle-form">
                    Already have an account?{' '}
                    <button type="button" className="toggle-link" onClick={goToLogin}>Login</button>
                  </p>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
