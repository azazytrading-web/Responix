# Known Issues

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
