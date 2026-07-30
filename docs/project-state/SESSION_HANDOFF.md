# Session Handoff

## Current Repository State - 2026-07-30

Sprint 6E.7 is complete in the working tree. Unified provider streams now flow through
the existing invocation/runtime accounting, Streaming Runtime, Agent Execution, and
Execution Kernel boundaries. Usage is persisted as exact provider usage or explicit
`UNKNOWN`; token counts are never inferred from streamed text. The full validation
matrix passes. Changes remain intentionally uncommitted.

## Current Repository State — 2026-07-25

| Field               | Value                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| Current branch      | `feature/sprint-5b`                                                                     |
| Current version     | `0.4.0` private, unreleased                                                             |
| Completed sprint    | Sprint 4 — Workspace & Multi-Tenant Core                                                |
| Current sprint      | Sprint 5 — AI Engine                                                                    |
| Repository health   | Sprint 5B Packages 1-5 complete; final production validation passes             |
| Validation          | Prisma validate/generate, typecheck, lint, 74 API tests, and build passed       |
| Working-tree policy | Sprint changes are intentionally unstaged; do not commit, tag, or push without approval |

## Sprint 06 Phase 1 Scope

- Shared renderer-neutral platform contract DTOs live in `@responix/types`.
- Contracts cover dashboards, widgets, forms, navigation, themes, white-labeling, permissions/visibility, features, plugins, and future OpenAPI metadata.
- `PlatformExtensionRegistry` is the sole extension point for future widget and field metadata kinds.
- No frontend, API endpoint, database model, rendering, action execution, or business behavior is included.
- Prisma validation/generation, typecheck, tests, and build passed; full lint remained unverified after local ESLint workers stalled without diagnostics.

## Completed Sprint 4 Scope

- Authoritative workspace membership, tenant context, tenant/membership guards, and membership-derived RBAC.
- Workspace lifecycle, membership lifecycle, invitation lifecycle, audit records, transaction safety, and workspace-scoped repository hardening.
- DTOs, domain-error consistency, endpoint quality review, and automated API test coverage.

## Completed Sprint 5B Package 1 Scope

- Added AI dependency-injection tokens, provider adapter contract, OpenAI adapter skeleton, provider registry, and workspace-aware provider factory.
- Added workspace-scoped provider, credential, and provider-configuration repositories with explicit domain mappings.
- Added provider discovery and a callback-scoped credential boundary that decrypts only immediately before provider use.
- Registered provider components in `AiModule` without adding routing, invocation, HTTP, or later-package behavior.
- Added repository, registry, factory, and credential-boundary tests.

## Completed Sprint 5B Package 2 Scope

- Added a workspace-scoped routing repository for provider configuration, models, credentials, provider health, and routing metadata.
- Added capability, health, eligibility, priority, and fallback decision components.
- Added a provider-neutral routing service with deterministic selection and ordered fallback output.
- Registered routing through Nest dependency injection without adding provider invocation, prompts, HTTP, or later-package behavior.
- Added focused routing tests for capabilities, health, eligibility, priority, fallbacks, workspace isolation, and deterministic decisions.

## Completed Sprint 5B Package 3 Scope

- Added provider-neutral invocation execution, normalization, lifecycle persistence, usage and cost persistence, timeout handling, and failure classification.
- Removed caller-controlled tenant context from the invocation boundary.
- Invocation now derives workspace and membership identifiers only from authenticated request-scoped `ResolvedTenantContext`.
- Added regression coverage for forged identifiers, authenticated workspace enforcement, unresolved tenant rejection, and request-scope isolation.

## Completed Sprint 5B Package 4 Scope

- Added provider-neutral HTTP endpoints for provider discovery, routing resolution, and synchronous invocation.
- Added validated runtime request DTOs and explicit response DTO mapping that omits provider configuration, payloads, credentials, secrets, Prisma entities, and internal metadata.
- Applied the existing JWT, tenant, membership, and permission guard chain using `ai.configure` and `ai.invoke`.
- Added Swagger request, response, authorization, request-ID, and error documentation for every endpoint.
- Added stable AI error-to-HTTP mapping and regression coverage for controller delegation, request IDs, validation, serialization, and sensitive-field exclusion.

## Completed Sprint 5B Package 5 Scope

- Added a full Nest HTTP integration suite across provider discovery/registry/factory, routing, credential callback execution, invocation normalization/persistence, DTO serialization, and HTTP error handling.
- Added production regressions for forged tenant identifiers, credential and provider-payload redaction, provider failures, timeouts, request-ID propagation, authentication, and Swagger security metadata.
- Verified existing transaction rollback coverage and corrected the routing/invocation POST status contract to return the documented HTTP 200.
- Added [SPRINT_5B_PRODUCTION_VALIDATION.md](SPRINT_5B_PRODUCTION_VALIDATION.md) with automated evidence and the Docker-capable runtime checklist.

## Known External Blocker

Docker is unavailable locally (`docker` is not on `PATH`). Compose verification for PostgreSQL, Redis, API, Dashboard, and health endpoints remains pending on a Docker-capable host. This is not a repository defect.

## Historical Recommendation

Perform an engineering review before Sprint 5. Then read the approved Sprint 5 scope and only its named official documentation, inspect the unstaged working tree, and begin no work outside that approved scope.

## Recommended Next Action

Review the next approved Sprint 5 request and preserve the completed provider and routing boundaries. Do not add provider execution or other later behavior without explicit authorization.
