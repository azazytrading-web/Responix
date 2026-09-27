# Responix AI Context

## WhatsApp Onboarding Baseline - 2026-08-09

The first user-facing Channel surface is implemented at `/channels/whatsapp`. It is a registered plugin and backend-manifest navigation entry, uses workspace-scoped TanStack Query state and the canonical API client, and consumes the existing Channel Runtime channel/connection/health/state APIs. The form submits Meta access token, verify token, and app secret as write-only password fields; responses and query data contain only safe connection metadata. Manual Meta Cloud configuration is supported; OAuth/Embedded Signup is not exposed by the backend and was not fabricated.

The active development manifest is revision 5 and authenticated bootstrap resolves WhatsApp alongside the existing FM-5/FM-6/FM-7 features. Dashboard typecheck, lint, 16 focused/regression tests, production build, database typecheck, targeted manifest/permission seeds, live health/bootstrap/API/route checks, and diff check pass.

## Real Provider and Agent Smoke - 2026-08-09

The earlier credential blocker is resolved. A Dashboard-configured encrypted DeepSeek credential validated successfully, a minimal published Agent executed through Agent Execution and Provider Runtime, and the real response matched `DEEPSEEK_SMOKE_OK`. Runtime/provider/model/usage records were persisted without credential material. Two runtime defects found by the smoke were fixed: Node 22 `lookup({all:true})` support in the pinned-DNS transport and PostgreSQL advisory-lock `void` deserialization. Agent Studio now persists the safe provider-configuration ID required by execution.

## FM-7 Live Smoke Status - 2026-08-09

The local production builds were started successfully: Dashboard `:3000`, API `:4000`, PostgreSQL, and Redis are healthy. Development authentication, `platform/current`, and `dashboard-runtime/bootstrap` pass; manifest revision 4 resolves Dashboard, Company, Platform Control, Team, Agents, Providers, and Prompt Library, and the Administrator resolves all three provider permissions. All six provider definitions and their safe configuration endpoints respond, with no credential material returned.

No real provider credential exists in process/user/machine environment variables or repository environment files, and the workspace has zero configured credentials. External provider validation and real Agent execution are therefore **BLOCKED by credential availability**, not by a code defect. No provider configuration or Agent record was fabricated. The post-FM-7 frontend milestone is not explicitly ordered in current roadmap records and must not start until this smoke test resumes with an authorized credential.

## Frontend Feature Status - FM-7 - 2026-08-09

FM-7 is complete in the working tree. Provider discovery/capability UI at `/ai/providers` now uses workspace-scoped safe configuration read/upsert and live validation contracts in addition to `GET /api/v1/ai/providers`. Credentials are write-only, AES-256-GCM encrypted, fingerprinted, never returned, and preserved when omitted. Prompt Library management is implemented at `/ai/prompts`, `/ai/prompts/new`, and `/ai/prompts/[promptId]` with real list/search/pagination, draft create/update, publish, archive/restore, favorite, categories, tags, variables, and immutable-state behavior.

Providers and Prompt Library are registered plugins and development-manifest entries using permission-only visibility. Provider actions require `ai.providers.read`, `ai.providers.write`, and `ai.providers.validate`; discovery retains `ai.configure` compatibility. Focused backend and frontend validation, API and Dashboard builds, Prisma validation, database typecheck, permission seed, and diff check pass. Do not invent or expose secrets.

## Frontend Feature Status - FM-6 - 2026-08-09

FM-6 is complete in the working tree. Agent Studio is a registered built-in plugin with real workspace-scoped list, create, persisted draft edit, and publish flows at `/ai/agents`, `/ai/agents/new`, and `/ai/agents/[agentId]`. It consumes Agent Studio CRUD/publish, AI provider/model capability data, and Prompt Library bindings through the canonical API client and TanStack Query.

Do not invent inline prompt fields, provider/model catalogs, credentials, resource IDs, or workflow assignments. The Agent DTO supports an existing Prompt Library binding plus capability booleans; it does not support memory/retrieval/tool resource IDs or workflow assignment. Dashboard typecheck, lint, 72/72 tests, production build, and diff check pass. The next frontend milestone is provider and prompt resource configuration; do not revisit FM-1 through FM-6 without a concrete defect.

## Frontend Feature Status - FM-5 - 2026-08-09

FM-5 is complete in the working tree. The Dashboard now has four coherent built-in feature modules: backend-bootstrap-backed Dashboard Home, current Workspace Management with real GET/PATCH integration, read-only Platform Control, and Team Management with real workspace-member APIs. Team Management provides permission-aware listing, pagination, invitations for existing users, role changes, suspend/restore, invitation cancellation, and member removal at `/company/members`.

Dashboard typecheck, lint, 10 focused feature test files with 33 tests, the final 3-file Team subset with 9 tests, and the Dashboard production build pass. Database typecheck, the focused workspace response DTO test, and `git diff --check` pass. The next frontend milestone is Agent configuration; do not revisit FM-1 through FM-5 without a demonstrated defect.

## Frontend Foundation Status - FM-4 - 2026-08-02

FM-4 is complete. `@responix/state` owns the canonical workspace-keyed platform bootstrap service for `platform/current` and `dashboard-runtime/bootstrap`. The Dashboard composes Theme, Query, Auth, and Platform bootstrap providers and waits for authentication and bootstrap readiness before rendering protected content. Permissions, features, workspace metadata, and navigation are exposed atomically. Bootstrap caches invalidate on logout, workspace switch, and authentication loss. FM-5 is not started.

## Authoritative Frontend State — Sprint FM-2 — 2026-08-01

