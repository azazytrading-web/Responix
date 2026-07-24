# Responix AI Context

## Current State

| Item                | Current state                                                                  |
| ------------------- | ------------------------------------------------------------------------------ |
| Version             | `0.4.0` private, unreleased workspace package                                  |
| Completed sprints   | Sprint 0 through Sprint 4                                                      |
| Current sprint      | Sprint 5 — AI Engine                                                           |
| Architecture status | Core Platform Complete                                                         |
| Repository health   | Install, Prisma validation/generation, typecheck, lint, tests, and build pass  |
| Runtime limitation  | Docker is unavailable locally; Compose verification remains pending externally |

Sprint 4 completed the multi-tenant core: authoritative workspace memberships, request-scoped tenant resolution, JWT and RBAC integration, workspace lifecycle, invitation and membership state machines, ownership invariants, audit records, workspace-scoped repositories, DTO validation, and API-quality hardening.

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

## Next Action

Sprint 5 — AI Engine is active. Perform an engineering review, read the approved Sprint 5 request and only its named official documentation, then inspect the current unstaged repository state before implementation.
