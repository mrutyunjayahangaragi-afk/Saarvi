# Saarvi — Google Authentication & OAuth Security Guide
**Subsystem:** Federated Identity, OAuth 2.0 PKCE & Account Chooser Architecture  
**Product:** Saarvi — Study. Work. Grow.  
**Domain:** `https://saarvi.app`  

---

## 1. Google OAuth Flow Architecture

Saarvi integrates Google Sign-In via official Supabase OAuth with Proof Key for Code Exchange (PKCE):

```
Student clicks "Continue with Google"
  ↓
Supabase Auth initiates OAuth handshake with Google
  (queryParams: { prompt: "select_account" })
  ↓
Google Account Chooser displays all available Google accounts
  ↓
Student selects target Google account
  ↓
Google redirects to /auth/callback with authorization code
  ↓
Server exchanges code for session cookies (HTTP-only, Secure, SameSite=Lax)
  ↓
Redirect to /dashboard
```

---

## 2. Critical Authentication Invariants

### 1. Dedicated Account Chooser (`select_account`):
Google OAuth options strictly enforce:
```typescript
queryParams: {
  prompt: 'select_account',
}
```
**Rationale:** This ensures students can freely switch between personal Gmail and university `@college.edu` Google accounts. We **never** use `prompt: "consent"` on repeated logins, avoiding repetitive permission prompts.

### 2. Zero Saarvi Email OTP for Google Users:
Google accounts are pre-verified by Google's identity provider. Students signing in with Google are **never** prompted for a Saarvi email OTP verification code.

### 3. Strict Non-Admin Default (Zero Privilege Escalation):
Logging in via Google **never** grants administrative privileges. Admin rights (`ADMIN` / `SUPER_ADMIN`) are granted exclusively through verified entries in the server-side `admins` table.

---

## 3. Account Switching & Local Data Isolation

When a student switches between different Google accounts or between an email account and a Google account on the same browser device:
1. `signOut()` clears active session cookies and resets the active workspace identifier:
   `academicStorage.setActiveProfileId('guest')`.
2. Upon logging in with Account B, `academicStorage.setActiveProfileId(userB.id)` is assigned.
3. All IndexedDB queries, local career profiles, resumes, and academic marks filter strictly by the authenticated account ID (`userB.id`).
4. **Result:** Account A's private local documents and marks are completely hidden from Account B, and safely restored when Account A logs back in.
