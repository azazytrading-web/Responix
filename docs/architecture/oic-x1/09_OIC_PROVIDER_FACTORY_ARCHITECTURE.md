# OIC Provider Factory Architecture

**DECIDED:** Provider Factory is the operator workspace for the provider definition, provider connection, protected credential, synchronization and upstream catalog chain. **CURRENT schema:** provider definitions declare auth strategy and transport profiles; connections have PLATFORM/APPLICATION/TENANT scope, optional application/tenant, endpoint, lifecycle and health status; credentials are separate versioned records; health checks and sync runs are records; upstream models retain source, lifecycle, capability evidence and pricing evidence. A connection is not a provider definition, and upstream model is not Oi model.

**PLANNED workspace:** provider inventory → connection/scope → test result → catalog sync → upstream model detail → linked variants/bindings. Use pickers for definitions, scopes and connection/model choices; show scope and linked dependent bindings before state changes. Provider health and last sync must come from recorded checks/runs. Test results are timestamped evidence, not guaranteed future availability.

Credential entry is one-time and server-handled. Never display a secret after submission, include it in trace/snapshot/client props, or copy it into logs. Mask only metadata safe for operator visibility. Credential rotation/revocation must identify affected connection and confirm consequences. Provider-specific requirements and endpoint validation stay server-side.

Metrics available now are entity counts, lifecycle, connection health fields, last recorded checks/runs if returned, and catalog evidence timestamps/status. Latency, success-rate history, load, token cost, energy and live network quality are **PLANNED** until actual measurements and retention exist. BYOS and provider billing semantics are **DEFERRED** unless separately specified. Acceptance covers secret custody, scope enforcement, failure states, connection testing feedback, catalog freshness, narrow drawer behavior and bilingual direction.

## Workspace and onboarding contract

Local surfaces: **Overview** (definitions and scoped connection health), **Connections** (identity/scope/lifecycle/test), **Catalog** (provider discovery, upstream models and evidence), **Credentials** (credential metadata/rotation only), **Capabilities** (transport and observed catalog capability evidence). Current owners are `apps/oic-api/src/modules/control-plane/provider-control.controller.ts`, `provider-control.service.ts`, `model-fabric` catalog sync surfaces and `OicProvider*`/`OicUpstream*` records. The Console BFF action allowlist is `apps/oic-console/app/api/action/route.ts`; additions require fixed route, validated payload and same-origin/session guarantees.

Connection onboarding is **PLANNED multi-step UX** over existing API actions, not a new backend lifecycle:

`PROVIDER → ENDPOINT → AUTH → CAPABILITIES → TEST → DISCOVERY → REVIEW → ACTIVATE`.

At each step retain a draft client-side only as needed, validate server-authoritatively, show scope and endpoint host, and block next step on field/API errors. Credential entry is sent only to the API through BFF, encrypted server-side; never persist secret in browser draft, reload state, analytics, trace or URL. “Test passed” is evidence at `testedAt`, not a promise of continuous health. Activate only with existing supported connection-status API; do not invent a new activation gate.

Catalog discovery flow is `FETCH → PREVIEW → DIFF → VALIDATE → SYNC`. Diff states mean:

- `NEW`: returned upstream identity is absent locally.
- `CHANGED`: an existing identity's compared source-owned fields differ.
- `UNCHANGED`: compared fields match; fields/version must be named.
- `MISSING`: a previously local entry was not returned in this fetch. It is not deletion or retirement.
- `UNKNOWN`: incomplete fetch or unavailable comparison data prevents a conclusion.
- `INVALID`: input/provider result fails schema/security validation; cannot sync.

**CURRENT vs PLANNED:** API stores sync runs and evidence but an operator-safe general diff preview workflow must be verified before described as current. Until supported, do not claim preview/rollback. Manual raw catalog JSON remains **EXPERT MODE**, validates schema/size before submission, displays parsed diff and never becomes default path.

Operational metric catalog: connection lifecycle/scope/health/latest validation (CURRENT when API returns); provider test latency (`latencyMs`) per persisted health check (CURRENT when retrieved; no aggregate trend); sync status/discovered/created/updated/rejected counts (CURRENT on a sync-run record); per-window request success, timeout rate, provider SLA, availability, load, rate limit, cost and budget are PLANNED until measured source/denominator/retention exists. Downstream impact lists affected bindings/variants and scopes from persisted relations; actual resolver effects require runtime evidence. Unknown impact stays UNKNOWN.
