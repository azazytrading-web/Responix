# Architecture Decisions

This ADR register records decisions established by the repository and Sprint 0. Official technical documentation remains authoritative.

## ADR-001 — Enterprise Modular Monorepo

- **Status:** Accepted
- **Context:** Responix has Dashboard, API, shared type/UI/utility/configuration, and data concerns.
- **Decision:** Use one repository with applications in `apps/` and reusable packages in `packages/`.
- **Consequences:** Shared contracts/tooling are centralized; package boundaries must prevent duplication.

## ADR-002 — pnpm Workspaces and Turborepo

- **Status:** Accepted
- **Context:** The monorepo needs dependency-aware package management and task execution.
- **Decision:** Use pnpm workspaces and Turbo for build, lint, typecheck, test, and development orchestration.
- **Consequences:** Validation tasks use concurrency `1` for current Windows reliability, trading throughput for predictable resource use.

## ADR-003 — Next.js Dashboard and NestJS API

- **Status:** Accepted
- **Context:** The platform needs a React dashboard and modular documented HTTP API.
- **Decision:** Use Next.js for `apps/dashboard` and NestJS for `apps/api`.
- **Consequences:** Dashboard uses App Router conventions; API uses DI, configuration validation, Swagger, URI versioning, and health modules.

## ADR-004 — Shared Workspace Packages

- **Status:** Accepted
- **Context:** Applications need shared configuration, database access, types, UI primitives, and utilities.
- **Decision:** Maintain `@responix/config`, `@responix/database`, `@responix/types`, `@responix/ui`, and `@responix/utils`.
- **Consequences:** Add shared behavior only for valid shared consumers; do not create speculative packages.

## ADR-005 — Prisma, PostgreSQL, and pgvector

- **Status:** Accepted
- **Context:** The documented platform needs relational multi-tenant data and future vector capability.
- **Decision:** Use Prisma with PostgreSQL and initialize the `vector` extension through migration/startup assets.
- **Consequences:** Schema changes require migrations. Existing models are foundation-only and do not authorize undocumented modules.

## ADR-006 — Redis and Docker Compose

- **Status:** Accepted
- **Context:** Redis is documented for caching, queues, sessions, rate limiting, and temporary state; local infrastructure must be reproducible.
- **Decision:** Define PostgreSQL, Redis, API, and Dashboard in Docker Compose.
- **Consequences:** Complete runtime verification requires Docker and valid environment configuration.

## ADR-007 — Cloudflare R2 Contract

- **Status:** Accepted
- **Context:** Object storage configuration is required without committing provider secrets.
- **Decision:** Validate Cloudflare R2 environment variables at API startup; do not provide local object-storage emulation in Sprint 0.
- **Consequences:** Local API configuration needs R2 values even before storage features exist.

## ADR-008 — Strict TypeScript and Typed Linting

- **Status:** Accepted
- **Context:** Responix requires production-grade maintainability.
- **Decision:** Use strict TypeScript, shared ESLint/Prettier, and type-aware rules scoped to TypeScript source.
- **Consequences:** Generated and standalone tool files require explicit configuration treatment; rules are not disabled to hide defects.

## ADR-009 — API Routing Contract Uses `/api/v1`

- **Status:** Accepted
- **Context:** Docker Compose probes `/api/v1/health`, while the initial Nest application exposed `/v1/health`.
- **Decision:** Add Nest’s global `api` prefix while retaining URI versioning.
- **Consequences:** Health is available at `GET /api/v1/health`; future API routes follow the same prefix/version contract.

## ADR-010 — Nest Builds Regenerate Clean Output

- **Status:** Accepted
- **Context:** Nest clears `dist`, but TypeScript reused stale incremental metadata outside `dist` and emitted no `main.js`.
- **Decision:** Disable incremental compilation in `apps/api/tsconfig.build.json`.
- **Consequences:** Builds/watch compilation are less incremental but always regenerate runtime output after a clean.

## ADR-011 — Windows-safe Next Builds

- **Status:** Accepted
- **Context:** Local Windows standalone tracing failed on symlink creation and parallel static workers exhausted resources.
- **Decision:** Limit Next build CPUs to one and enable standalone output on non-Windows platforms only.
- **Consequences:** Docker/Linux retains the standalone artifact expected by the Dockerfile; Windows builds are slower and use standard `.next` output.
