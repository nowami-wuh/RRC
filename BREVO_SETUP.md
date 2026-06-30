# Brevo Email OTP Integration Guide

This project uses **Brevo** (formerly Sendinblue) for sending transactional emails and OTP codes. Brevo's HTTP API bypasses cloud provider firewall restrictions on SMTP ports (465/587), making it ideal for serverless platforms like Render, Vercel, and Heroku.

## Why Brevo?

- ✅ **Free tier**: 300 emails/day (perfect for startups)
- ✅ **No domain verification required**: Verify your Gmail address and send to anyone
- ✅ **Bypass firewall restrictions**: Uses HTTPS (Port 443) instead of blocked SMTP ports
- ✅ **Easy integration**: REST API with native `fetch()` (no heavy dependencies)

## Setup Steps

### 1. Create a Brevo Account

1. Go to [brevo.com](https://www.brevo.com/) and click **Sign Up**
2. Fill in your details and complete the registration
3. Verify your email address

### 2. Configure Sender Email

1. Log in to your Brevo dashboard
2. During setup, Brevo will ask you to add a **Sender Email**
3. Enter your Gmail address (e.g., `your-email@gmail.com`)
4. Brevo will send you a verification email with a confirmation link
5. Click the link to verify you own this email address

> **Important**: The verified sender email is what your users will see as the "From" address in OTP and notification emails.

### 3. Generate API Key

1. In your Brevo dashboard, click your **profile icon** (top-right corner)
2. Select **SMTP & API** from the dropdown
3. Go to the **API Keys** tab
4. Click **Generate a new API key**
5. Give it a name (e.g., `RRC-API`)
6. Copy the generated key (starts with `xkeysib-`)

### 4. Set Environment Variables

#### Local Development

Create a `.env` file in the `server/` directory:

```env
BREVO_API_KEY=xkeysib-your-generated-api-key-here
EMAIL_USER=your-verified-email@gmail.com
```

#### Production (Render, Vercel, etc.)

1. Go to your hosting dashboard
2. Add environment variables:
   - `BREVO_API_KEY`: Your Brevo API key
   - `EMAIL_USER`: Your verified sender email

For **Render**:
- Dashboard → Environment → Add Variable
- Add both `BREVO_API_KEY` and `EMAIL_USER`
- Redeploy your app

For **Vercel**:
- Project Settings → Environment Variables
- Add both variables for Production, Preview, and Development

## How It Works

### OTP/Verification Email Flow

1. **User initiates signup/password reset**
   ```
   POST /api/auth/signup-initiate
   POST /api/auth/reset-initiate
   ```

2. **Server generates 6-digit OTP code**
   ```javascript
   const code = Math.floor(100000 + Math.random() * 900000).toString();
   ```

3. **OTP sent via Brevo HTTP API**
   - The `sendVerificationEmail()` function calls `sendMail()`
   - `sendMail()` sends a POST request to `https://api.brevo.com/v3/smtp/email`
   - Headers include: `api-key: ${BREVO_API_KEY}`

4. **User receives OTP email** (expires in 10 minutes)

5. **User submits OTP to verify**
   ```
   POST /api/auth/signup-verify
   POST /api/auth/reset-verify
   ```

### File Locations

- **Email utilities**: [server/mailer.js](server/mailer.js)
  - `sendMail()` - Low-level Brevo API call
  - `sendVerificationEmail()` - OTP template
  - `verifyMailer()` - Validates API key at startup

- **Auth routes**: [server/routes/auth.js](server/routes/auth.js)
  - `/signup-initiate` - Generate and send OTP
  - `/signup-verify` - Verify OTP and create account
  - `/reset-initiate` - Initiate password reset
  - `/reset-verify` - Verify OTP and reset password

## Email Templates

### OTP Verification Email

Sent when user initiates signup or password reset:

```html
Subject: RRC Lights & Sounds – Email Verification Code

Your verification code is: 123456

This code will expire in 10 minutes.
```

The email contains:
- 6-digit OTP code (large, bold text)
- Expiration time (10 minutes)
- RRC branding

### Welcome Confirmation Email

Sent after account is created:

```html
Subject: RRC Lights & Sounds – Welcome to RRC, [username]!

Your account has been successfully created using this email address.
You can now log in anytime and submit equipment or booking requests.
```

## Troubleshooting

### "BREVO_API_KEY is not set"

**Local development**: Create `server/.env` with `BREVO_API_KEY` and `EMAIL_USER`

**Production**: Add environment variables to your hosting platform's dashboard

### Emails not sending in production

1. Verify `BREVO_API_KEY` is correctly set in your hosting platform
2. Check server logs for errors (look for `[EMAIL]` prefix)
3. Ensure `EMAIL_USER` is set and matches a verified email in Brevo

### Testing locally without Brevo

If `BREVO_API_KEY` is not set and `NODE_ENV !== 'production'`:
- Emails are logged to console instead
- Look for lines starting with `[EMAIL MOCK]`
- This is perfect for local development

### Check Brevo Account Status

1. Log in to Brevo dashboard
2. Verify your sender email is **Verified** (green checkmark)
3. Check your API usage under **Account > Usage**

## API Endpoint Reference

**Brevo Transactional Email API**

```
POST https://api.brevo.com/v3/smtp/email
```

**Required Headers:**
- `Content-Type: application/json`
- `api-key: ${BREVO_API_KEY}`

**Request Body:**
```json
{
  "sender": {
    "name": "RRC Lights & Sounds",
    "email": "your-verified-email@gmail.com"
  },
  "to": [
    {
      "email": "recipient@example.com"
    }
  ],
  "subject": "Your OTP Code",
  "htmlContent": "<h1>123456</h1>"
}
```

**Success Response** (201):
```json
{
  "messageId": "<12345.abcd@brevo.com>"
}
```

## Further Resources

- [Brevo Documentation](https://developers.brevo.com/)
- [Brevo API Reference](https://developers.brevo.com/reference/getemailcampaigns)
- [Original Article: Bypass Cloud SMTP Restrictions](https://www.freecodecamp.org/news/how-to-bypass-cloud-smtp-restrictions-using-brevo-and-http-apis/)

## Support

For issues with Brevo:
- Visit [brevo.com support](https://www.brevo.com/support/)
- Check API status at [Brevo Status Page](https://status.brevo.com/)

For issues with RRC app integration:
- Check server logs for `[EMAIL]` error messages
- Verify `.env` variables are set correctly
- Test the endpoint: `POST /api/auth/signup-initiate`
