# MOD-2 Sprint A — Catalog Foundation

**Status:** COMPLETE / HUMAN ACCEPTED. MOD-2 itself remains IN PROGRESS; Sprint B/C remain future work. The package-wide API typecheck is BLOCKED BY RESOURCE LIMIT, explicitly accepted as a Sprint A validation limitation and not a PASS.
**Contract:** `MOD_2_UNIVERSAL_MODEL_CATALOG_CONTRACT.md` (APPROVED / LOCKED).
**OIC direction:** `OIC_ARCHITECTURE_DIRECTION.md` (approved conceptual direction only).
**Working baseline:** `frontend`, `a5d73fa14ffc5c97992b9dc405c91fba99070f34`, equal to `origin/frontend`.

## Gate A inventory

Read-only inventory of the owner-approved local development database found six `AiProvider` and six `AiModel` rows, each matching one current built-in seed definition. Every `provider_model_id` source value (`model_name`) is present and nonempty. All six legacy input/output prices are zero-default; no nonzero model prices required provenance disposition. The six model capability boolean sets are all false-default, with no curated true evidence. The six rows classify as global built-ins. Existing UUIDs remain unchanged.

There were 27 `AiAgent` rows referencing model identities; 3 Agents were `PUBLISHED` and the other 24 were archived. The database also contained 393 invocation, usage, cost, routing and runtime-accounting rows each; 391 runtime-optimization provider outcomes; 42 runtime preparations and 42 runtime snapshots; 20 provider requests and 20 request snapshots; no cache metadata or stream sessions; no enabled Agent fallbacks. Direct FK inventory found the known Agent, invocation, usage, cost, routing, cache, runtime-accounting and runtime-optimization consumers; no unmodeled FK consumer was found. No secrets were read or printed. The inventory was read-only; the normal development database was not migrated.

**Gate A: PASS.** PostgreSQL compound FKs already used for MOD-1 Custom Provider credentials establish a repository precedent for the owner-workspace composite FK. Canonical AiModel UUID evolution retains all existing FK compatibility. PostgreSQL CHECK and partial unique indexes implement XOR, ownership and scoped exact identity semantics that Prisma cannot declare directly.

## Persistence and migration

`packages/database/prisma/schema.prisma` evolves canonical `AiModel`: nullable explicit global `providerId`, same-workspace `customProviderId` composite relation, nullable owner workspace, exact bounded `providerModelId`, controlled source, family, context/output limits and additive `ARCHIVED` status. Existing `modelName`, legacy capability/pricing fields, stable UUID, provider FK and history relations remain.

Forward-only migration `000044_universal_model_catalog_foundation` retains every model UUID, aliases `provider_model_id = model_name`, classifies legacy rows as global `BUILT_IN`, and leaves existing lifecycle unchanged. Nine true/false capability booleans map to `PLATFORM_CURATED` `SUPPORTED`/`UNKNOWN` rows, respectively; no false boolean becomes `UNSUPPORTED`. Legacy zero prices create dated `UNKNOWN` records with NULL rates. Historical cost records are untouched. The migration refuses to apply if any nonzero legacy model price lacks owner disposition.

Database constraints enforce one provider target, source/owner consistency, composite Custom Provider/workspace integrity, bounded opaque IDs, positive optional limits, identity immutability, no hard deletion, rate/state/date/currency validity, and three partial unique indexes for global-provider, workspace-provider and workspace-Custom-Provider identities. `ai.models.write` is seeded and granted to platform Owner/Administrator roles. Partial indexes and CHECK constraints are intentional reviewed SQL.

## Catalog API and Custom Models

`ModelCatalogRepository`/`ModelCatalogService` own tenant-visible queries, identity, capability/pricing mapping, lifecycle, mutations and transactional audit. `ModelCatalogController` exposes:

- `GET /api/v1/ai/models` — page/limit, source, lifecycle, one provider target and trusted-supported catalog capability filter.
- `GET /api/v1/ai/models/:modelId`.
- `POST /api/v1/ai/models` — exactly one active global provider or same-workspace, non-archived, approved MOD-1 Custom Provider target.
- `PATCH /api/v1/ai/models/:modelId` — metadata, restricted workspace evidence/pricing and ACTIVE/DISABLED/DEPRECATED lifecycle only.
- `POST /api/v1/ai/models/:modelId/archive` and `/restore` — retained identity; restore returns DISABLED.

Built-ins are globally visible catalog data; all workspace models are visible only to their owner. Workspace authority and actor come from authenticated tenant context. Cross-workspace reads/mutations return the existing non-disclosure not-found form. DTOs forbid unapproved fields, workspace overrides, target/identity mutation, endpoints, protocols, credentials, arbitrary headers, arbitrary JSON and unrecognized capabilities/categories. `ai.providers.read` gates reads; `ai.models.write` gates mutations. Existing `GET /api/v1/ai/providers` semantics are retained.

Archival rejects ACTIVE/PUBLISHED, non-archived Agent references with `MODEL_HAS_ACTIVE_AGENT_REFERENCES`; no Agent is modified. Create, updates, capabilities, pricing, lifecycle, archive and restore are transactionally audited with bounded safe fields. Audit failure rolls back mutation. Audit payloads contain no endpoints, secrets or raw vendor material.

