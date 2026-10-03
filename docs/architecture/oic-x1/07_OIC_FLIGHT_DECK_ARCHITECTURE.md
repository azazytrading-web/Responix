# OIC Overview Flight Deck Architecture

Operational state, snapshot/history distinction and future acquisition choices are governed by [live-state architecture](21_OIC_LIVE_STATE_AND_TEMPORAL_ARCHITECTURE.md); dense scaling and measured budgets by [performance architecture](25_OIC_FRONTEND_PERFORMANCE_AND_DENSITY.md); unsupported features and renderer evolution by [compatibility/availability](26_OIC_VERSIONING_CAPABILITY_AND_COMPATIBILITY.md). These contracts do not make the Flight Deck an X1-1 deliverable.

**Status: PLANNED for X1-2.** Current Overview remains the functional, data-backed summary; the screenshot reference is visual direction only and does not authorize instrument implementation here.

## Structure

Retain the hero **“Intelligence, under control.”** Directly below it, the target sections are: `01 SYSTEM CORE`, `02 ACTIVE MODEL FLEET`, `03 PROVIDER NETWORK`, `04 MODEL FACTORY`, `05 INTELLIGENCE LAB`, `06 COGNITIVE ACTIVITY`, `07 LIVE OPERATIONS`. Every section is populated only from sources actually available to its scope. Summary counters are not service telemetry. Unavailable metrics must not be replaced by mock bars, percentages, rates or alert totals.

System Core groups compact instruments by runtime health, throughput/cost only where measured, and capacity only where sourced. Active Model Fleet is entity-driven: for each eligible active Oi model, render a cluster from model-scoped registry entries, including unavailable/idle states where meaningful. Provider and model factory summaries link to their workspaces. Cognitive Activity summarizes safe stage/evidence metadata; it never presents hidden reasoning text.

## Time and disclosure

Target time controls: `LIVE`, `1H`, `24H`, `7D`, `30D`, `CUSTOM`. **PLANNED:** only enable a window when the source retains suitable timestamped samples; `LIVE` means latest current response, not a streaming subscription unless one exists. Focus and compare modes require explicit entity/scope and comparable time ranges.

Progressive disclosure: Level 1 executive instruments; Level 2 domain deck; Level 3 entity instruments; Level 4 deep telemetry and source detail. The page must not require every sensor on one screen. Use grouping, pinning curated domains, density controls and drilldown; arbitrary user dashboard layouts are deferred.

**Acceptance gate:** real source, unit, state, freshness and drilldown on every metric; responsive EN/AR and LTR/RTL; keyboard and reduced motion; tests for missing/stale/error source; no fabricated history. No Flight Deck or instrument code is part of X1.0.

## Section implementation contract

| Section | Purpose / priority | Default visible vs optional | Entity expansion / interactions / drilldown | Offline, time and responsive | Future source owner |
|---|---|---|---|---|---|
| 01 SYSTEM CORE | First priority: operator-wide process and data-plane posture | Default: API live, database readiness, recent execution count/status only if sourced. Optional: execution duration distribution, token totals, stage/resource use when measured. Never show CPU/memory/storage/cost without producer. | Group by API, database and runtime; expand check and latest safe execution; links to Health and Trace Explorer. | API failure makes source unavailable, not 0%; sample timestamps shown. LIVE is latest read; historic bands only with history contract. Compact group → full system workspace on narrow. | `health.controller.ts`, execution records; future system collector explicitly PLANNED. |
| 02 ACTIVE MODEL FLEET | Surface eligible active Oi models and operational state | Default: active model identity/lifecycle, known binding and latest execution evidence if available. Optional: measured call, latency, verification or evaluator values only when registered. | Dynamic: `active Oi model → appears → receives group → fills registered metrics → unsupported metrics show OFFLINE/UNAVAILABLE`. Membership follows API lifecycle/scope; no placeholder score card for missing metrics. | A model with no trace is IDLE/NO OBSERVATION, not failed. LIVE is latest observation; historical windows depend on source. Grid density reduces to labeled list narrow. | Model snapshot plus execution API; OIC-7 owns quality dimensions. |
| 03 PROVIDER NETWORK | Show connection topology and current recorded check | Default: provider/connection name, scope, lifecycle, current health status, last validated time. Optional: persisted latency per check, catalog sync state. | Dynamic per scoped connection. Expand safe details and linked upstream models/bindings; go to Provider Factory. | Unknown health stays unknown; offline connection neutral/degraded according to latest API state. Check history only when fetched. Cards stack/list narrow. | Provider service, `OicProviderHealthCheck`, sync records. |
| 04 MODEL FACTORY | Summarize authored model portfolio and deployment relationships | Default: real family/edition/revision/binding/visibility counts when snapshot provides. Optional: measured evaluation or resource data only from owner. | Group by family and lifecycle; expand edition and bindings; passport/drilldown to X1-4 workspace. | No models is successful empty; API failure separate. No fake trend. Table/tree narrow. | `model-fabric.controller.ts` / service and snapshot. |
| 05 INTELLIGENCE LAB | Show real controlled runs and verification status | Default: recent Workbench results and trace links if returned. Optional: paired experiment comparisons only for controlled inputs; usage values from executions. | Expand run → baseline/candidate → trace. No subjective “winner”; present objective outcomes and differences. | No runs is idle/empty; API fault unavailable. Live range is current records, other windows require stored querying. Stacked summary narrow. | Workbench service and execution records; OIC-7 later. |
| 06 COGNITIVE ACTIVITY | Explain safe process activity without internal private reasoning | Default: bounded persisted stage counts/types/status and safe evidence/verification summaries when DTO permits. Optional: stage timeline and support/conflict relations. | Select stage to show allowlisted metadata and linked evidence IDs; never arbitrary internal text. | Active execution can be `LIVE` only if API polling/stream contract exists; otherwise show persisted snapshot time. Compact ordered list narrow. | Runtime execution/stage metadata; OIC-7 may add evaluation artifacts. |
| 07 LIVE OPERATIONS | Bring actionable health and recent audit context into view | Default: readiness result, safe critical health faults if source exists, recent audit events. Optional: alert registry/resource panels only after APIs exist. | Group by operational domain; alert/event opens scoped inspector and owning workspace. | No current alert source means section omits alert counts; API down is unavailable. No false “0 alerts.” Readable stack narrow. | Health and audit APIs; future alert/host collector planned. |

