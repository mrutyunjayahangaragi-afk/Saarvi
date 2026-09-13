# Saarvi — Email Authentication & Verification Guide
**Subsystem:** Identity Verification, Email Credentials & Session Architecture  
**Product:** Saarvi — Study. Work. Grow.  
**Domain:** `https://saarvi.app`  

---

## 1. Authentication Lifecycle & Fundamental Invariants

Saarvi enforces an industry-standard, frictionless authentication architecture designed to eliminate user friction while ensuring verified email ownership:

```
[SIGNUP FLOW]
  1. Student enters Full Name, Email, Password
  2. Account created in Supabase Auth (Status: unconfirmed)
  3. One-Time 6-Digit Verification Code dispatched to student inbox
  4. Student enters 6-digit code on verification screen
  5. Account confirmed -> Session activated -> Enter Dashboard

[SUBSEQUENT LOGIN FLOW]
  1. Student enters Email + Password
  2. Server verifies password hash
  3. Session issued -> Direct Dashboard access
  * ZERO OTP / ZERO VERIFICATION CODES on normal daily logins!
```

### Invariants:
- **No OTP on Normal Login:** Once an account is verified, daily access requires only Email + Password. OTP is never requested on normal login.
- **OTP Exclusivity:** OTP codes are used **solely** for initial email ownership verification upon registration.
- **Unverified Access Prevention:** If an unverified user attempts password login, the system halts authentication and displays the 6-digit verification code screen with resend capabilities.

---

## 2. Signup & Verification Experience (`/signup`)

1. **Clean Responsive UI:**
   Centered white card on slate background with Saarvi logo, clear input boundaries, and password confirmation checks.
2. **6-Digit Code Screen:**
   Upon submitting valid signup credentials, the form switches smoothly to the Verification Screen:
   - High-visibility 6-digit code input (`tracking-[0.4em]`, `font-mono`, numeric keyboard for mobile).
   - `[Verify Email]` button calling `supabase.auth.verifyOtp({ email, token, type: 'signup' })`.
   - `[Resend Code]` action equipped with a **60-second cooldown countdown timer** and duplicate-click protection.
   - `[Change Email]` link allowing students to correct typos without starting over.

---

## 3. OTP Security Safeguards

- **Zero Client-Side Storage:** OTP codes are **never** stored in browser `localStorage`, `sessionStorage`, cookies, or `IndexedDB`.
- **Zero Log Leakage:** OTP tokens are never logged in server application logs, analytics events, or URL query parameters.
- **Cryptographic Server Validation:** Code verification is executed directly by Supabase Auth cryptographic verification endpoints.
- **Rate Limiting:** Resend and verification endpoints enforce sliding window rate limits to prevent brute-force attacks.

---

## 4. Unverified Login Handling (`/login`)

When an unverified account attempts standard email/password login:
1. Supabase returns `Email not confirmed`.
2. The login page catches the exception and displays the **Verification Required** state.
3. The student enters the 6-digit code or clicks **Resend Code** directly from the login page, completing activation without account lockouts.
