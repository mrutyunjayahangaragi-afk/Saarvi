# Saarvi Super Admin Payment & Billing Control Center Guide

## Overview
The Super Admin Payment & Billing Control Center at `/admin/billing` provides operational oversight over all monetization aspects of Saarvi.

---

## 1. Control Center Architecture

The interface is structured into **3 core operational tabs**:

### Tab 1: Payment Requests (`REQUESTS`)
- **Real-Time Request Feed**: Displays all student submissions with email, plan duration, amount, UTR number, submission timestamp, and SLA status.
- **Search & Filters**: Quick filters for `ALL`, `PENDING`, `OVERDUE`, `APPROVED`, and `REJECTED`, plus live search by email or UTR.
- **Approve Modal**:
  - Confirms student email, plan, and amount.
  - Optional admin verification note (e.g. `"Credit verified on HDFC Bank Portal"`).
  - Triggers server-authoritative subscription creation (`SubscriptionRecord`) and official invoice generation (`BillingInvoiceRecord`).
- **Reject Modal**:
  - Mandatory rejection reason (e.g. `"UTR not found on bank credits"`, `"Invalid amount received"`).
  - Displays reason to student in their `/dashboard/billing` page.
- **Details Modal**: Complete breakdown of review timestamps, reviewer email, and transaction metadata.

---

### Tab 2: Payment Settings & QR (`SETTINGS`)
- **Payee Account Details**:
  - `Payee UPI ID`: Official bank VPA (`saarvi@upi`).
  - `Payee Display Name`: Registered entity name (`Saarvi Educational Services`).
- **Plan Pricing**:
  - `Monthly Plan Price`: Authoritative INR price (default: ₹49).
  - `Yearly Plan Price`: Authoritative INR price (default: ₹399).
- **Service Level Agreement (SLA)**:
  - `Review SLA Guarantee`: Configurable target in hours (default: 2 hours).
- **Instructions & Support**:
  - Custom student-facing instructions.
  - Dedicated support desk email (`payments@saarvi.app`).
- **QR Code Management Widget**:
  - Real-time preview of active QR image.
  - Secure image upload (PNG, JPEG, WebP, max 2MB) with magic-bytes binary inspection.
  - One-click remove to revert to system dynamic QR.

---

### Tab 3: Subscriptions & Invoices (`SUBSCRIPTIONS`)
- **Active Subscriptions Inventory**: Complete list of users with active Pro status, billing interval, expiration date, and provider (`manual_upi`).
- **Invoices & Receipts Table**: Comprehensive ledger of all paid invoices with provider reference ID, amount, and timestamp.

---

## 2. Standard Operating Procedures (SOP) for Reviewers

### Approving a Payment
1. Open banking portal or business UPI app (e.g., HDFC, ICICI, SBI).
2. Cross-reference the 12-digit UTR submitted by the student with bank credits.
3. Confirm:
   - Matching amount (₹49 for Monthly, ₹399 for Yearly).
   - Date matches within a reasonable transaction window.
4. Click `[Approve]` in `/admin/billing`.
5. Enter optional bank note and confirm. The student's Pro entitlement activates immediately.

### Rejecting a Payment
1. If the UTR does not appear after 30 minutes, or the amount does not match:
2. Click `[Reject]` in `/admin/billing`.
3. Provide a clear, actionable note (e.g., `"The UTR number provided does not appear in our bank credits. Please check your transaction details or email payments@saarvi.app with a screenshot."`).
4. Confirm rejection. The student can view this note and re-submit.
