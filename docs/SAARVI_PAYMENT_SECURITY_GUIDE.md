# Saarvi Payment & Entitlement Security Architecture

## 1. Threat Model & Countermeasures

| Threat Vector | Attack Description | Saarvi Security Countermeasure |
|---|---|---|
| **Price Tampering** | Malicious client alters request payload to send `amount: 1` | **Zero Client Authority**: Amount is strictly derived on the server from `PaymentStore.getConfig()`. Client-submitted amount fields are discarded. |
| **Double Activation** | Two administrators click Approve simultaneously | **Concurrency Mutex Locks**: Operations are serialized via `lock:approval:{id}`. Duplicate executions are aborted. |
| **Fake UTR Spam** | Bot floods platform with random fake UTR numbers | **Rate Limiting & Duplicate Active Check**: IP & user rate limiting (`enforceRateLimit`). Max 1 active pending submission per user. |
| **Malicious QR Upload** | Attacker disguised as admin uploads executable payload (.exe, .sh) | **Magic-Byte Binary Inspection**: Rejects executable binary signatures (PE, ELF, Mach-O, shell). Only verified PNG, JPEG, and WebP are accepted. |
| **Client Privilege Escalation** | Regular user attempts to call approval endpoint | **Authoritative RBAC Guard**: Strictly verifies `SUPER_ADMIN` or `ADMIN` role via server-side session cookies before processing review actions. |
| **Stale / Zombie Entitlements** | User cancels but retains active features indefinitely | **Authoritative Period-End Enforcement**: Subscriptions carry explicit `currentPeriodEnd` timestamps verified at runtime across all tool gates. |

---

## 2. Magic-Bytes Binary Validation

File uploads to `/api/admin/billing/upload-qr` do not rely on MIME type headers or file extensions (which are easily spoofed). Instead, the server inspects the initial byte signatures:

```ts
// Real binary signatures inspected
PNG:  0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
JPEG: 0xFF 0xD8 0xFF
WebP: RIFF ... WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)

// Executables strictly blocked
PE:   0x4D 0x5A ("MZ")
ELF:  0x7F 'E' 'L' 'F'
Shebang: 0x23 0x21 ("#!")
```

---

## 3. Database Security Hardening (Migration 008)
- **Table Constraints**: Provider check enforces `CHECK (provider IN ('razorpay', 'stripe', 'sandbox', 'manual_upi'))`.
- **Row-Level Security (RLS)**:
  - `payment_configs`: Universally readable for pricing display, modifiable strictly by `profiles.role IN ('ADMIN', 'SUPER_ADMIN')`.
  - `manual_payment_requests`: Users can only read and insert rows where `user_id = auth.uid()`. Admins have universal read and update privileges.