FM-2 is **complete** and FM-3 is **not started**. `@responix/api-client` is the sole frontend HTTP transport owner. It consumes raw NestJS DTOs, exports the generated OpenAPI contract, and provides query serialization, request metadata, timeout/abort behavior, empty-response handling, backend error normalization, and replay-capable interceptor integration points. The duplicate Dashboard API layer and unsupported shared endpoint catalog were removed.

FM-2-owned packages pass typecheck, lint, tests, and build. Dashboard validation passes. Workspace typecheck, tests, build, and diff check pass; root lint has one unrelated deferred authentication-package unused constant recorded in `KNOWN_ISSUES.md`. Older sprint descriptions below are historical and do not authorize FM-3 work.

## Current State

| Item                | Current state                                                                  |
| ------------------- | ------------------------------------------------------------------------------ |
| Version             | `0.4.0` private, unreleased workspace package                                  |
| Completed sprints   | Sprint 0 through Sprint 4                                                      |
| Current sprint      | Sprint 5 — AI Engine                                                           |
| Architecture status | Core Platform Complete                                                         |
| Repository health   | Prisma validation/generation, typecheck, lint, 69 API tests, and build pass       |
| Runtime limitation  | Docker is unavailable locally; Compose verification remains pending externally |

Sprint 4 completed the multi-tenant core: authoritative workspace memberships, request-scoped tenant resolution, JWT and RBAC integration, workspace lifecycle, invitation and membership state machines, ownership invariants, audit records, workspace-scoped repositories, DTO validation, and API-quality hardening.

Sprint 5B Package 1 completed the provider foundation: AI dependency-injection tokens, a provider-neutral adapter boundary, OpenAI adapter registration, provider registry and factory, workspace-scoped provider/credential/configuration repositories, provider discovery, and callback-scoped credential decryption.

Sprint 5B Package 2 completed the routing foundation: workspace-scoped routing snapshots, capability and health resolution, eligibility filtering, deterministic priority selection, ordered fallbacks, and provider-neutral routing decisions. The routing layer does not invoke providers or execute AI requests.

Sprint 5B Package 3 completed the invocation foundation. Its public invocation boundary accepts only an AI request; workspace and membership authority come exclusively from the authenticated request-scoped `ResolvedTenantContext`. Provider execution, credential use, normalization, persistence, timeout handling, and failure classification remain behind provider-neutral internal boundaries.

Sprint 5B Package 4 completed the HTTP boundary for provider discovery, routing resolution, and synchronous invocation. Runtime DTOs, explicit response serialization, existing JWT/tenant/membership/permission guards, Swagger documentation, request-ID propagation, and safe AI error mapping protect the provider-neutral service layer.

Sprint 5B Package 5 completed final validation and production hardening. Full-stack Nest integration coverage verifies the Provider -> Routing -> Invocation -> HTTP path, tenant isolation, credential redaction, failure and timeout behavior, request IDs, Swagger security metadata, and lifecycle persistence. Sprint 5B implementation is complete.

## Required Session Reading Order

Before implementation, read:

1. [AI_BOOTSTRAP.md](AI_BOOTSTRAP.md)
2. [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
3. [KNOWN_ISSUES.md](KNOWN_ISSUES.md)
4. [ENGINEERING_WORKFLOW.md](ENGINEERING_WORKFLOW.md)
5. [AI_RULES.md](AI_RULES.md)
6. [PROJECT_VERSION.md](PROJECT_VERSION.md)
7. [VALIDATION_HISTORY.md](VALIDATION_HISTORY.md)
8. [ROADMAP_STATUS.md](ROADMAP_STATUS.md)
9. [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md)

Read only the official documents named by the approved active-sprint request. Do not infer product requirements beyond those documents.

## Architecture Summary

| Area             | Current architecture                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Workspace        | pnpm workspaces with Turborepo and strict TypeScript                                                                        |
| Dashboard        | Next.js 15 dashboard foundation                                                                                             |
| API              | NestJS 11 with validation, structured logging, security middleware, and health endpoints                                    |
| Frontend API     | Canonical `@responix/api-client` using raw NestJS DTOs and generated OpenAPI types; no Dashboard-local client               |
| Data             | Prisma 6, PostgreSQL, pgvector, UUIDs, migrations, and audit records                                                        |
| Identity         | Argon2id passwords, JWT access/refresh tokens, persisted revocable sessions                                                 |
| Authorization    | WorkspaceMembership is authoritative; tenant context, membership guards, RBAC, and permission guards scope protected access |
| Tenant isolation | Workspace-scoped repositories and validated active membership on authenticated workspace requests                           |
| Local services   | Docker Compose defines PostgreSQL, Redis, API, and Dashboard                                                                |

## Validation and Runtime

Sprint 4 validation passed: `pnpm install`, `pnpm prisma validate`, `pnpm prisma generate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. The API Jest suite contains five suites and sixteen tests.

`docker compose up --build` could not run because the local `docker` command is unavailable on `PATH`. This is an external environment limitation, not a repository validation failure. PostgreSQL, Redis, API, Dashboard, and Compose health verification must be run on a Docker-capable host.

## Package 1 Handoff

Sprint 5 remains active. Begin Package 2 only from an approved Package 2 request after reviewing the completed Package 1 boundaries and current repository state.

## Package 2 Handoff

Sprint 5 remains active. Begin any later package only from its approved request, preserving the provider-neutral decision boundary and the prohibition on provider execution inside routing.

## Historical Next Action

Sprint 5 — AI Engine is active. Perform an engineering review, read the approved Sprint 5 request and only its named official documentation, then inspect the current unstaged repository state before implementation.
