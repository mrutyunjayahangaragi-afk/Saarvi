# Saarvi — Study. Work. Grow.

**Canonical Production URL:** [https://saarvi.app](https://saarvi.app)  
**Philosophy:** Private by design. Fast by design. Simple by design.  
**Pricing:** Free tier (₹0) and Saarvi Pro (₹99/month, ₹899/year).

---

## Overview

**Saarvi** is a modern, privacy-first productivity and academic intelligence workspace tailored for students and professionals. Built around a **local-first architecture**, Saarvi processes documents, academic marksheets, course timetables, and career portfolios directly within client browser memory—ensuring that personal notes, grades, and confidential files never leave the user's device without explicit consent.

---

## Core Principles

1. **Private by Design**: Student workspace data (notes, course marks, SGPA/CGPA calculations, timetables, and resume drafts) is stored locally in client-side `IndexedDB`. There is zero automatic cloud synchronization of private workspace files.
2. **Fast by Design**: Document conversions and academic derivations leverage client-side WebAssembly and deterministic algorithms, eliminating unnecessary server round-trips.
3. **Simple by Design**: A clean, accessible interface with zero intrusive tracking, no third-party advertising cookies, and deterministic workflows.

---

## Major Capabilities

### 1. Document Utilities (Local WebAssembly & In-Memory)
- **PDF Operations**: Merge, split, compress, rotate, reorder, and watermark PDF documents.
- **Image Conversion**: In-memory lossless conversions between JPG, PNG, and WebP.
- **Auto-Download Safeguard**: Single automatic download with a 3-second visual countdown and manual download fallback.

### 2. Academic Intelligence Suite (VTU & Engineering)
- **Deterministic SGPA / CGPA Engine**: Strict implementation of official university cutoffs and grade points (including VTU 2022 and 2021 schemes) with zero external network dependencies.
- **Marks & Percentage Converters**: Automatic validation of CIE and SEE marks, passing rules, and credit distributions.
- **Class Timetable & Conflict Detector**: $O(N \log N)$ interval-overlap conflict detection for scheduling lecture slots.
- **Academic Dashboard**: Visual tracking of subject credits, semester trends, and attendance requirements.

### 3. Career & Portfolio Suite
- **ATS-Optimized Resume Builder**: Clean ATS-compliant templates rendered via PDF-Lib and exported locally.
- **Job & Internship Tracker**: Kanban-style application management with deadline notifications.
- **Cover Letter Generator**: Local templates for student internship and placement applications.
- **Interview Preparation**: Self-paced interview Q&A and technical skill benchmarking.

### 4. Decoupled AI & OCR Intelligence (Optional with Consent)
- **Consent-First Processing**: Explicit confirmation required before transmitting any text or image chunk to server-side AI endpoints.
- **Document Summaries & Q&A**: Context-grounded analysis of study material using Gemini 1.5 Flash.
- **Graceful Degradation**: If external AI or OCR providers are offline or unconfigured, all 45+ local document tools and academic calculators remain 100% operational.

### 5. Secure Authentication & Notifications
- **Supabase SSR Auth**: Secure session management supporting Email/Password and Google OAuth.
- **Account Chooser Invariant**: Google OAuth enforces `prompt: "select_account"` for seamless multi-account switching.
- **Transactional Notifications**: Gmail SMTP provider on port 465 with SSL/TLS for scheduled task reminders and password recovery alerts.
- **Resilient Fallback**: Offline local session store keeps tools usable even when network access to authentication servers is interrupted.

---

## Technology Stack

- **Framework**: [Next.js 16.3.4](https://nextjs.org) (App Router, Turbopack)
- **UI & Components**: React 19, [Tailwind CSS 4](https://tailwindcss.com), [Lucide React](https://lucide.dev)
- **Client Processing**: [PDF-Lib](https://pdf-lib.js.org), [PDF.js](https://mozilla.github.io/pdf.js), [JSZip](https://stuk.github.io/jszip)
- **Authentication**: [@supabase/ssr](https://supabase.com/docs/guides/auth/server-side/nextjs)
- **Email Delivery**: [Nodemailer](https://nodemailer.com) (Gmail SMTP / Resend abstraction)
- **Payment Processing**: [Razorpay](https://razorpay.com) (Server-authoritative HMAC SHA256 verification)
- **Type Safety**: TypeScript 5.x with strict compiler rules

---

## Local-First Privacy Model

| Data Category | Storage Location | Server Cloud Sync | Administrator Access |
| :--- | :--- | :--- | :--- |
| **Documents & Uploads** | Browser Memory / Blob URL | **None** | No |
| **Academic Marks & SGPA** | Client `IndexedDB` | **None** | No |
| **Study Notes & Timetable** | Client `IndexedDB` | **None** | No |
| **Resume & Applications** | Client `IndexedDB` | **None** | No |
| **UI Preferences** | Client `localStorage` | **None** | No |
| **Account Identity (Email/ID)** | Supabase Auth (PostgreSQL) | Secure Encrypted | Metadata Only |
| **Subscription Tier** | Supabase Auth (PostgreSQL) | Server-Authoritative | RBAC Only |

---

## Project Structure

```
.
├── .github/
│   └── workflows/ci.yml       # Automated GitHub Actions CI pipeline
├── public/                    # Brand assets, logos, and static icons
├── src/
│   ├── app/                   # Next.js App Router (Pages, layouts, API routes)
│   │   ├── (public)/          # Landing, pricing, terms, privacy, contact
│   │   ├── admin/             # RBAC-protected administrative control center
│   │   ├── api/               # Server-side API endpoints (health, billing, auth)
│   │   ├── dashboard/         # Authenticated user dashboard
│   │   ├── student/           # Academic tools, VTU calculators, timetable
│   │   └── tools/             # 45+ local image & PDF utilities
│   ├── components/            # Reusable UI, layout, and tool components
│   ├── config/                # Site, pricing, and feature flag configurations
│   ├── context/               # React Context providers (AuthContext)
│   ├── hooks/                 # Custom React hooks (useAutoDownload, etc.)
│   ├── lib/                   # Business logic, services, and utilities
│   │   ├── academic/          # IndexedDB storage and academic engines
│   │   ├── analytics/         # Privacy-conscious client telemetry
│   │   ├── billing/           # Razorpay client and subscription orchestration
│   │   ├── config/            # Centralized environment validation (env.ts)
│   │   ├── monitoring/        # Error tracker and structured logging
│   │   ├── notifications/     # Gmail SMTP and transactional email providers
│   │   ├── security/          # File validation, SSRF, and redirect sanitizers
│   │   ├── student/           # Deterministic VTU SGPA/CGPA engines
│   │   └── supabase/          # Supabase client, server, and middleware
│   └── types/                 # TypeScript type and interface declarations
├── supabase/
│   └── migrations/            # Versioned SQL migrations for Supabase
└── tests/                     # Automated test suites (node:test)
```

---

## Getting Started

### Prerequisites
- **Node.js**: v20.x or higher (Node.js 24 LTS recommended)
- **npm**: v10.x or higher

### 1. Clone & Install
```bash
git clone git@github.com:mrutyunjayahangaragi-afk/Saarvi.git
cd Saarvi
npm ci
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Update `.env.local` with your development credentials. Free tools and local academic calculators work without external API keys.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Quality Assurance & Testing

All verification commands use native Node.js and Next.js tooling:

```bash
# Run automated test suite (511 tests across 35 test files)
npm test

# Verify TypeScript compilation (0 errors)
npx tsc --noEmit

# Run ESLint compliance check
npm run lint

# Compile production build (129 static, SSG, and dynamic routes)
npm run build
```

---

## Security Invariants

- **Content Security Policy**: Configured in `next.config.ts` to restrict script, frame, and connect origins to trusted endpoints (`self`, `razorpay.com`, `supabase.co`, `googleusercontent.com`).
- **Open-Redirect Defense**: Redirect parameters in `/auth/callback` are sanitized via `sanitizeInternalRedirectUrl` to prevent phishing forwards.
- **Server-Authoritative RBAC**: Administrative endpoints require verified `role === 'ADMIN'` or `role === 'SUPER_ADMIN'`.
- **Zero Committed Secrets**: `.gitignore` strictly ignores `.env*` files (except the dummy `.env.example` template).

---

## License & Attribution

Saarvi is an independent product developed by **Mrutyunjaya Hangaragi**.  
All rights reserved. Processed documents and local workspace files remain 100% the property of the user.
