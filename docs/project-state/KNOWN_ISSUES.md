# Known Issues

## FM-4 Closeout - 2026-08-02

There are no known FM-4 implementation defects. The earlier FM-2 authentication lint debt was resolved by FM-3. A transient Windows native Node heap allocation failure occurred during workspace lint; rerunning after confirming no orphaned validation processes completed successfully. The existing Next.js ESLint-plugin detection warning remains non-blocking and outside FM-4.

## Active Frontend Validation Debt — 2026-08-01

| Status | Issue | Impact | Resolution |
| --- | --- | --- | --- |
| Deferred outside FM-2 | `PROACTIVE_REFRESH_BUFFER_MS` is unused in `packages/auth/src/refresh/detector.ts`. | Root workspace lint stops in the authentication package after all FM-2-owned packages pass. API-client, Dashboard, workspace typecheck, tests, and builds are unaffected. | Address only in an approved authentication/FM-3 scope; FM-2 did not modify authentication lifecycle code. |

## Active External Environment Limitations

| Status  | Limitation                                                 | Impact                                                                                                                 | Resolution                                         |
| ------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Pending | Docker is unavailable locally (`docker` is not on `PATH`). | `docker compose up --build` cannot start PostgreSQL, Redis, API, or Dashboard; Compose health verification is pending. | Run Compose verification on a Docker-capable host. |

There are no known Sprint 4 repository defects or unresolved Sprint 4 implementation issues.

## Resolved Sprint 4 Issues

| Status   | Issue                        | Resolution                                                                                                                             |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Resolved | Tenant ambiguity             | `WorkspaceMembership` is authoritative for tenant membership, role, and permissions; `User.workspaceId` is not used for authorization. |
| Resolved | Cross-workspace access paths | Tenant context, guards, and workspace-scoped repositories require validated active membership.                                         |
| Resolved | Membership lifecycle gaps    | Explicit invitation and membership state transitions, ownership invariants, quota checks, and session revocation are implemented.      |
| Resolved | Workspace lifecycle gaps     | Create, update, archive, suspend, restore, and soft-delete controls are implemented with audit records and transaction safety.         |
| Resolved | API consistency gaps         | DTO validation, domain errors, explicit REST operations, and repository/service/controller consistency were completed.                 |
| Resolved | Sprint 4 validation          | Install, Prisma validation/generation, typecheck, lint, tests, and production build passed.                                            |

## Deferred Environment Verification

Once Docker is available, run `docker compose up --build`, confirm `docker compose ps`, verify PostgreSQL and Redis health, then verify API, Dashboard, and the health endpoint. This is environment verification only and does not require changes to the completed Sprint 4 scope.
