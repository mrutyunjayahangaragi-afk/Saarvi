# Saarvi — Step-by-Step Vercel Deployment Guide for Private GitHub Repository
**Hosting Platform:** [Vercel](https://vercel.com) (Edge Network & Serverless Runtime)  
**Repository:** `git@github.com:mrutyunjayahangaragi-afk/Saarvi.git` (**PRIVATE**)  
**Production Domain:** `https://saarvi.app`  
**Framework:** Next.js (App Router, Turbopack)

> [!IMPORTANT]
> **Private Repository Guarantee**:
> The Saarvi GitHub repository is strictly **PRIVATE**. Vercel natively supports private GitHub repositories through its official GitHub App integration. You do **NOT** need to make the repository public, and you must **NEVER** create a public mirror.

---

## 1. Connecting Your Private GitHub Repository to Vercel

1. Log in to your [Vercel Dashboard](https://vercel.com) using your GitHub account (`mrutyunjayahangaragi-afk`).
2. On your dashboard, click **Add New...** -> **Project**.
3. Under **Import Git Repository**, if `mrutyunjayahangaragi-afk/Saarvi` is not immediately listed:
   - Click **Adjust GitHub App Permissions** or the GitHub account dropdown.
   - In the GitHub authorization dialog, select **Only select repositories** and pick `mrutyunjayahangaragi-afk/Saarvi` (or select **All repositories**).
   - Click **Save** / **Authorize**.
4. Once authorized, locate the private repository **`mrutyunjayahangaragi-afk/Saarvi`** in the list (marked with a lock icon 🔒 indicating it is private).
5. Click the blue **Import** button next to it.

---

## 2. Project Build & Runtime Settings

Vercel will automatically detect Next.js. Verify the following parameters:
- **Framework Preset**: `Next.js`
- **Root Directory**: `./` (default)
- **Build Command**: `next build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (or `npm ci`, default)
- **Node.js Version**: In Vercel Project Settings -> General -> Node.js Version, confirm `20.x` is selected (aligned with `package.json` `"engines": { "node": ">=20.0.0" }`).

---

## 3. Environment Variable Configuration

Expand the **Environment Variables** accordion before clicking Deploy. Populate the variables from `.env.example`:

### A. Public Client Variables (Select: Production, Preview, Development)
| Variable Name | Production Value | Preview Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | `https://saarvi.app` | `https://$VERCEL_URL` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[PROJECT].supabase.co` | `https://[PROJECT].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| `[SUPABASE_ANON_KEY]` | `[SUPABASE_ANON_KEY]` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `rzp_live_[KEY_ID]` | `rzp_test_[KEY_ID]` |

### B. Server-Only Secrets (Select: Production only)
| Variable Name | Environment | Purpose / Notes |
| :--- | :--- | :--- |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Server-side user administration |
| `BILLING_PROVIDER` | Production (`razorpay`) / Preview (`sandbox` or test) | Payment processor |
| `RAZORPAY_KEY_ID` | Production (`rzp_live_...`) | Live payment key |
| `RAZORPAY_KEY_SECRET` | Production | Live payment secret |
| `RAZORPAY_WEBHOOK_SECRET` | Production | Webhook signature verification |
| `RAZORPAY_PRO_MONTHLY_PLAN_ID`| Production (`plan_...`) | ₹99 Monthly subscription |
| `RAZORPAY_PRO_YEARLY_PLAN_ID` | Production (`plan_...`) | ₹899 Yearly subscription |
| `EMAIL_PROVIDER` | Production (`gmail`) | Transactional email |
| `SMTP_HOST` | Production (`smtp.gmail.com`) | Gmail SMTP host |
| `SMTP_PORT` | Production (`465`) | SSL/TLS port |
| `SMTP_SECURE` | Production (`true`) | Secure flag |
| `SMTP_USER` | Production (`notifications@saarvi.app`) | Gmail address |
| `SMTP_PASS` | Production (`[16_CHAR_APP_PASSWORD]`) | Google App Password |
| `EMAIL_FROM_EMAIL` | Production (`notifications@saarvi.app`) | Sender address |
| `EMAIL_FROM_NAME` | Production (`Saarvi`) | Sender name |
| `CRON_SECRET` | Production & Preview | 32-character random string for Vercel Cron |
| `AI_PROVIDER` | Production (`gemini`) | Gemini 1.5 Flash |
| `AI_API_KEY` | Production | Gemini API Key |
| `OCR_PROVIDER` | Production (`gemini`) | Vision OCR |
| `OCR_API_KEY` | Production | Gemini API Key |

> [!CAUTION]
> **Zero Exposure Rule**: Never prefix `SMTP_PASS`, `RAZORPAY_KEY_SECRET`, `AI_API_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`. Keep them strictly server-only.

---

## 4. Trigger Initial Deployment

1. Click **Deploy**.
2. Vercel will securely fetch the code from the private GitHub repository, run the build pipeline, and generate a live preview deployment.
3. Verify that the build log completes with `✓ Compiled successfully`.

---

## 5. Add Custom Domain (`saarvi.app`)

1. In your Vercel Project Dashboard, navigate to **Settings** -> **Domains**.
2. Enter `saarvi.app` and click **Add**.
3. Select **Add saarvi.app and redirect www.saarvi.app to it**.
4. Note the exact DNS records displayed:
   - **Apex (`@`)**: `A` record -> `76.76.21.21`
   - **Subdomain (`www`)**: `CNAME` record -> `cname.vercel-dns.com.`

---

## 6. Configure DNS at Domain Registrar

Log in to your domain registrar (Cloudflare, Namecheap, GoDaddy, Google Domains, etc.):
1. Add an **A Record**:
   - Name: `@` (or `saarvi.app`)
   - Value: `76.76.21.21`
   - TTL: Automatic / 300s
2. Add a **CNAME Record**:
   - Name: `www`
   - Value: `cname.vercel-dns.com.`
   - TTL: Automatic / 300s
3. Wait 2–15 minutes. Vercel will verify resolution and issue an automated SSL certificate.

---

## 7. Update External Provider Whitelists

### A. Google Cloud Console
1. Open [Google Cloud Console](https://console.cloud.google.com) -> **APIs & Services** -> **Credentials**.
2. Edit your Web Application OAuth 2.0 Client:
   - **Authorized JavaScript Origins**: Add `https://saarvi.app`
   - **Authorized Redirect URIs**: Ensure `https://[SUPABASE_PROJECT].supabase.co/auth/v1/callback` is present.

### B. Supabase Dashboard
1. Open [Supabase Dashboard](https://supabase.com/dashboard) -> **Authentication** -> **URL Configuration**.
2. Set **Site URL**: `https://saarvi.app`.
3. In **Redirect URLs**, whitelist:
   - `https://saarvi.app/auth/callback`
   - `https://saarvi.app/reset-password`
   - `https://saarvi.app/dashboard`

---

## 8. Post-Deployment Verification & Smoke Test

Once `https://saarvi.app` resolves:
```bash
# 1. Verify health endpoint
curl -s -i https://saarvi.app/api/health

# 2. Check public routes (must return HTTP 200)
curl -s -o /dev/null -w "%{http_code}\n" https://saarvi.app/
curl -s -o /dev/null -w "%{http_code}\n" https://saarvi.app/pricing
curl -s -o /dev/null -w "%{http_code}\n" https://saarvi.app/student
curl -s -o /dev/null -w "%{http_code}\n" https://saarvi.app/tools
```

Open `https://saarvi.app` in your browser and complete:
1. Google Sign-In (`select_account` account chooser).
2. Test one local document tool (e.g., `/tools/jpg-to-pdf`) — verify 3-second auto-download runs once.
3. Test VTU SGPA calculator — verify calculations run offline in client memory.
4. Verify `/admin` route is protected from unauthenticated access.
