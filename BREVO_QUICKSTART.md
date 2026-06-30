# ✅ Brevo OTP Integration - Quick Start

## Status: FULLY INTEGRATED

Your project already had Brevo OTP integration implemented! Here's what's in place and what you need to do to activate it.

## 🎯 What's Already Built

| Feature | Location | Status |
|---------|----------|--------|
| Brevo HTTP API integration | `server/mailer.js` | ✅ Complete |
| OTP generation & sending | `server/routes/auth.js` | ✅ Complete |
| Email templates | `server/mailer.js` | ✅ Complete |
| API key verification | `server/mailer.js:verifyMailer()` | ✅ Complete |
| Console fallback (local dev) | `server/mailer.js` | ✅ Complete |

## 🚀 Activation Steps

### Step 1: Get Brevo API Key (5 minutes)
1. Go to [brevo.com](https://www.brevo.com) and sign up
2. Verify your email address
3. Go to **SMTP & API** → **API Keys** → **Generate new API key**
4. Copy your API key (starts with `xkeysib-`)

### Step 2: Create `.env` File

Create `server/.env`:
```env
BREVO_API_KEY=xkeysib-your-api-key-here
EMAIL_USER=your-verified-email@gmail.com
```

### Step 3: Test Locally
```bash
cd server
npm install  # removes nodemailer, keeps everything else
npm run dev
```

Look for this in the logs:
```
[EMAIL] ✅ Brevo API key verified. Account: your-email@gmail.com
```

## 📧 OTP Endpoints

### User Signs Up with OTP

**1. Initiate signup**
```bash
POST /api/auth/signup-initiate
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "contact": "09123456789",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent to your email."
}
```

**User receives email:**
```
Subject: RRC Lights & Sounds – Email Verification Code

Your verification code is: 123456

This code will expire in 10 minutes.
```

**2. Verify OTP and create account**
```bash
POST /api/auth/signup-verify
Content-Type: application/json

{
  "email": "john@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "user": {
    "id": "RRC-123456",
    "username": "john_doe",
    "email": "john@example.com",
    "phone": "09123456789",
    "role": "customer"
  }
}
```

### Password Reset with OTP

**1. Initiate password reset**
```bash
POST /api/auth/reset-initiate
Content-Type: application/json

{
  "email": "john@example.com"
}
```

**2. Verify OTP and reset password**
```bash
POST /api/auth/reset-verify
Content-Type: application/json

{
  "email": "john@example.com",
  "code": "123456",
  "password": "NewPassword123"
}
```

## 🏗️ Production Deployment

### On Render
1. Go to **Environment** in your app settings
2. Add two environment variables:
   - `BREVO_API_KEY`: Your API key
   - `EMAIL_USER`: Your verified sender email
3. Redeploy

### On Vercel
1. Go to **Project Settings** → **Environment Variables**
2. Add for Production, Preview, and Development:
   - `BREVO_API_KEY`
   - `EMAIL_USER`
3. Redeploy

### Verify in Production
Check your deployment logs for:
```
[EMAIL] ✅ Brevo API key verified. Account: your-email@gmail.com
```

## 🔧 What Was Updated

✅ **`.env.example`** - Updated with Brevo configuration  
✅ **`server/package.json`** - Removed unused nodemailer dependency  
✅ **`server/index.js`** - Updated startup logs to show Brevo status  
✅ **`BREVO_SETUP.md`** - Created comprehensive setup guide  

## 📖 Documentation

For detailed information, see [BREVO_SETUP.md](BREVO_SETUP.md) which includes:
- Why Brevo (SMTP bypass, no domain verification)
- Step-by-step setup with screenshots
- Email template details
- Troubleshooting guide
- API reference

## ⚡ Local Development

### Without BREVO_API_KEY (for testing without sending real emails)

If `BREVO_API_KEY` is not set and `NODE_ENV !== 'production'`:
- Emails are logged to console instead
- Look for lines starting with `[EMAIL MOCK]`
- Perfect for frontend testing without sending emails

### Enable Email Verification Bypass
```env
SKIP_EMAIL_VERIFICATION=true
```
Users can signup without verifying email (good for testing).

## ❓ Common Issues

### "BREVO_API_KEY is not set"
→ Create `.env` file with `BREVO_API_KEY` and `EMAIL_USER`

### Emails not sending in production
→ Verify variables are set in your hosting dashboard (Render/Vercel)

### Email verification expiring too fast
→ Default expiration is 10 minutes (configurable in `server/mailer.js`)

## 📞 Support

For issues:
1. Check [BREVO_SETUP.md](BREVO_SETUP.md) troubleshooting section
2. Verify `BREVO_API_KEY` at [brevo.com](https://www.brevo.com) dashboard
3. Check server logs for `[EMAIL]` error messages

## 🎉 You're All Set!

Your Brevo OTP integration is ready. Just add the environment variables and start receiving OTP emails for signup and password reset!
