# Saarvi — Step-by-Step Vercel Deployment & Setup Guide
**Hosting Service:** [Vercel](https://vercel.com)  
**Repository:** `git@github.com:mrutyunjayahangaragi-afk/Saarvi.git`  
**Production Canonical Domain:** `https://saarvi.app`  
**Framework:** Next.js (App Router, Turbopack)

This guide provides exact, step-by-step instructions for importing, configuring, and deploying Saarvi to Vercel with custom domain routing and environment separation.

---

## Step 1: Log in to Vercel
1. Go to [https://vercel.com](https://vercel.com) and sign in using your GitHub account (`mrutyunjayahangaragi-afk`).

---

## Step 2: Add New Project
1. On your Vercel Dashboard overview, click the **Add New...** dropdown button in the top-right corner.
2. Select **Project**.

---

## Step 3: Import GitHub Repository
1. Under **Import Git Repository**, locate `mrutyunjayahangaragi-afk/Saarvi`.
2. Click the **Import** button next to the repository.

---

## Step 4: Configure Project Settings
1. **Project Name**: Enter `saarvi` (or keep `smart-doc-platform`).
2. **Framework Preset**: Verify it detects **Next.js**.
3. **Root Directory**: Leave as `./` (default).
4. **Build Command**: Leave as default (`next build`).
5. **Output Directory**: Leave as default (`.next`).
6. **Install Command**: Leave as default (`npm install` or `npm ci`).

---

## Step 5: Configure Environment Variables in Vercel
Expand the **Environment Variables** section in the project setup screen. Add the required variables based on `.env.example`:

### Public Variables (Select: Production, Preview, Development)
- `NEXT_PUBLIC_APP_URL` = `https://saarvi.app`
- `NEXT_PUBLIC_SUPABASE_URL` = `https://[YOUR_SUPABASE_PROJECT].supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `[YOUR_SUPABASE_ANON_KEY]`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` = `rzp_live_[YOUR_KEY_ID]` (for Production) / `rzp_test_[KEY_ID]` (for Preview)

### Server-Only Secrets (Select: Production only)
- `SUPABASE_SERVICE_ROLE_KEY` = `[YOUR_SUPABASE_SERVICE_ROLE_KEY]`
- `BILLING_PROVIDER` = `razorpay`
- `RAZORPAY_KEY_ID` = `rzp_live_[YOUR_KEY_ID]`
- `RAZORPAY_KEY_SECRET` = `[YOUR_RAZORPAY_KEY_SECRET]`
- `RAZORPAY_WEBHOOK_SECRET` = `[YOUR_WEBHOOK_SECRET]`
- `RAZORPAY_PRO_MONTHLY_PLAN_ID` = `plan_[MONTHLY_99_PLAN_ID]`
- `RAZORPAY_PRO_YEARLY_PLAN_ID` = `plan_[YEARLY_899_PLAN_ID]`
- `EMAIL_PROVIDER` = `gmail`
- `SMTP_HOST` = `smtp.gmail.com`
- `SMTP_PORT` = `465`
- `SMTP_SECURE` = `true`
- `SMTP_USER` = `notifications@saarvi.app`
- `SMTP_PASS` = `[16_CHARACTER_GOOGLE_APP_PASSWORD]`
- `EMAIL_FROM_EMAIL` = `notifications@saarvi.app`
- `EMAIL_FROM_NAME` = `Saarvi`
- `CRON_SECRET` = `[GENERATE_RANDOM_32_CHAR_STRING]`
- `AI_PROVIDER` = `gemini`
- `AI_API_KEY` = `[YOUR_GEMINI_API_KEY]`
- `OCR_PROVIDER` = `gemini`
- `OCR_API_KEY` = `[YOUR_GEMINI_API_KEY]`

---

## Step 6: Initial Deployment
1. Click **Deploy**.
2. Vercel will clone the `main` branch, run `npm install`, compile the Next.js build, and assign a temporary preview URL (e.g. `saarvi-git-main-...vercel.app`).
3. Verify the deployment build log finishes with `✓ Compiled successfully`.

---

## Step 7: Add Custom Domain (`saarvi.app`)
1. In your Vercel Project Dashboard, navigate to **Settings** -> **Domains**.
2. Enter `saarvi.app` in the domain field and click **Add**.
3. Select the recommended option: **Add saarvi.app and redirect www.saarvi.app to it** (or vice versa).
4. Vercel will display the exact DNS configuration required.

---

## Step 8: Configure DNS at Domain Registrar
Log in to the DNS management portal at your domain registrar (e.g. Cloudflare, Namecheap, GoDaddy):

1. **Apex Domain (`saarvi.app`)**:
   - **Type**: `A`
   - **Name**: `@`
   - **Value**: `76.76.21.21` (Vercel Anycast Edge IP)
2. **Subdomain (`www.saarvi.app`)**:
   - **Type**: `CNAME`
   - **Name**: `www`
   - **Value**: `cname.vercel-dns.com.`

*Wait 2–15 minutes for global DNS propagation. Vercel will automatically provision a free Let's Encrypt / DigiCert SSL certificate.*

---

## Step 9: Configure Google OAuth for Vercel
1. Open [Google Cloud Console](https://console.cloud.google.com) -> **APIs & Services** -> **Credentials**.
2. Select your OAuth 2.0 Client ID for Web Application.
3. In **Authorized JavaScript Origins**, add:
   - `https://saarvi.app`
4. In **Authorized Redirect URIs**, verify:
   - `https://[YOUR_SUPABASE_PROJECT].supabase.co/auth/v1/callback`

---

## Step 10: Configure Supabase Auth Site URL
1. Open [Supabase Dashboard](https://supabase.com/dashboard) -> **Authentication** -> **URL Configuration**.
2. Set **Site URL**: `https://saarvi.app`.
3. In **Redirect URLs**, ensure:
   - `https://saarvi.app/auth/callback`
   - `https://saarvi.app/reset-password`
   - `https://saarvi.app/dashboard`

---

## Step 11: Production Verification & Smoke Test
Once the domain resolves, run:
```bash
# 1. Probe health endpoint
curl -s -i https://saarvi.app/api/health

# 2. Check public routes
curl -s -o /dev/null -w "%{http_code}\n" https://saarvi.app/
curl -s -o /dev/null -w "%{http_code}\n" https://saarvi.app/pricing
curl -s -o /dev/null -w "%{http_code}\n" https://saarvi.app/student
curl -s -o /dev/null -w "%{http_code}\n" https://saarvi.app/tools
```
All should return `HTTP 200 OK`.
Test Google OAuth login on the live site using `Continue with Google`.
