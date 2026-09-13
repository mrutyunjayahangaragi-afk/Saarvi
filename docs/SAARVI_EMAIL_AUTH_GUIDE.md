# Saarvi Email Verification & Authentication Guide

## Overview
Saarvi provides a secure, streamlined, light authentication experience built around Supabase Auth.

---

## 1. Core Authentication Invariants

### Invariant 1: Dedicated Email Verification (`/auth/verify-email`)
- **Signup Flow**: Upon completing registration at `/signup`, if email verification is enabled, the user is immediately routed to `/auth/verify-email?email=<user_email>`.
- **6-Digit Security Code**: The user receives a one-time 6-digit verification code.
- **Resend with 60-Second Cooldown**: To protect against mail server flooding, the `[Resend Code]` action is governed by a strict 60-second cooldown timer.
- **Change Email Option**: Allows the user to correct typographical errors without restarting the signup process.
- **Auto-Routing**: Upon successful verification (`verifyOtp`), the user is automatically redirected to `/dashboard`.

### Invariant 2: Normal Login Invariant (No OTP Prompt)
- Normal login at `/login` strictly accepts **Email + Password**.
- Once verified, returning users are **never** prompted for an email OTP code during normal login.
- If an unverified user attempts to log in with valid credentials, the system returns `EMAIL_NOT_CONFIRMED` and redirects them to `/auth/verify-email?email=<user_email>`.

### Invariant 3: Google OAuth Account Switching
- Google OAuth is configured with `prompt: 'select_account'` query parameter.
- This ensures that when students or educators sign in via Google, the Google Account Chooser is displayed every time, preventing session bleed between multiple personal or college Google accounts on shared computers.

### Invariant 4: Strict Email System Separation
- **Supabase Auth Emails**: Dedicated exclusively to core account lifecycle (Email verification OTP, Password reset links, Magic links).
- **Admin Notifications Engine (`/admin/notifications`)**: Dedicated exclusively to transactional notifications, feature updates, platform maintenance alerts, and student reminders.
- The two systems do not conflate responsibilities, maintaining modularity and compliance.
