# Saarvi — Google Authentication Setup Guide
**Saarvi — Study. Work. Grow.**

This document provides complete, production-grade instructions for configuring Google OAuth authentication in Saarvi using Supabase Auth.

---

## 1. Saarvi Google Authentication Overview

Saarvi offers seamless, secure authentication through two primary methods:
1. **Email + Password**
2. **Continue with Google** (Google OAuth 2.0 via Supabase Auth)

### Architecture Principles
- **Authentication Engine**: Handled securely via Supabase Auth (`@supabase/ssr`).
- **Authorization & Role Integrity**: All authenticated Google accounts are assigned the standard `USER` role by default. Administrative (`ADMIN` / `SUPER_ADMIN`) or tier (`PRO`) privileges are never granted based on OAuth claims, emails, or domains.
- **Local-First Privacy**: Private student and document workspaces reside inside the browser's IndexedDB. Authenticating with Google never uploads local documents, resumes, calculations, or conversations to the cloud.

---

## 2. Prerequisites

Before configuring Google OAuth, ensure you have:
1. Access to the [Google Cloud Console](https://console.cloud.google.com/).
2. Access to your [Supabase Project Dashboard](https://supabase.com/dashboard).
3. A deployed or local instance of Saarvi:
   - **Local Development**: `http://localhost:3000`
   - **Official Production Domain**: `https://saarvi.app`

---

## 3. Google Cloud Setup

### Step 3.1: Create or Select a Project
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select an existing project or create a new project named **Saarvi Platform**.

### Step 3.2: Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**.
2. Select **External** user type and click **Create**.
3. Fill in the required application details:
   - **App name**: `Saarvi`
   - **User support email**: `support@saarvi.app`
   - **App logo**: Upload `public/brand/saarvi-logo.png`
   - **Application home page**: `https://saarvi.app`
   - **Application privacy policy link**: `https://saarvi.app/privacy`
   - **Application terms of service link**: `https://saarvi.app/terms`
   - **Authorized domains**:
     - `saarvi.app`
     - `supabase.co`
   - **Developer contact information**: `admin@saarvi.app`
4. Click **Save and Continue**.
5. Under **Scopes**, add standard user profile scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
6. Complete the consent screen configuration and submit for verification if required for public usage.

### Step 3.3: Create OAuth 2.0 Client Credentials
1. Go to **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. Select **Application type**: **Web application**.
4. Set **Name**: `Saarvi Web Client`.
5. **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - `https://saarvi.app`
6. **Authorized redirect URIs**:
   - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
   *(Replace `<YOUR_SUPABASE_PROJECT_REF>` with your actual Supabase reference ID found in your Supabase dashboard settings)*.
7. Click **Create**.
8. Copy the generated **Client ID** and **Client Secret**.

> [!WARNING]
> Never commit or expose your Google Client Secret in source code, client bundles, or frontend environment variables.

---

## 4. Supabase Setup

### Step 4.1: Enable Google Provider
1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your Saarvi project.
3. In the left navigation, go to **Authentication** → **Providers**.
4. Locate **Google** in the provider list and toggle it to **Enabled**.
5. Enter the credentials obtained from Google Cloud Console:
   - **Client ID**: Paste your Google OAuth Client ID.
   - **Client Secret**: Paste your Google OAuth Client Secret.
6. Click **Save**.

### Step 4.2: Configure URL Configuration in Supabase
1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**.
2. Set **Site URL**:
   - For Production: `https://saarvi.app`
   - For Local Dev: `http://localhost:3000`
3. Under **Redirect URLs**, add all allowed application callback destinations:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/dashboard`
   - `https://saarvi.app/auth/callback`
   - `https://saarvi.app/dashboard`
4. Save your changes.

---

## 5. Redirect URI Architecture

The OAuth redirect lifecycle flows securely through the following hops:

```
User clicks "Continue with Google"
  │
  ▼
Supabase Client (Browser)
  │  Initiates OAuth via supabase.auth.signInWithOAuth({
  │    provider: 'google',
  │    options: {
  │      redirectTo: 'https://saarvi.app/auth/callback?next=/dashboard',
  │      queryParams: { prompt: 'select_account' }
  │    }
  │  })
  ▼
Google OAuth Consent Screen (accounts.google.com)
  │  User approves authentication
  ▼
Supabase Auth Engine Callback
  │  https://<PROJECT-REF>.supabase.co/auth/v1/callback
  │  Supabase exchanges Google authorization code for Supabase JWT session
  ▼
Saarvi Application Callback Endpoint
  │  https://saarvi.app/auth/callback?code=<AUTH_CODE>&next=/dashboard
  │  (or http://localhost:3000/auth/callback)
  ▼
Next.js Route Handler (src/app/auth/callback/route.ts)
  │  1. Validates and sanitizes internal `next` destination (SSRF & open-redirect defense)
  │  2. Handles user cancellation / provider error codes gracefully
  │  3. Exchanges session cookies via createServerClient()
  ▼
Authenticated Destination (/dashboard)
```

---

## 6. Localhost Configuration

For local development and testing:
1. Ensure your local server runs on port 3000:
   ```bash
   npm run dev
   ```
2. Set the redirect URI in your Supabase Auth settings to include `http://localhost:3000/auth/callback`.
3. In Google Cloud Console, ensure Authorized JavaScript origins includes `http://localhost:3000`.
4. When testing offline or without live Supabase credentials, Saarvi automatically operates in resilient local development mode using `MockStorageProvider`, allowing complete testing of Google authentication flows without external network dependencies.

---

## 7. Production Configuration

1. **Domain**: The official production domain is `https://saarvi.app`.
2. **Reverse Proxy / CDN**: If running behind a reverse proxy (e.g. Vercel, Cloudflare), ensure `x-forwarded-host` is passed. The auth callback route handler verifies forwarded hosts against allowed domain allowlists (`saarvi.app`, `www.saarvi.app`).
3. **HTTPS Enforcement**: Production redirects strictly require HTTPS.

---

## 8. Environment Configuration

### Client-Accessible Variables (`.env.local` / Production Environment)
Only public anon keys and URLs are exposed to the browser:

```bash
# Public Supabase Connection
NEXT_PUBLIC_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_PUBLIC_ANON_KEY>
```

### Prohibited Variables
The following variable patterns are **strictly prohibited** in frontend environments:
- `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET` (Forbidden)
- `NEXT_PUBLIC_GOOGLE_SECRET` (Forbidden)
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (Forbidden)

All Google OAuth secrets remain solely within the Supabase Auth backend configuration.

---

## 9. Security Rules

1. **Open Redirect Defense**:
   All redirect parameters (`next`, `returnTo`) are sanitized using `sanitizeInternalRedirectUrl()`. External URLs (`https://evil.example`), scheme attacks (`javascript:`, `data:`, `vbscript:`), protocol-relative paths (`//evil.com`), and backslash escapes (`/\\evil.com`) are rejected and mapped to `/dashboard`.
2. **Untrusted Client Claims**:
   Client-provided `userId`, `userEmail`, or `role` parameters are never trusted by server route handlers. User identity is derived strictly from server-validated Supabase session cookies.
3. **Non-Elevation of Privileges**:
   Signing in with a Google account never grants administrative or billing tier elevations. Roles are maintained server-side.
4. **Credential Redaction**:
   OAuth tokens, provider secrets, and passwords are fully stripped from client logs, telemetry ring buffers, and analytics events.

---

## 10. Testing

Run the automated test suite to verify Google OAuth functionality and security invariants:

```bash
# Run Google OAuth specific test suite
node --test tests/google-auth.test.mjs

# Run full project test regression suite
npm test

# Run TypeScript compilation verification
npx tsc --noEmit
```

### Verification Criteria
- Google login action exists on `/login` and `/signup`.
- Provider is strictly `"google"`.
- Open redirects and malicious schemes are rejected.
- Logout and session cleanup execute cleanly.
- Touch targets meet WCAG 2.1 AA (min 44px height).
- No prohibited secrets are present in client bundles.

---

## 11. Troubleshooting

### Issue: Error 400: `redirect_uri_mismatch` in Google Screen
- **Cause**: The redirect URI configured in Google Cloud Console does not match Supabase's callback URL.
- **Fix**: Check that Google Cloud Console → Authorized redirect URIs includes `https://<PROJECT-REF>.supabase.co/auth/v1/callback` exactly.

### Issue: `Invalid or expired authentication link`
- **Cause**: The PKCE code exchange expired, or the user refreshed an already-consumed callback link.
- **Fix**: Direct the user to initiate sign-in again from `/login`.

### Issue: User cancelled authentication
- **Behavior**: Handled gracefully. Saarvi captures `error=access_denied` and safely returns the user to the login screen with the message `"Google authentication was cancelled."`.

---

## 12. Account-Switching Behavior

When switching accounts:
1. When User A clicks **Logout**, `supabase.auth.signOut()` clears session cookies and resets the local active session.
2. When User B signs in via Google:
   - A fresh session is established for User B.
   - User B's profile is initialized or retrieved idempotently.
   - Local workspace data in IndexedDB remains scoped strictly to the authenticated profile identity, preventing cross-user data leakage.

---

## 13. Local-First Privacy Behavior

Saarvi operates on a **Local-First Workspace Architecture**:
- All private student records (resumes, cover letters, SGPA/CGPA marks, attendance records, study plans, timetable entries, and private notes) remain inside the client-side IndexedDB.
- Authenticating with Google only validates user identity with Supabase Auth.
- **Zero background synchronization**: Signing in with Google does **not** upload your local documents, PDFs, or private student data to cloud storage or remote servers.
