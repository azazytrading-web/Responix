# MOD-2 Universal Model Catalog Contract

**Status: APPROVED / LOCKED**

**Authority:** project owner's final human decision lock and expanded Sprint A instruction, 2026-09-30.
**Baseline:** `frontend`, HEAD and `origin/frontend` at `a5d73fa14ffc5c97992b9dc405c91fba99070f34`.

## Product and boundaries

MOD-2 evolves the existing model identity into a provider-neutral catalog of built-in, provider-synced and workspace Custom Models, with explicit ownership, lifecycle, capabilities, pricing, operational evidence and eventual production eligibility. Existing approved protocols may admit additional model identifiers without a core release. New protocols still require reviewed provider adapters. MOD-1 remains closed with its private/local/self-hosted exception. MOD-3 owns the dashboard, Add Model and model-picker UI. The program order remains MOD-1 → MOD-2 → MOD-3 through MOD-10 → CRM.

## Identity, sources and ownership

- Preserve `AiModel.id` UUIDs and all Agent/history references. `providerModelId` is the exact provider identifier; backfill from `modelName`, retain `modelName` as compatibility alias and retain legacy execution until Sprint C. Display name, family and version are metadata, never executable identity.
- Provider identifiers are case-sensitive, bounded, nonempty, control-character-free opaque strings. No case normalization, endpoint parsing or executable interpretation.
- Sources are exactly `BUILT_IN`, `PROVIDER_SYNCED`, `CUSTOM`. Built-in models are global/platform-owned. Synced and Custom Models are workspace-owned. No additional source variants.
- Each model targets exactly one existing global `AiProvider` or same-workspace MOD-1 `CustomAiProvider`. Explicit foreign keys, an ownership constraint and target XOR must enforce this in PostgreSQL.
- Global uniqueness is provider target plus exact provider model ID. Workspace uniqueness adds the owner workspace. NULL semantics require deliberate partial unique indexes where necessary. Archived identities retain their reservation.
- Owner, provider target and provider identifier are immutable after Custom Model creation. A different executable identity requires a new record and explicit handling of the old lifecycle.

## Built-in and Custom Model lifecycle

Built-in metadata is platform-curated; seed reruns preserve IDs, update only approved curated fields and never overwrite workspace models. Preserve existing lifecycle values `ACTIVE`, `DISABLED`, `DEPRECATED`; add `ARCHIVED`.

Custom Models support create, visible list/get, mutable metadata update, archive and restore. Lifecycle changes are explicit and audited. New Custom Models remain non-production-selectable in Sprint A regardless of catalog ACTIVE status; no request flag may bypass this boundary.

**Human decision 7:** DEPRECATED remains historically addressable, prevents new Agent assignment and preserves existing assignments with warning information for future consumers. DISABLED prevents new selection and production execution. ARCHIVED leaves normal active usage but retains identity/history. The normal archive path must reject models referenced by active Agents with a deterministic conflict. No Agent mutation or hard deletion. An exception requires a separate documented human decision. Production consumer integration belongs to Sprint C.

## Provider synchronization and merge authority

**Human decision 1:** provider-synced results are workspace snapshots. Credentials, deployments, regions, organizations, subscriptions and entitlements can vary. Never publish workspace results globally. Future global sync requires platform-owned credentials/source, platform authorization, verified invariant vendor behavior and a separate bounded approval.

Sprint B owns explicit user/admin-triggered discovery, provider support classification, bounded pagination/timeouts/rate limits, sync run records, normalization and failure evidence. Verify provider-specific listing contracts before implementation. Generic `openai-chat-completions-v1` contracts no `/models` endpoint; manual model IDs remain supported without inventing listing support. No continuous worker is authorized.

