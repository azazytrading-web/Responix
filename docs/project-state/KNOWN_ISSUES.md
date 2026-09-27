# Known Issues

## WhatsApp Onboarding Boundary - 2026-08-09

The Dashboard supports the repository's real manual Meta WhatsApp Cloud connection contract. The backend does not expose Meta OAuth or Embedded Signup, so onboarding requires Business Account ID, Phone Number ID, and write-only Meta credentials. No live Meta connection was created during validation because those external values were not supplied; this is an external onboarding dependency, not a frontend/API defect.

The earlier FM-7 external credential issue is resolved: DeepSeek validation and one real Agent execution succeeded. A superseded development smoke Agent created before the `providerConfigurationId` integration correction may remain in local development data; it is not used by the successful execution.

## FM-7 External Smoke Dependency - 2026-08-09

Code validation and authenticated local runtime verification pass, but real external-provider validation and the first real Agent response remain unverified because no authorized development provider credential is available. This is an external credential dependency, not an application failure. Resume through the `/ai/providers` write-only credential form; never place the credential in source, logs, query parameters, or project-state documents.

## FM-7 Provider Configuration Blocker - 2026-08-09

Resolved: the Provider frontend now consumes workspace-scoped safe configuration read/upsert and validation endpoints. Credentials are write-only, encrypted through the existing credential crypto service, and never present in responses, audits, diagnostics, or query-cache results. Live provider validation still requires a real external credential and may incur a minimal provider request; no live external-provider validation was performed during closeout.

## Dashboard Initialization Recovery - 2026-08-09

Resolved: Dashboard Runtime rejected the development manifest's unsupported Team/Agent `list` page layouts. Both now use registered `grid` layouts and authenticated bootstrap succeeds. A first database typecheck attempt hit transient Windows native-memory exhaustion while both watch servers were active; it passed unchanged after temporarily freeing the Dashboard watcher memory and the Dashboard was restarted.

## FM-5/FM-6 Discoverability Closeout - 2026-08-09

Resolved: the development database contained a stale platform manifest that predated Team and Agent navigation. The manifest-only seed path now increments revisions, and the active development workspace is on revision 2 with both entries. Browser sessions holding an older bootstrap snapshot need one reload or Platform bootstrap retry to consume the new revision. Zero optional feature entitlements remains expected and does not gate these permission-only modules.

## FM-6 Closeout - 2026-08-09

There are no known FM-6 implementation defects. Agent Studio exposes capability booleans but no memory, retrieval, tool-resource, or workflow assignment IDs, so FM-6 omits those associations. Provider and Prompt Library management UI remains a later milestone. The existing non-blocking Next.js ESLint-plugin detection warning remains. Vitest requires execution outside the sandbox on this Windows environment because child-process spawning returns `EPERM`.

## FM-5 Closeout - 2026-08-09

There are no known FM-5 implementation defects. The existing non-blocking Next.js ESLint-plugin detection warning remains. Sandbox child-process `EPERM` and one transient Windows native-memory failure affected initial validation attempts; the unchanged source passed the focused tests and Dashboard production build outside the sandbox.

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
