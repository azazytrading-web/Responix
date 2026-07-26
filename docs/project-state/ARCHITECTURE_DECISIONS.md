# Architecture Decisions

This ADR register records accepted decisions established by the repository through Sprint 1. Official technical documentation remains authoritative.

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

## ADR-012 — Production HTTP Baseline

- **Status:** Accepted
- **Context:** The API had Helmet, CORS, validation, and health routing but did not activate its installed Pino logger or provide compression, request IDs, proxy-aware configuration, or rate limiting.
- **Decision:** Activate Pino request/error/startup logging; generate or safely propagate request IDs; enable a configurable process-local global throttler; make compression enabled by default; and trust one proxy only when `TRUST_PROXY=true` is explicitly set.
- **Consequences:** The health endpoint stays observable without throttling, reverse-proxy deployments must set `TRUST_PROXY=true` only behind a controlled proxy, and horizontally scaled API deployments must replace process-local throttling with Redis-backed storage.

## ADR-013 - AI Provider and Credential Boundaries

- **Status:** Accepted
- **Context:** Sprint 5 requires provider implementations to remain replaceable while tenant credentials stay isolated from discovery and orchestration code.
- **Decision:** Register provider adapters through Nest injection tokens and a provider registry; resolve persisted providers through a workspace-aware factory; isolate Prisma access in mapped repositories; and expose decrypted credentials only through an immediate-use callback owned by the credential service.
- **Consequences:** Provider discovery never returns credential material, repositories do not expose Prisma entities, adapters are selected by persisted provider name, and future provider use must occur inside the credential callback without logging or retaining the secret.

## ADR-014 - Deterministic Provider-Neutral Routing

- **Status:** Accepted
- **Context:** Provider/model selection must be tenant-safe and repeatable without coupling routing to provider execution.
- **Decision:** Build workspace-scoped candidate snapshots from persisted configuration, active credential presence, model capabilities, and latest provider health; filter eligibility before ordering by provider, model, and credential priority with stable identifier tie-breakers; and return ordered fallbacks without invoking adapters.
- **Consequences:** Identical candidate state produces identical routing decisions, unhealthy or ineligible candidates are excluded, and provider invocation remains outside the routing module.

## ADR-015 - AI HTTP Boundary

- **Status:** Accepted
- **Context:** The completed provider, routing, and invocation foundations require an external API without weakening tenant, credential, or provider-neutral boundaries.
- **Decision:** Expose only provider discovery, routing resolution, and synchronous invocation through versioned Nest controllers; accept runtime-validated DTOs without tenant identifiers; derive invocation request IDs from the existing HTTP request-ID flow; reuse global JWT, tenant, membership, and permission guards; serialize explicit response DTOs; and map internal AI errors through an AI-scoped exception filter.
- **Consequences:** Controllers remain thin, authenticated tenant context stays authoritative, provider configuration and secrets are excluded from HTTP responses, and no provider-specific endpoint or new business behavior is introduced.
