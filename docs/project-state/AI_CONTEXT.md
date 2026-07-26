# Responix AI Context

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