## Capabilities, prices and OIC compatibility

Capability evidence is typed by a closed enum, state and provenance. Trusted evidence is separated from `WORKSPACE_DECLARED`; workspace SUPPORTED cannot promote trusted UNKNOWN/UNSUPPORTED, while workspace UNKNOWN/UNSUPPORTED can restrict. Historical MCP true evidence is retained but its catalog state is always UNKNOWN and the public DTO rejects MCP declarations. The model API field is `catalogState`, explicitly not final runtime eligibility; OIC must combine upstream evidence with transport/auth profile, Provider Connection entitlement and application/workspace restrictions.

Pricing records represent upstream per-million-token model metadata, not connection billing, customer economics or Oi Units. UNKNOWN rates serialize without numeric zero, currency or “free” claim. KNOWN zero is emitted only as explicit rate with source, unit and effective date. Expired/missing prices serialize UNKNOWN. Existing Agent accounting still uses the existing configured runtime estimate for hard reservations; new Custom Models cannot enter invocation pricing lookup in Sprint A. Broader pricing/accounting integration remains Sprint C.

OIC compatibility check found no Sprint A schema redesign required: `AiModel` remains upstream identity (not an Oi product/family/edition/revision); no connection availability is represented as global fact, and workspace sync/custom snapshots retain ownership; pricing is not a sole future billing truth; Custom Models remain explicitly outside production routing. No OIC Provider Connection, runtime, OAuth, model products, compatibility gateway, metering or UI is implemented.

## Compatibility and deliberate scope boundary

Seed helper safely upserts curated built-in display/context metadata while preserving UUID, provider model identity, source, lifecycle, capabilities, pricing and workspace records. Existing provider discovery, routing, invocation, Agent Studio, Agent runtime, provider runtime and runtime-optimization consumers explicitly select only global BUILT_IN models. Workspace models return `SPRINT_C_REQUIRED` production integration status. Provider sync, connection-scoped availability, model validation, health, routing integration, OIC and MOD-3 UI remain excluded.

## Validation evidence at resume

- Prisma schema validation passed before migration finalization.
- Full migration history 000001–000043 and migration 000044 were deployed only to the newly created local `responix_mod2_catalog_test` database. A controlled legacy fixture proved six model/provider IDs, aliases, 63 capability rows (true→SUPPORTED, false→UNKNOWN), six UNKNOWN prices, Agent FK, historical cost and three identity indexes.
- Dedicated database seed rerun: 12 upserts kept all six built-in IDs and did not alter workspace model data.
- Focused MOD-2 suites: 2 suites, 80 tests passed. They cover DTO bounds/injection, capability semantics, UNKNOWN/known zero serialization, permissions/tenant authority, FK/XOR/uniqueness, lifecycle/archive references, audit, isolation, seed and production-path exclusions.
- API package typecheck (`pnpm --filter @responix/api typecheck`) is **BLOCKED**: Node reached ~1.2 GB and exited 134 with `FATAL ERROR: NewSpace::EnsureCurrentCapacity Allocation failed - JavaScript heap out of memory`; no TypeScript diagnostic was emitted. No heap increase was attempted.
- One integration test run initially had a repeated fixture Agent name; the fixture was corrected and final combined rerun passed.
- Focused TypeScript check for the MOD-2 catalog controller/DTO/repository/service/semantics passed. The package-wide API check remains blocked; it is not reported as a pass.
- Current-source `GET /docs-json` was served from the Nest application at localhost against the dedicated MOD-2 database environment; four catalog paths and six list/get/create/update/archive/restore operations were present. Official `pnpm --filter @responix/api-client openapi:generate` added 328 lines to `packages/api-client/src/generated/api.types.ts`: all additions describe the MOD-2 routes/DTOs; no unrelated or suspicious churn was found. Generated output was not manually edited.
- `pnpm --filter @responix/api-client typecheck` passed.
- Targeted ESLint passed for all changed API catalog, controller consumer, type, and test files. Targeted ESLint also passed for `packages/database/prisma/model-catalog.seed.ts` and `packages/database/prisma/tests/mod2-seed.ts`. Initial findings in DTO validation/test assertions and the test helper type boundary were corrected.
- Final `git diff --check` passed. No staged changes were created.

No commit or push. Original unrelated project-state edits and `SPRINT_CRM_1_CHARTER.md` remain untouched. No production/shared database migration occurred. No generated API output has been edited by hand.

## Human review gate

Sprint A was accepted complete at human closeout with the package-wide API typecheck recorded as BLOCKED BY RESOURCE LIMIT: Node exhausted the heap at about 1.2 GB, exited 134 and emitted no TypeScript diagnostics. The owner explicitly accepted this as a documented validation limitation, not a pass. Focused MOD-2 TypeScript, focused tests, API-client typecheck, targeted lint and diff check passed. MOD-2 itself remains IN PROGRESS. Sprint B owns verified provider discovery/sync, merge/history, exact-model validation and operational evidence. Sprint C owns Agent and Custom Provider production integration, final accounting/routing compatibility and MOD-2 closeout. The separate OIC Master Architecture Charter follows Sprint A closeout; OIC implementation has NOT started.