## Time controls and modes

**CURRENT:** current Console fetches snapshot/health and lists a bounded execution response; it has no general subscription/history API. `LIVE` may mean “latest fetched source response,” with the response's source time and refresh affordance; do not label it streaming. `1H`, `24H`, `7D`, `30D`, `CUSTOM` are **PLANNED** query windows and stay disabled/absent until each metric's history API can query them. Never manufacture a sparkline by polling and pretending retained samples exist.

**PLANNED modes:** Focus Mode filters one entity/domain and preserves scope; Compare Mode shows two explicitly selected compatible entities/time windows; Incident Mode freezes a source timestamp and gathers related event/trace links without claiming causation. **DEFERRED:** pinned/custom deck, operator-authored layout and save/share dashboards.

**Model/provider registration invariant:** model and provider cards are generated from current API entities and registry discovery by `entityType`, never hard-coded model/provider names. Newly created eligible entities therefore appear after refresh with their known metrics and visibly unavailable unsupported instruments. Entity registration cannot widen scope; API response is already authorized.

## System Core candidate set

Candidate capacity is intentionally much larger than one screen; each item is hidden until a source contract and useful operator decision exist.

| Candidate family | Metrics and current maturity |
|---|---|
| Availability | API live and DB readiness: LIVE_NOW. Dependency-by-dependency readiness: EXTENSIBLE until API reports each dependency. |
| Request load | Request count/throughput per window, concurrency, queue depth: PLANNED; no current request telemetry series. |
| Runtime outcomes | Execution status and recorded count, stages, provider calls, retrieval queries, memory lookups, tokens, verification status and timestamps: LIVE_NOW per execution/list response. Rates/percentiles: PLANNED until cohort query and denominator exist. |
| Context and memory | Context token count per execution; selected memory/use outcomes only when persisted trace artifact exists. Context utilization %, memory hit rate and cache hit rate: PLANNED without numerator/denominator series. |
| Provider operations | Persisted latest connection health/validation and per-check latency where returned: LIVE_NOW. Provider success rate, error rate, saturation/load and availability SLO: PLANNED. |
| Model fleet | Oi model lifecycle/binding/visibility counts from snapshot: DERIVED_NOW. Active-model live call/latency/quality surfaces: PLANNED until trace aggregation/evaluator contract. |
| Resources | CPU, memory, GPU, storage, network IO, temperature, energy: PLANNED; no current OIC host collector asserted. |
| Cost | Upstream catalog price evidence can be LIVE_NOW as metadata. Actual spend, cost/hour, customer economics and cost-efficiency: PLANNED; pricing evidence is not usage/billing truth. |
| Alerts | Health/readiness failures and audit events are current source records. Central alert count/severity registry and alert history: PLANNED. |

At first release, prioritize availability, current record state and drilldowns. Optional groups become visible only if data and decision context exist. Keep no-data family collapsed or label “not instrumented”; never fill capacity with decorative fake cards. For providers, dynamic registration is `eligible scoped connection → one group per connection → available check/catalog metrics → unsupported metrics explicitly unavailable`; remove a group only when API scope/lifecycle excludes it, not because a fetch failed.
