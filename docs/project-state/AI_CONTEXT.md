# Responix AI Context

## Project Name and Goal

| Item              | Current state                                                                       |
| ----------------- | ----------------------------------------------------------------------------------- |
| Project name      | Responix                                                                            |
| Goal              | Enterprise multi-tenant AI customer-engagement platform.                            |
| Version           | `0.0.0` private workspace package.                                                  |
| Development model | Sprint-based and core-first.                                                        |
| Source of truth   | `MASTER_CODEX_PROMPT.md` and relevant files in `Official Technical Documentation/`. |

Do not redesign documented architecture or infer requirements absent from the active sprint request and official documentation.

## Architecture Summary

```mermaid
flowchart TB
  Dashboard[apps/dashboard: Next.js] --> API[apps/api: NestJS]
  API --> Database[Prisma and PostgreSQL]
  API --> Redis[Redis]
  Dashboard --> Shared[types, ui, utils]
  API --> Shared
  Config[packages/config] --> Dashboard
  Config --> API
```

| Area                    | Current technology                               |
| ----------------------- | ------------------------------------------------ |
| Language                | Strict TypeScript                                |
| Workspace               | pnpm 9 workspaces and Turborepo                  |
| Dashboard               | Next.js 15, React 19, Tailwind CSS               |
| API                     | NestJS 11, Swagger/OpenAPI, Terminus             |
| Data                    | Prisma 6, PostgreSQL with pgvector               |
| Cache and queues        | Redis; BullMQ is installed in the API foundation |
| Object storage contract | Cloudflare R2 environment variables              |
| Local orchestration     | Docker Compose                                   |
| Quality                 | ESLint 9, Prettier 3, TypeScript                 |

## Repository Structure

| Path                                              | Purpose                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/api`                                        | NestJS API, configuration validation, Swagger, URI-versioned health module. |
| `apps/dashboard`                                  | Next.js dashboard foundation and route groups.                              |
| `packages/config`                                 | Shared ESLint, Prettier, and TypeScript configuration.                      |
| `packages/database`                               | Prisma schema, migrations, and client entry point.                          |
| `packages/types`, `packages/ui`, `packages/utils` | Reusable cross-application packages.                                        |
| `infra/postgres`                                  | PostgreSQL startup assets, including pgvector enablement.                   |
| `Official Technical Documentation`                | Official requirements and architecture source.                              |

The current Prisma foundation contains `Workspace`, `User`, and `AuditLog` models with UUIDs, audit fields, indexes, and soft-delete timestamps where applicable. It is not the complete documented data model.

## Completed Sprints, Current Sprint, and Validation

| Item             | State                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| Completed sprint | Sprint 0 — Foundation                                                           |
| Current sprint   | No Sprint 1 implementation has started.                                         |
| Product features | Not implemented; Sprint 0 excluded business features.                           |
| Validation       | `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` passed.            |
| Runtime          | Dashboard/API startup and hot reload verified with temporary API configuration. |

Sprint 0 delivered the monorepo, API and Dashboard foundations, shared packages, Prisma/pgvector assets, Redis/Compose configuration, R2 configuration contract, and `GET /api/v1/health`.

## Development Rules and Coding Rules

1. Read this file, `SESSION_HANDOFF.md`, `KNOWN_ISSUES.md`, and only the official documents named by the active sprint before work.
2. Plan affected modules, files, dependencies, and validation before implementation when approval is required.
3. Follow the documented order: structure, interfaces/types, DTOs, entities, repositories, services, controllers, tests, documentation.
4. Do not create placeholder features, fake code, speculative packages, or hard-coded AI providers.
5. Use strict TypeScript. Keep code modular, typed, reusable, testable, and aligned with Clean Architecture, SOLID, DI, repository/service/DTO patterns, API-first design, and tenant isolation.
6. Validate inputs and configuration. Do not commit secrets, generated output, or local environment files.

## Current Runtime Status

| Component            | Verified state                                                             |
| -------------------- | -------------------------------------------------------------------------- |
| Dashboard            | HTTP 200 at `http://localhost:3000`.                                       |
| API                  | Nest started with temporary process-only configuration.                    |
| Health endpoint      | HTTP 200 at `http://localhost:4000/api/v1/health`, returning `status: ok`. |
| API hot reload       | Nest incremental compilation and restart verified.                         |
| Dashboard hot reload | Next recompilation verified after a metadata-only source touch.            |

## Infrastructure, Docker, Database, and Redis Status

Docker Compose defines PostgreSQL, Redis, API, and Dashboard. In the recorded Windows environment, `docker` was unavailable on `PATH`, so `docker compose up -d` could not run. PostgreSQL port 5432 and Redis port 6379 were unavailable. This is an environment limitation, not a repository failure.

- **Docker:** Compose assets exist; runtime execution is pending on a Docker-capable host.
- **Database:** Prisma generation and schema/migrations are present; no running PostgreSQL instance was verified.
- **Redis:** Compose configuration is present; no running Redis instance was verified.
- **Local command when Docker is available:** `docker compose up -d`, followed by `docker compose ps`.

## Current Known Limitations

- No persistent local `.env` was present. The API correctly rejects missing required configuration; use an uncommitted `.env` derived from `.env.example` or temporary process variables for limited verification.
- Windows local validation/builds use constrained concurrency because parallel workers previously exhausted available resources.
- Dashboard standalone output is enabled for Linux/Docker and disabled on Windows because Windows symlink creation was denied.
- Next production build emits a non-fatal plugin-detection warning despite passing the configured lint pipeline.

## Definition of Done and Required Validation

A sprint is done when its approved scope is implemented, required tests/validation/runtime checks pass, relevant documentation and handoff state are updated, and no critical defect is deferred without an explicit record.

Before every commit or review handoff, run:

`pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`

## Branch Strategy and Commit Strategy

- Use focused branches: `feature/<scope>`, `fix/<scope>`, `docs/<scope>`, or `chore/<scope>`.
- Use Conventional Commit-style messages, such as `feat(api): add workspace authentication`.
- Do not mix generated files, secrets, or unrelated refactoring into a focused change.
- Current limitation: `git status` reported this workspace was not a Git repository during Sprint 0 tooling. Verify `.git` metadata before relying on branch or commit commands.

## How Future AI Sessions Should Continue

1. Read this context, the latest handoff, development log, and known issues.
2. Confirm the active sprint and read only its named official documents.
3. Inspect current repository and Git state; do not assume previous environment state persists.
4. Implement only active-sprint scope and fix root causes rather than suppressing failures.
5. Update project-state documents at handoff.

## Current Repository Health

Sprint 0 workspace validation passed. Dashboard and API runtime behavior were verified with valid temporary configuration. Complete infrastructure runtime verification remains blocked only by unavailable Docker, PostgreSQL, Redis, and persistent local configuration in the recorded Windows environment.
