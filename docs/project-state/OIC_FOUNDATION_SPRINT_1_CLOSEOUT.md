# OIC Foundation Sprint 1 Closeout

**Sprint:** OIC-1 Foundation Core
**Date:** 2026-09-30
**Status:** Stage 1A-1G acceptance PASS
**Baseline:** `860f61b6ad254e0d9e85c02ca0b56218df9b6e6a` (`oic`); `origin/oic` matched at the start of closeout.

## Scope delivered

OIC Foundation Phase 1 is implemented in the independent `apps/oic-api`, `packages/oic-contracts`, and `packages/oic-database` boundaries. It includes OIC-owned Applications, Tenants and external references; Service Principals, explicit scopes and Tenant grants; versioned machine credentials and protected bootstrap; scoped append-only audit; bounded idempotency; health/readiness and operational controls; and the separately authorized protected platform-administrator recovery flow.

The recovery contract and decision authority are recorded in `OIC_FOUNDATION_ADMIN_RECOVERY_DECISION.md`. It fixes the target to `OIC_PLATFORM` / `platform-admin`; requires process authorization, exact confirmation, bounded reason and operation ID; denies missing or archived targets; reactivates only suspended canonical identities; restores the canonical Foundation scope set; revokes active credentials; issues one new credential; and atomically records recovery and audit. The credential is disclosed only on first successful execution. Replay returns metadata without a secret. Recovery is CLI-only, with no HTTP route.

## Acceptance results

- Contracts typecheck and build: PASS.
- Prisma schema validation, database package typecheck, client generation and build: PASS.
- API typecheck, lint and build: PASS.
- API acceptance suite: 15 passed, 0 failed, 0 skipped.
- Both OIC databases report all three migrations up to date: PASS.
- Built service liveness: HTTP 200. Real OIC development-database readiness: HTTP 200, database check `ok`.
- Whitespace check (`git diff --check`): PASS.
- OIC boundary reviewed: changes are confined to OIC packages, OIC project-state records and OIC package-lock imports. No Responix source, schema, database, runtime or behavior was changed. Local DB URLs remain in ignored `.env.oic.local` and were not emitted into tracked files.

## Test coverage recorded

The 15 tests cover protected bootstrap authorization and creation-only behavior; concurrent idempotency replay and payload conflict; Application/Tenant isolation; mapping uniqueness; scope allowlist and escalation denial; explicit Tenant grant; lifecycle restrictions; credential secret one-time return, verifier-only persistence, rotation, expiry and revocation; anonymous authentication denial and rate limiting; authenticated Tenant grant propagation; scoped and append-only audit; transaction rollback on injected audit failure for Application creation, scope grant, Tenant grant, credential rotation and revoke; and recovery authorization, fixed target, suspension restoration, archived/missing rejection, credential revocation, canonical scope restoration, verifier-only persistence, secret-free audit, replay behavior, concurrent recovery and full rollback.

## Artifacts

- Locked contract: `OIC_FOUNDATION_PHASE_1_CONTRACT.md`
- Execution packaging: `OIC_FOUNDATION_EXECUTION_ADDENDUM.md`
- Recovery decision: `OIC_FOUNDATION_ADMIN_RECOVERY_DECISION.md`
- Stage record: `OIC_FOUNDATION_SPRINT_1_PROGRESS.md`
- API acceptance tests: `apps/oic-api/src/modules/identity/foundation.acceptance.test.ts`, `apps/oic-api/src/modules/identity/admin-recovery.acceptance.test.ts`
- Recovery implementation: `apps/oic-api/src/modules/identity/admin-recovery.service.ts`, `apps/oic-api/src/recover-admin.ts`
- Schema/migration: `packages/oic-database/prisma/schema.prisma`, `packages/oic-database/prisma/migrations/20260930170000_oic_admin_recovery/migration.sql`

## Delivery state

All Stage 1A-1G acceptance gates pass. The work is ready for the owner-authorized OIC branch commit and push. Responix remains unchanged.
