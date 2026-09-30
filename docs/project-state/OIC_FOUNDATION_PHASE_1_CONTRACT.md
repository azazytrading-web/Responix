# OIC Foundation Phase 1 Implementation Contract

**Status: APPROVED / LOCKED**
**Authority:** Owner decision lock in OIC - Oi Intelligence Core Foundation Phase 1 Human Decision Lock, 2026-09-30.
**OIC baseline:** branch oic, HEAD = origin/oic = 0c5daccc2741e8c43d8429b1a6f1050dc1f47409 at review start.
**Responix baseline:** branch frontend, HEAD = origin/frontend = 79f7230ca51da60f950d21f3bc26a0b673658c93.
**Audit:** targeted repository inspection only; no tests, builds, Prisma generation/migrations, OpenAPI generation, Docker, or service startup.

## 1. Purpose

Establish OIC's company-wide application/tenant identity, machine authentication, authorization, persistence ownership, audit and request-correlation foundation. Deliver an independently bootable OIC service and safe primitives for later runtime phases. No Responix production traffic moves in Phase 1.

## 2. Baseline and repository reality

The repo is a pnpm workspace over apps/* and packages/*. Responix uses NestJS at apps/api with apps/api/src/main.ts and src/app/app.module.ts, URI API versioning, /api prefix, validated Zod config, Pino request IDs, global throttling/guards, Swagger and Terminus health checks. Health currently checks PostgreSQL and Redis.

Persistence is packages/database with one Responix-oriented Prisma schema/client, DATABASE_URL and one migration tree. ApiKey and AuditLog are Workspace/User-bound. Responix JWT claims require user, workspace, membership and session IDs; tenant guards resolve human membership. These are prior art only, not OIC machine identity.

The Responix frontend worktree reports six modified project-state files and untracked SPRINT_CRM_1_CHARTER.md. They are preserved untouched. The OIC worktree was clean before this contract; this is the only file this task creates.

## 3. Phase 1 boundaries

**In scope:** Application and Tenant identities; explicit external identity mapping; Application-owned Service Principals; one-time machine credentials with verifier-only storage, rotation, revocation, expiry support and safe last-use metadata; explicit scopes and optional tenant grants; OIC persistence/migration ownership; OIC audit; request/trace and bounded admin-idempotency primitives; OIC app/package skeleton; configuration, health/readiness and foundational versioned contracts.

## 4. Non-goals

No Provider Fabric runtime or Provider Connections; upstream model catalog administration or Oi Model runtime; Model Factory, Evolution Lab or Internal Intelligence; Context Compiler; Memory, Knowledge/RAG or Tool engines; OIU conversion, quota/entitlement engines, plans or economics; OpenAI Compatibility runtime; Responix cutover or behavior/data/schema changes. No future Model, Memory, Knowledge, Tool, Cache or Usage schema is created.

## 5. Responix preservation contract

Responix retains Workspaces, memberships, Agents, conversations, messages/history, product Memory, Knowledge Base/RAG, tools/actions, CRM, customer data, channels, workflows, handoff and Channel Protection Guard including queues, scheduling, typing/read/presence, humanization, serialization and delivery.

No provider execution moves; no Agent selection changes; no Memory, Knowledge, History or customer data migrates; no Responix migration is created. OIC does not import Responix feature modules or access its tables. Responix does not access OIC tables. OIC must not make Responix a thin gateway.

## 6. OIC app boundary

**APPROVED TARGET:** apps/oic-api is the first physical OIC application. It is independently bootable/configurable/deployable, with logical Control Plane and foundation modules in one deployable initially. No microservices without operational evidence. OIC uses generic infrastructure only and must not depend on apps/api, Responix Prisma types, Responix config or workspace JWT semantics.

## 7. Package and dependency topology

**APPROVED TARGET:** create apps/oic-api, packages/oic-contracts for validated transport-neutral foundation contracts, and packages/oic-database for OIC-only Prisma schema/client/migrations. Respect current pnpm/Turbo conventions. Do NOT create packages/oic-client in Phase 1; add it when Phase 2/runtime has a concrete consumer contract. Do not create speculative engine packages.

Dependency direction: product -> OIC contracts/client -> OIC API -> OIC database. OIC depends on OIC-owned or generic infrastructure, never Responix modules. No circular dependencies.

## 8. Database ownership

**APPROVED / LOCKED:** a separate OIC PostgreSQL database on existing approved PostgreSQL infrastructure, with independent database role/credentials, OIC_DATABASE_URL, independent Prisma schema/client and independent migration history. No shared product tables or Responix direct access. A shared physical server is acceptable; a shared-schema fallback is not the selected topology.

Use a dedicated OIC development database and a separate OIC migration/test-validation database, distinct from Responix development and production/shared data. Exact physical names follow environment conventions. Neither database is assumed disposable without explicit per-run authorization. No database is created in this documentation task.

## 9. Application model

**APPROVED / LOCKED:** OIC Application is an OIC-owned stable identity with stable UUID, stable machine-safe key, mutable display metadata, explicit lifecycle/status and audit metadata. Key/UUID never depend on mutable display names. Examples: RESPONIX, OI_TRADING_FOLLOW, LEVIATHAN.

Exact key casing/storage convention and status enum vocabulary are implementation details, provided identity stability and lifecycle semantics are preserved.

## 10. Tenant model

**APPROVED / LOCKED:** OIC Tenant is an OIC-owned stable UUID under one Application. A Responix Workspace ID is never the native OIC Tenant primary key. Tenant identity is product-neutral and permits different external concepts (workspace, account, portfolio, organization) without forcing their semantics into OIC.

## 11. External identity mapping

**APPROVED / LOCKED:** map product-native identities through TenantExternalReference. External identifiers are opaque. Uniqueness is (Application, external reference source/type, external identifier); one OIC Tenant may have additional approved references. Do not use arbitrary JSON as authorization identity.

For a future Responix integration, the source/type may identify Responix Workspace and the external key its stable ID. Provisioning/migration of mappings belongs to a separately approved integration phase.

## 12. Service Principal model

**APPROVED / LOCKED:** Service Principal is the primary machine-to-machine OIC identity. It has stable UUID, belongs to exactly one Application, has explicit scopes, may have Tenant restrictions/grants, owns credentials over time, has lifecycle/status and is auditable with immediate revocation. Human Responix Workspace JWTs are not OIC service identities.

Application ownership and tenant grants must be enforced at every request; absence of an explicit tenant grant does not grant all-tenant access.

## 13. Credential security model

**APPROVED / LOCKED:** credentials are high-entropy opaque values with separate public credential identifier and secret material. Show issued secret once. Persist only a verifier/hash/fingerprint suitable for secure verification. Never store plaintext, log secrets, or return secret after creation. Use a versioned/prefixed format so formats can coexist.

Credential supports ACTIVE, REVOKED and EXPIRED semantics where applicable. Expiration is supported but is not mandatory by default for every system credential. Rotation creates a new credential with auditable lineage; a controlled overlap may be requested but is not mandatory. If explicitly requested, operational recommendation is a short overlap, approximately 24 hours, followed by explicit revocation of the old key.

Last-used evidence is best-effort/throttled; never write synchronously on every authentication and never fail a valid request because updating it failed.

Exact verifier cryptography must use repository-approved security primitives and be reviewed during implementation. This contract does not prescribe custom cryptography.

## 14. Authorization and scopes

**APPROVED / LOCKED:** explicit, understandable, namespaced scopes; deny by default; no generic policy language/DSL. Initial administrative capability set: Application read/manage; Tenant read/manage; Service Principal read/manage; Credential rotate/revoke; Audit read; Foundation administration. Tenant grants may further restrict a principal. Do not add Model, Tool or OIU scopes until their phases require them.

Exact stable scope strings and registry representation are implementation details. Authorization derives Application/Principal from the authenticated credential; caller-supplied authority is rejected.

## 15. Audit foundation

OIC-owned append-only AuditEvent records actor/principal, target, action, time, scope and safe bounded metadata. Audit Application/Tenant mappings, Service Principals, credential issue/rotation/revocation and scope changes. Mutations and audit commit atomically. Never persist secrets, verifiers or raw sensitive payloads. Reuse Responix audit design as prior art, not its Workspace/User-bound table.

## 16. Request and trace identity

Carry OIC request ID, trace/correlation ID, Application, Tenant and Service Principal where applicable, plus optional external request ID. External IDs are bounded untrusted correlation, never authorization. Use a stable safe error envelope. Trace propagation format, sampling and operational field names are implementation details; no runtime trace store is introduced here.

## 17. Idempotency

**APPROVED / LOCKED:** Phase 1 idempotency is limited to retryable administrative mutations that could duplicate or compromise resources, such as resource creation and credential issue/rotation. Identity is principal/scope/operation-aware, with request mismatch conflict and transactionally enforced uniqueness.

Do not build distributed inference/accounting idempotency. Persistence shape, TTL and exact operations are implementation details. Credential retry must not recover/replay secret material; same-key retry returns safe metadata only.

## 18. Configuration and secrets

Use OIC-only validated configuration including OIC_DATABASE_URL, listener, logs, rate limits, operator/bootstrap controls and secure verifier configuration required by the reviewed credential primitive. No Responix JWT/encryption secrets. Use protected deployment secret injection; redact secret-bearing headers/values; fail startup if required configuration is invalid. Do not import Responix ConfigModule or require Responix Dashboard/R2/AI/Redis settings. No Phase 1 Redis dependency. Exact variable names/defaults are implementation details.

## 19. Resource namespace principles

Every future tenant-owned resource carries immutable applicationId and tenantId. Optional actor/entity/conversation/resource refs are scoped identifiers, not global IDs. Organization entity waits for demonstrated need. Parent relationships must be validated and constrained. Memory/Knowledge/Cache/Tool/Model/Usage may not omit namespace. Caches and derived artifacts inherit the strictest source scope. No arbitrary JSON for identity/authorization.

## 20. Health/readiness

Expose separate liveness and readiness. Liveness checks process ability only. Readiness checks OIC DB/schema and required local config, with minimal public output and no secrets/topology. No Redis/provider check in Phase 1. Use Terminus pattern without importing Responix DB module.

## 21. Reuse/extraction decisions

**APPROVED / LOCKED:** no Responix shared-library extraction during Phase 1 by default. Reuse proven patterns as prior art and implement OIC-native behavior with OIC ownership. Propose extraction only if a concrete technical dependency proves the code product-neutral, safe, stable and required by both products; any extraction touching Responix requires a separate explicit integration gate.

- Nest bootstrap, URI versioning, Zod config and health: implement OIC-native from established patterns; no Responix AppModule/config import.
- Provider credential crypto/network controls: reference only; no provider traffic in Phase 1, and service-key verification uses separately reviewed primitives.
- Audit, scopes, Service Principal and Tenant guards: implement OIC-native; do not reuse Workspace/User-bound tables or guards.
- Prisma tooling: reuse patterns in a separate OIC schema/client/database package.
- OpenAPI workflow: reuse once OIC endpoints exist; do not generate now.
- Shared helper extraction: defer until stable generic contract and concrete shared need.

## 22. Proposed persistence entities

Proposals for the later approved schema; no schema is created in this task. Stable UUIDs; mutable display labels never identify or authorize. Enforce parent ownership in DB where possible; restrict destructive deletion; audit mutations.

- **OicApplication:** OIC-owned UUID, immutable unique machine-safe key, mutable display metadata, lifecycle/timestamps/audit. Parent of Tenants and Service Principals. No secrets; no hard delete when referenced.
- **OicTenant:** OIC-owned UUID, immutable optional tenant key, mutable display/lifecycle, one Application. Unique optional key within app; archive rather than delete.
- **OicTenantExternalReference:** OIC-owned UUID and immutable Application/source-type/opaque external identifier/Tenant mapping. Unique (Application, source/type, external ID); one Tenant may have multiple refs. Redact external ID in logs; audited revoke/remap.
- **OicServicePrincipal:** OIC-owned UUID, immutable key unique in app, mutable display/status, one Application; owns credentials/scope grants/optional tenant grants. No hard delete; auditable.
- **OicPrincipalScopeGrant:** Principal plus registered namespaced scope, granting actor/time; unique principal/scope; auditable grant/revoke.
- **OicPrincipalTenantGrant:** Principal/Tenant plus actor/time; same Application required; unique pair; absence denies; auditable grant/revoke.
- **OicMachineCredential:** OIC-owned UUID, public selector/prefix, secure verifier representation and verifier version, Principal, created/expiry/revocation times, replacement lineage, best-effort lastUsedAt. Never store plaintext; do not lock the crypto algorithm here. Unique selector; revoke/expire and retain history.
- **OicAuditEvent:** OIC-owned append-only event UUID/time, actor, Application/Tenant, action/target, request/trace IDs and allowlisted safe metadata. No secret/raw body; retention by approved policy.
- **OicIdempotencyRecord (bounded):** OIC-owned UUID, principal/scope/operation/key identity, canonical request hash, state, safe result ref and TTL. Unique principal+scope+operation+key; no secret/result body.

No organization, model, memory, knowledge, tool, cache or usage entity in Phase 1.

## 23. Proposed indexes/uniqueness/invariants

Unique app key; unique optional tenant key per app; unique (app, source, external key); unique principal key per app; unique principal+scope and principal+tenant; unique credential selector; index credential principal/status/expiry; unique idempotency tuple if adopted; audit indexes by app/time, tenant/time, actor/time and target. Enforce same-app mapping/grants with DB constraints (compound FKs where feasible), not service checks alone. No mutable display names as keys; no hard delete of referenced identity; scope cannot be arbitrary.

## 24. API/admin surface required

**APPROVED:** an internal OIC Administration API for foundation resources, used by controlled Oi operators/system provisioning. Bootstrap the initial OIC platform administrative identity using a protected internal mechanism/command that requires explicit deployment/operator authorization, is not a standing public bootstrap endpoint, never logs secrets and is auditable where practical. It creates only the minimum identity required to begin normal OIC administration. Thereafter administration uses authenticated OIC identity.

Required operations: Application create/read/limited metadata/lifecycle; Tenant create/read/lifecycle and external mapping create/revoke; Service Principal create/read/lifecycle; scope and tenant grants; credential issue/rotate/revoke; scoped audit read; health/readiness. No dashboard/UI or customer self-service. Exact routes/DTOs are implementation details. Never trust caller-supplied Application ID as authority; show credential secret once.

## 25. Security/threat model

| Threat | Mitigation | Required evidence |
|---|---|---|
| Leaked key | High entropy, verifier-only, least scope, expiry/revoke/rate limits | Revoke then deny; secret absent from DB/logs. |
| Cross-app/tenant | App from credential; same-app FK checks; explicit tenant grant; deny by default | Negative tests for foreign IDs and absent grants. |
| Replay/revoked-key reuse | TLS; immediate revocation bound; selectors never reused | Active succeeds, revoked/expired denied. |
| Scope escalation | Fixed registry and grant-authority checks | Unknown/unauthorized grant rejected. |
| ID enumeration | Scoped lookup and safe not-found policy | Foreign IDs reveal no metadata/existence. |
| Secret leakage | DTO/log/audit redaction and one-time issue | Capture errors/logs/audit; assert no secret/verifier. |
| Direct DB/product coupling | Separate role/database/client, no foreign imports | Dependency scan/config and DB-role review. |
| Audit gap/tamper | Append-only service policy; mutation+audit transaction | Audit failure rolls mutation back; update/delete denied. |
| Concurrent retry/rotation | Unique constraints and transactional transitions | Concurrent requests produce one valid result/history. |

## 26. Test plan

No tests run for this contract. Phase 1 focused tests must cover application and tenant isolation/immutability; external mapping uniqueness and same-app binding; principal ownership; credential verification, one-time display, rotation, expiry, revocation, selector uniqueness and throttled last-use; secret absence from responses/logs/errors/audit; scope and tenant grants including negative escalation; safe ID lookup; audit transaction rollback; idempotency replay/hash mismatch/lost secret; DB constraints; startup/config and health; package import direction. Run migration fixtures only on dedicated local OIC test DB. No production/shared data.

## 27. Migration strategy

During approved Phase 1 implementation, create the independent OIC schema/client/migration baseline using two OIC-owned databases: a development DB and a separate migration/test-validation DB. Both are distinct from Responix development, production/shared and customer databases. Do not assume a DB is disposable; establish isolation and explicit per-run authorization before destructive fixture operations.

Seed only deterministic non-secret development identities; never seed production credentials. Validate empty OIC DB deployment, constraints, repeatability, backup/restore and failure recovery. Prefer forward fixes; destructive rollback is not assumed. No OIC migration against Responix DATABASE_URL or production/shared data.

## 28. Implementation slices

Approved order; each slice checkpoints and leaves resumable evidence:

- **1A - OIC app/contracts/database skeleton:** independent app boot, contracts/database package wiring, OIC-only config and health skeleton. It MUST NOT silently begin Application/Tenant persistence or any later slice.
- **1B - Application/Tenant identity:** persistence, external mapping and scoped internal admin operations.
- **1C - Service Principal/credentials:** issuance, secure verifier, auth, rotation/revocation/expiry.
- **1D - Scopes/authorization:** namespaced grants, tenant restrictions and deny-by-default guards.
- **1E - Audit/request identity/idempotency:** safe atomic audit, request/trace/error primitives, bounded administrative idempotency.
- **1F - Operations:** config/secrets, logs, liveness/readiness and deployment boundary.
- **1G - Acceptance:** focused security/isolation, migration, dependency and resumability validation.
No slice changes Responix.

## 29. Acceptance matrix

- OIC boots independently without Responix modules.
- OIC DB role/schema/migration ownership is separate; no cross-product table access.
- Application, Tenant and external mapping identity/uniqueness/isolation proven.
- Service Principal authentication binds exactly to its Application.
- Credentials are one-time, verifier-only, revocable/rotatable/expirable per policy.
- Scopes/tenant grants default-deny, including negative cross-app tests.
- Audit is safe, scoped and atomic with mutations.
- Request/trace/error primitives are bounded and propagated.
- Idempotency prevents selected duplicate admin effects without replaying secrets.
- Config/health check only required OIC dependencies and reveal no secrets.
- No Responix source/config/schema/behavior/data changes.
- Dependency checks prove OIC imports generic infrastructure only.
- Focused tests and dedicated DB migration evidence pass; known limitations recorded.
- OIC package/app can be resumed and deployed independently.

## 30. Rollback/recovery

Credential revoke and Application/Principal suspension must take effect immediately for new auth decisions; any cache must not defeat the approved immediate revocation semantics. Preserve audit history. Recover administration through documented protected bootstrap/break-glass controls. Correct Tenant mappings only through audited explicit remap/revoke. Database recovery uses backup and forward fix, not assumed destructive rollback. Phase 1 has no OIC traffic to reroute and no Responix behavior to restore.

## 31. Dependency prohibitions

OIC must not import apps/api; Responix Agent, Conversation, CRM, Channel, Workflow, Memory, Knowledge or Tool modules; @responix/database types; Responix workspace JWT/guards/permissions/ApiKey/AuditLog; or Responix config requiring Dashboard/R2/AI/Redis. Responix must not use OIC database client. Integration is contracts/API/SDK only.

## 32. Phase 2 extension points

Reserve contract seams for Native Runtime, Oi Model/release entitlement, Provider Connections, variant bindings, OIU usage events, Context Compiler inputs, authorized memory/knowledge/tool refs, runtime idempotency, OpenAI gateway translation and trace drill-down. Do not create placeholder schemas/modules for them now.

## 33. Risks

Separate ownership can be undermined by shared Prisma clients or database roles; enforce package and credential isolation. Overbroad scopes risk cross-tenant exposure; use explicit grants and negative tests. Credential rotation/expiry implementations must honor optional expiry, short optional overlap and prompt revocation. External product IDs must remain opaque. Bootstrap credentials need controlled handling and shutdown of public bootstrap paths. Avoid overbuilding policy, plans, engines or runtime features. Preserve unrelated Responix dirty work untouched.

## 34. Locked owner decisions and implementation details

All owner decisions below are resolved for this contract; they are not human blockers:

1. **Database:** separate OIC PostgreSQL database, role, credentials, Prisma schema/client and migration history on approved infrastructure; two dedicated OIC dev and migration/test DBs. A shared physical server is acceptable; shared product tables/schema are not the selected topology.
2. **Application:** OIC-owned stable UUID + stable machine-safe key + mutable display metadata, lifecycle and audit.
3. **Tenant:** OIC-owned UUID under Application; external identity table; unique (Application, source/type, external identifier); opaque IDs; one Tenant may hold additional approved refs.
4. **Service Principal:** primary M2M identity, belongs to one Application, has status/scopes/optional Tenant grants/credentials/audit and immediate revocation. No Responix Workspace JWT.
5. **Credential:** high entropy, opaque, public identifier separate from secret, versioned/prefixed, shown once; verifier only, never plaintext/logged/returned again. Use reviewed repository-approved cryptography, not custom crypto.
6. **Lifetime:** expiry supported but not mandatory by default; ACTIVE/REVOKED/EXPIRED semantics.
7. **Rotation:** new credential with auditable lineage; optional controlled overlap; recommend approximately 24 hours only when overlap is explicitly requested; old key explicitly revoked after cutover.
8. **Last used:** best-effort/throttled; no DB write per request; update failure never fails authentication.
9. **Authorization:** namespaced explicit scopes, deny by default, no policy DSL; initial Application/Tenant/Service Principal read/manage, credential rotate/revoke, audit read, foundation administration; Tenant grants; no future Model/Tool/OIU scopes.
10. **Operator/bootstrap:** protected internal command/mechanism creates minimum initial platform admin identity, requires deployment/operator authorization, is not public/standing, avoids secret logs and is auditable where practical. No Phase 1 SSO unless safety requires it.
11. **Topology:** apps/oic-api, packages/oic-contracts, packages/oic-database; no packages/oic-client until Phase 2 has a concrete consumer.
12. **Extraction:** no Responix library extraction by default; only concrete safe/product-neutral/stable shared need, with separate integration gate for Responix changes.
13. **Idempotency:** administrative resource create and credential issue/rotation retries only; principal/scope/operation-aware. No runtime inference/accounting idempotency.
14. **Provisioning:** internal OIC Administration API after protected bootstrap; no dashboard or customer self-service.
15. **DB operations:** OIC-owned development and migration/test databases, never Responix/production/customer DB; do not assume disposable.

**Implementation details, not human blockers:** exact key casing, persisted equivalent enum vocabulary, database names, scope string spelling within the approved namespace, credential wire prefix/layout and reviewed verifier primitive, optional expiration policy per principal, configured overlap duration, last-used throttle, bootstrap command mechanics, admin routes/DTOs, DB migration/test fixture conventions, idempotency TTL, and audit retention. Select consistently during implementation and document security-relevant choices in the slice record.

## 35. Exact implementation path map

Likely implementation paths (not created in this contract update):
- apps/oic-api/package.json; src/main.ts; src/app/app.module.ts; src/config/*; src/modules/health/*; src/modules/identity/{application,tenant,external-reference}/*; src/modules/service-principal/*; src/modules/authentication/*; src/modules/authorization/*; src/modules/audit/*; src/common/{request-context,error-envelope,redaction}/*.
- packages/oic-contracts/package.json and src/*.
- packages/oic-database/package.json, prisma/schema.prisma, prisma/migrations/*, src/*.
- Root workspace/task configuration only if needed, with reviewed OIC-only scope.

Do NOT touch existing apps/api/**, apps/dashboard/**, packages/database/**, packages/auth/**, or packages/api-client/** in Phase 1. The new OIC app starts parallel to Responix, not by retrofitting it.

## Review status

**APPROVED / LOCKED.** This contract records the owner decision lock dated 2026-09-30. Phase 1 implementation is authorized in the approved slice order in Section 28. Begin with 1A only; completion of 1A does not authorize or start 1B or any later slice.

## Evidence index

OIC charter/boundary/direction and MOD-2 contract/progress in docs/project-state. Repository conventions: pnpm-workspace.yaml, package.json, apps/api/package.json, packages/database/package.json, packages/api-client/package.json. Bootstrap/config/health: apps/api/src/main.ts, apps/api/src/app/app.module.ts, apps/api/src/config/{environment.schema,configuration,config.module}.ts, apps/api/src/modules/health/*. Auth/tenant prior art: apps/api/src/modules/auth/{auth.guard,auth.repository}.ts, apps/api/src/modules/tenant/{tenant-context.service,tenant.guard}.ts, apps/api/src/modules/platform-control/permission-resolution.service.ts. Persistence: packages/database/prisma/schema.prisma (Workspace, ApiKey, AuditLog), apps/api/src/database/prisma.service.ts. Secret pattern: apps/api/src/modules/ai/security/provider-credential-crypto.service.ts. Client generation: packages/api-client/scripts/generate-openapi.mjs.