Merge by exact scoped identity; never replace UUIDs. Preserve human display/category/restriction overrides and explicit lifecycle choices. Discovery may supply only fields actually returned and trusted for that provider, with source and observation time. Missing fields do not erase curated evidence; provider presence is not proof of execution capabilities or price. Conflicting evidence must remain attributable; workspace declarations cannot promote effective capability. Detailed provider normalization belongs to Sprint B and must conform to these rules.

**Human decision 5:** only COMPLETE sync may record missing/presence evidence. FAILED/PARTIAL sync must not apply missing evidence. Missing never automatically disables, deprecates, archives or deletes a model.

## Metadata and capability contract

Bound metadata to display name, family/version, optional positive context/output limits, controlled categories, lifecycle, source, timestamps and typed capability/pricing evidence. No arbitrary JSON metadata or arbitrary capability keys.

Capability state is `SUPPORTED`, `UNSUPPORTED`, `UNKNOWN`; provenance supports `PLATFORM_CURATED`, `PROVIDER_SYNC`, `MODEL_VALIDATION`, `WORKSPACE_DECLARED`. Use typed relational persistence that retains trusted evidence separately from workspace restrictions. Initial vocabulary covers text chat, streaming, tools, structured output, reasoning, vision input, image generation, audio input/output, video and embeddings; legacy function/audio distinctions must not be silently broadened. Metadata does not add execution support. MCP and fine-tuning are not new execution capabilities.

**Human decision 6:** workspace metadata may restrict or declare unverified information but cannot elevate UNKNOWN/UNSUPPORTED to effective SUPPORTED. Runtime requirements are satisfied only by effective SUPPORTED backed by accepted trusted provider/platform/validation evidence. Preserve protocol limits.

**Locked migration:** true legacy capability becomes SUPPORTED with trusted legacy/platform provenance; false becomes UNKNOWN. Never infer verified UNSUPPORTED from false defaults. Preserve explicit unsupported evidence only if provenance actually exists. Retain legacy fields during consumer transition.

## Pricing and accounting

**Human decision 4:** UNKNOWN is not zero/free. Persist explicit KNOWN/UNKNOWN, input/output and optional cached-input rates per million tokens, currency/unit, effective dates, source and observation/review time. Unknown serialization must not expose an authoritative zero rate. Known zero requires explicit provenance; no fabricated prices. Preserve historical `AiCostRecord` data and legacy price columns during transition.

Legacy zero without reliable provenance migrates to UNKNOWN. Inventory every nonzero price; ambiguous provenance/semantics requires stopping before schema edits for owner disposition. Known prices must remain attributable and effective-dated; do not present expired evidence as current truth.

Unknown pricing does not itself globally ban model use. Existing hard monetary controls requiring an estimate must fail closed or use their already-approved policy; never substitute zero to bypass a budget. Sprint A makes only necessary narrow safety changes; broad accounting integration belongs to C. Cost/speed/quality routing is excluded.

## Operational evidence and model validation

**Human decision 3:** exact-model validation is advisory, visible, timestamped and audited. No mandatory paid probe to create a record or establish general eligibility. A failure contributes evidence and never automatically deletes/archives/deprecates. Any later policy using recent evidence must be explicit.

Sprint B owns user-triggered bounded exact-model validation using the saved approved provider, one credential, one minimal call, no fallback/retry loop, no production Agent traffic, no Guard and no model creation as a side effect. Reuse MOD-1 transport/credential/security boundaries. Operational availability derives from attributable validation/invocation/discovery evidence, remains distinct from lifecycle and may be unknown. No continuous paid probing or health worker.

## Visibility, production eligibility, Agent and routing boundary

Built-in catalog data is globally visible; workspace records are visible only to their owner. Visibility must be explicitly distinguished from production eligibility.

**Human decision 2:** MOD-1 Custom Provider model integration belongs to MOD-2, with production Agent/routing integration in Sprint C. Sprint A permits Custom Model records against global or same-workspace custom targets while excluding them from existing production consumers. No provider lifecycle/protocol/security redesign.

