# SAARVI — Complete Brand Migration Architecture & Production Standard

## 1. Brand Identity & Standards

| Dimension | Specification |
| :--- | :--- |
| **Official Name** | **Saarvi** (or **SAARVI** where stylized uppercase branding is used) |
| **Official Tagline** | **Saarvi — Study. Work. Grow.** |
| **Canonical URL** | `https://saarvi.app` |
| **Official Support Email** | `support@saarvi.app` |
| **Official Contact Email** | `contact@saarvi.app` |
| **System Sender / Admin** | `reminders@saarvi.app`, `admin@saarvi.app`, `system@saarvi.local` |
| **Copyright Notice** | `© 2026 Saarvi. All rights reserved.` |

---

## 2. Visual Brand Assets

The user-supplied brand asset has been processed into high-resolution, production-grade assets in `public/brand/` and root `public/`:

1. `public/brand/saarvi-logo.png`
   - Clean, high-resolution Saarvi emblem & typography.
   - Persona avatar cleanly eliminated with transparent negative space.
2. `public/brand/saarvi-mark.png`
   - High-contrast square emblem featuring the brand ribbon, star, and open book motif.
   - Transparent background, crisp at micro (16px) and large (128px) scales.
3. `public/brand/favicon.png` (256x256) & `public/brand/favicon.svg`
   - Sharp browser tab icons.
4. `public/favicon.ico`
   - Multi-resolution Windows/browser icon with 16x16, 32x32, 48x48, and 64x64 layers.
5. `public/og-image.png` (1200x630)
   - High-definition social share preview image featuring the Saarvi brand mark and official typography.

---

## 3. Brand Component Usage

`src/components/brand/SaarviLogo.tsx` provides reusable, accessible brand presentation:

```tsx
import SaarviLogo, { SaarviMark } from '@/components/brand/SaarviLogo';

// Full logo with wordmark and tagline:
<SaarviLogo size="md" showTagline={true} asLink={true} />

// Mark only:
<SaarviMark size={32} />
```

Integrated into:
- `src/components/layout/Navbar.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/admin/AdminSidebar.tsx`
- `src/app/login/page.tsx` & `src/app/signup/page.tsx`

---

## 4. Invariant Preservation

1. **Academic Intelligence ground truth**:
   - Zero changes to VTU SGPA/CGPA formulas, CIE/SEE boundary conditions, attendance calculations, or conflict detection algorithms.
   - Purely deterministic local-first execution.
2. **Billing and Payments Integrity**:
   - Razorpay pricing strictly locked at **₹99** (Monthly) and **₹899** (Yearly).
   - Razorpay plan IDs (`plan_monthly`, `plan_yearly`) unchanged.
   - Webhook signature validation and server-authoritative entitlements intact.
3. **Local-First Privacy Architecture**:
   - Workspaces remain in browser memory and local IndexedDB.
   - Zero remote database synchronization of private student notes, files, or calculations.
4. **Internal Technical Stability**:
   - Preserved internal package identity `smart-doc-platform` in `package.json`.
   - Preserved Supabase schema migration table names.

---

## 5. Dual LocalStorage Backward Compatibility

To ensure existing users do not lose their data, preferences, or login sessions during the transition, dual-key read fallbacks are implemented across all browser storage systems:

| Storage Dimension | Saarvi Primary Key | Legacy DocEase Key | Fallback Strategy |
| :--- | :--- | :--- | :--- |
| **Auth Session Cookie** | `saarvi_local_session` | `docease_local_session` | Read `saarvi` ?? `docease`; writes set both |
| **Mock Storage Users** | `saarvi_users_v1` | `docease_users_v1` | Transparent fallback in `getStored()` |
| **Mock Storage Session** | `saarvi_session_v1` | `docease_session_v1` | Transparent fallback in `getStored()` |
| **Auto-Download Pref** | `saarvi_autodownload_enabled` | `docease_autodownload_enabled` | Nullish coalescing read; writes to `saarvi` |
| **Guest Cover Letters** | `saarvi_guest_cover_letters_v1` | `docease_guest_cover_letters_v1` | Dual read fallback; writes to `saarvi` |
| **Notification Prefs** | `saarvi_notification_prefs_v1` | `docease_notification_prefs_v1` | Dual read fallback; writes to `saarvi` |
| **Analytics Consent** | `saarvi_analytics_consent` | `docease_analytics_consent` | Dual read fallback; writes to `saarvi` |
| **Analytics Session** | `saarvi_anon_session_id` | `docease_anon_session_id` | Dual read fallback; writes to `saarvi` |
| **AI Consent** | `saarvi_ai_consent` | `docease_ai_consent` | Dual read fallback; writes to `saarvi` |
| **Recent Searches** | `saarvi_recent_searches` | `docease_recent_searches` | Dual read fallback; writes to `saarvi` |
| **Dismissed Recs** | `saarvi_dismissed_recommendations` | `docease_dismissed_recommendations` | Dual read fallback; clears both |
| **Academic DB Exports** | `application: "Saarvi"` | `application: "DocEase"` | Imports accept both `Saarvi` & `DocEase` |
