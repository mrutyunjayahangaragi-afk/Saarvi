# Saarvi — Production Release & Change Management Process
**Default Branch:** `main`  
**CI/CD Engine:** GitHub Actions (`.github/workflows/ci.yml`)  
**Deployment Platform:** Edge Hosting (Vercel / Cloudflare)

This document establishes the official release engineering process for Saarvi. It ensures that every code modification is deterministically verified, peer-reviewed, and production-safe.

---

## 1. Release Lifecycle Workflow

```
[ Feature / Bugfix Branch ]
           │
           ▼
[ Pull Request on GitHub ]
           │
           ▼
[ Automated CI Pipeline ] ──► (npm ci, lint, tsc, 511 tests, build)
           │
           ▼
[ Peer Code Review & Approval ]
           │
           ▼
[ Squash & Merge to 'main' ]
           │
           ▼
[ Automated Edge Deployment ]
           │
           ▼
[ Post-Deployment Smoke Test ]
           │
           ▼
[ Active Monitoring & Telemetry Review ]
```

---

## 2. Release Candidate Versioning Convention

Saarvi follows Semantic Versioning (`vMAJOR.MINOR.PATCH`):
- **Patch (`v0.1.X`)**: Backward-compatible bug fixes, UI adjustments, and performance improvements.
- **Minor (`v0.X.0`)**: New tools, additional university schemes, or non-breaking feature enhancements.
- **Major (`v1.0.0`)**: Major platform milestones or significant architectural updates.

### Release Log Record
For every production release, maintain a record including:
1. **Version / Commit SHA**: e.g., `v0.1.0-rc1` (`11ea56f`).
2. **Change Summary**: Clear description of what changed.
3. **Risk Level**: Low / Medium / High.
4. **Automated Verification Proof**: CI build logs, test pass count.
5. **Rollback Target**: Previous commit SHA.

---

## 3. Mandatory Regression Testing Policy

> [!IMPORTANT]
> **Zero Bug Fixes Without Regression Tests**:
> Whenever a production bug or customer issue is identified and resolved:
> 1. A dedicated automated test reproducing the issue MUST be added to `tests/`.
> 2. The test must fail prior to the fix and pass cleanly with the fix applied.
> 3. Never rely solely on manual verification.

---

## 4. Safe Feature Flagging Strategy

To decouple deployment from feature release:
1. **New Complex Features**: Deployed behind feature toggles managed in `src/lib/services/featureService.ts`.
2. **Default State**: New features default to `DISABLED` or `MAINTENANCE` in production.
3. **Admin Validation**: Admins test features internally on staging or using admin overrides on `/admin/features`.
4. **Gradual Rollout**: Once verified, toggle is switched to `AVAILABLE` for all users.
5. **Instant Deactivation**: If an issue arises, the feature can be disabled instantly in the database without requiring a code redeploy.

---

## 5. Dependency Maintenance & Security Upgrades

- **Cadence**: Monthly automated audit via `npm audit` and Dependabot alerts.
- **Prioritization**:
  1. Critical & High CVE security patches (Immediate).
  2. Framework and Next.js patches (Tested in isolation).
  3. Non-critical dependency updates (Bundled with minor releases).
- **Verification Rule**: Any dependency update requires:
  ```bash
  npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build
  ```