Preserve existing built-in provider/model selections and deterministic ADR-014 routing. Sprint C integrates lifecycle, ownership, provider availability/configuration, credentials and trusted effective capabilities, preserves historical/deprecated assignments, and safely enables authorized Custom Models. Validation is advisory. No smart routing, forced Agent reconfiguration, second router or UI redesign.

## Persistence, API, permissions, security and audit

Evolve canonical `AiModel`; no wholesale replacement. Use a forward-only migration after 000043, deterministic backfill, explicit constraints and deliberately designed uniqueness. Do not rewrite MOD-1 migrations, use `db push`, recreate IDs or rewrite history. Prisma relations plus reviewed SQL CHECK/partial indexes are acceptable.

A provider-neutral catalog service/repository owns identity, visibility, lifecycle, Custom Model mutations and capability/price serialization. Controllers stay thin. Provide normalized paginated list/get and justified target/source/lifecycle/capability filters, with no generic query DSL. Preserve `GET /api/v1/ai/providers` response semantics.

Custom mutation permission is approved as `ai.models.write`; reuse `ai.providers.read` for catalog reads. Sprint B may reuse `ai.providers.validate`. Derive workspace and actor from authenticated tenant context; cross-workspace IDs follow existing non-disclosure behavior. Request DTOs reject workspace overrides, endpoints, base URLs, protocols, credentials, headers, arbitrary JSON, unknown fields and identity mutation. Bounds apply recursively. No new outbound behavior in Sprint A.

Audit Custom Model creation, updates, lifecycle/archive/restore, capability and pricing changes using safe bounded old/new summaries in the mutation transaction. Never emit secrets or raw provider payloads. Update existing permission registry/seeds with focused evidence.

## Execution sprints and acceptance gates

1. **A — Catalog Foundation:** mandatory live-data/FK/provenance inventory and Prisma feasibility; identity/source/ownership/lifecycle migration, typed capabilities/pricing, seed compatibility, workspace Custom Model backend/API, permissions/audit, isolation and compatibility tests, official OpenAPI regeneration and API/API-client typechecks.
2. **B — Provider Sync and Validation:** verified provider discovery integrations, bounded sync/run evidence and deterministic merge, complete-only missing evidence, exact-model validation, operational evidence, APIs and focused tests.
3. **C — Production Integration and Closeout:** Agent selection and Custom Provider model routing, lifecycle/capability/accounting compatibility, security regression, official OpenAPI and final documentation/acceptance evidence. MOD-2 is not complete at Sprint A closeout.

Before schema edits stop if rows cannot be classified global legacy/built-in, unknown workspace ownership appears, nonzero price provenance is ambiguous, unexpected FK consumers are unsafe, IDs cannot survive or Custom Provider ownership integrity cannot be database-enforced. Otherwise continue automatically under this approval.

Use the approved local PostgreSQL service safely. Existing databases are not disposable. Migration validation uses a new dedicated local database with full migration history, legacy fixtures and ID/FK/constraint evidence; no production/shared migrations. One significant process at a time. Focused suites, Prisma validation/generation, API and client typechecks, official OpenAPI generation, targeted lint and diff checks are required. No full monorepo suite or unnecessary build. Never claim unexecuted checks as passing. No commit/push under this instruction.

## References

- `MEGA_MODIFICATION_CONTINUATION_CHARTER.md`, `MOD_1_CLOSEOUT.md`, `MOD_1_UNIVERSAL_PROVIDER_ARCHITECTURE_CONTRACT.md`.
- `ARCHITECTURE_DECISIONS.md`: ADR-005, ADR-009, ADR-013, ADR-014, ADR-015 and canonical API transport decision.
- `packages/database/prisma/schema.prisma`, `seed.ts`, migrations 000001–000043; current AI, routing and Agent Studio consumers.
- Owner's MOD-2 master contract request and subsequent final human decision lock. The latter controls the seven decisions and the conditional Sprint A authorization recorded here.
