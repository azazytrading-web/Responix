# OIC Initial Metric Catalog

Definitions only. **No example numerical values are telemetry.** `LIVE_NOW` means direct current API source; `DERIVED_NOW` means deterministic current aggregation. `PLANNED` requires absent instrumentation/history/evaluator. `EXTENSIBLE` is a future registry slot. Catalog entries are domain candidates, not a claim that a reusable registry exists.

| Domain / conceptual key | Meaning; entity; unit; renderer | Status / owner | History; drilldown |
|---|---|---|---|
| SYSTEM `api.live` | API process responds; service; state; status lamp | LIVE_NOW / health live endpoint | No history; Health |
| SYSTEM `database.ready` | DB readiness check; service; state; status | LIVE_NOW / health ready endpoint | No history; Health |
| SYSTEM `snapshot.record_count.*` | Count returned for applications/tenants/principals/providers/connections/catalog/families; record set; count; numeric | DERIVED_NOW / snapshot response | Snapshot only; respective inventory |
| RUNTIME `execution.status/count` | Persisted status and number of executions in query; execution; enum/count; status/numeric | LIVE_NOW / intelligence execution API | Stored started/completed timestamps; Trace Explorer |
| RUNTIME `execution.duration` | Completed-started or persisted summary duration only when present; execution; ms; numeric | DERIVED_NOW / stored timestamps or summary | Per-record only; trace |
| RUNTIME `execution.provider_calls` | Actual recorded providerCallCount; execution; calls; numeric | LIVE_NOW / execution record | Per-record; trace/workbench |
| RUNTIME `execution.retrieval_queries` | Actual retrievalQueryCount; execution; queries; numeric | LIVE_NOW / execution record | Per-record; trace |
| RUNTIME `execution.memory_lookups` | Actual memoryLookupCount; execution; lookups; numeric | LIVE_NOW / execution record | Per-record; trace |
| RUNTIME `execution.tokens` | Context/input/output tokens when source reports them; execution; tokens; numeric | LIVE_NOW / execution record | Per-record; trace |
| INTELLIGENCE `execution.verification_status` | Persisted verification status; execution; enum; status | LIVE_NOW / execution | Per-record; trace |
| INTELLIGENCE `execution.uncertainty` | Persisted bounded uncertainty label; execution; enum; label | LIVE_NOW / execution | Per-record; trace |
| INTELLIGENCE `memory.utility` | Trace-safe observed support/conflict/selection effect; memory/trace; categorical/count; list/timeline | PLANNED reusable surface / OIC runtime trace contract | Per execution only until retained query; Memory/Trace |
| MODEL `model.active_count` | Active lifecycle count only if filtered from snapshot; edition; count; numeric | DERIVED_NOW / model fabric snapshot | Snapshot only; Model Factory |
| MODEL `model.runtime_health` | Execution outcomes by resolved Oi model; model; status/rate | PLANNED / runtime aggregation | Requires retained sample/window; model passport |
| MODEL `model.dna.dimension` | OIC-7 measured dimension under evaluator version/cohort; model revision; score with denominator/method | PLANNED / OIC-7 | Evaluator-owned; Model Factory |
| PROVIDER `provider.health_status` | Current persisted connection/provider health status; connection; enum; status | LIVE_NOW / provider snapshot | Latest check only if present; Provider Factory |
| PROVIDER `provider.last_check_latency` | Measured test latency; connection; ms; numeric | PLANNED / recorded health check availability to verify | Per-check history needed; provider detail |
| PROVIDER `provider.success_rate` | Calls succeeded / eligible calls; connection; ratio | PLANNED / runtime telemetry | Windowed event history; provider detail |
| PROVIDER `provider.catalog_freshness` | Latest sync/evidence time; connection/catalog; timestamp/age | LIVE_NOW only where returned; otherwise PLANNED / sync records | Requires retained sync history; catalog |
| FACTORY `binding.count/status` | Persisted bindings grouped by scope/status; binding; count/state | DERIVED_NOW / snapshot | No trend; Model Factory |
| FACTORY `visibility.count` | Persisted app visibility links; app/model; count | DERIVED_NOW / snapshot | No trend; app/model detail |
| LAB `workbench.run.result` | Actual paired result statuses/trace references; run; categorical | LIVE_NOW per returned workbench response | Per-run only; Workbench |
| LAB `evaluation.quality/efficiency` | OIC-7 evaluator outputs with protocol; candidate/model; evaluator-defined unit | PLANNED / OIC-7 | OIC-7 retention; Lab/Passport |
| MEMORY `memory.lifecycle/count` | Persisted records by kind/lifecycle/scope; memory; count/state | DERIVED_NOW / memory API | Timestamp history not implied; Memory Studio |
| KNOWLEDGE `knowledge.lifecycle/count` | Persisted records by lifecycle/scope; knowledge; count/state | DERIVED_NOW / knowledge API | Timestamp history not implied; Knowledge Studio |
| OPERATIONS `audit.events` | Returned audit records/count; event; count/time | LIVE_NOW / audit endpoint | Stored event timestamps; Audit |
| OPERATIONS `alert.count/severity` | Operational alert counts/severity; alert; count | PLANNED / no alert registry asserted | Requires alert source; Operations |
| OPERATIONS `resource.cpu/memory/storage/network` | Host/service resource observation; service; source-defined units | PLANNED / no current OIC collector asserted | Time series required; Health |
| OPERATIONS `cost/energy/throughput` | Actual measured resource/economic values; service/model; source-defined | PLANNED / no source asserted | Meter/event history; owning workspace |

No “UNKNOWN” pricing is converted to zero; no counts imply health. `Oic5AcceptanceLedger` metrics belong to explicit acceptance executions, not live system totals.

## Additional measurable candidates and owner notes

Catalog is explicitly **non-exhaustive**. `LIVE_NOW` means a current endpoint can return the per-record/per-query value; it does not mean there is a streaming feed. `DERIVED_NOW` is an aggregation over the response returned for that query, not a retained trend. Freshness for record values is source `updatedAt`/`occurredAt`/`startedAt`; a query's fetch time must not replace it.

| Group / key; label and description | Entity / unit / instrument | Maturity and actual/future source owner | Freshness / history / drilldown |
|---|---|---|---|
| SYSTEM `api.contract_version`; API contract version | service / version / numeric-text | LIVE_NOW / `health.controller.ts` | At fetch; no history; Health |
| SYSTEM `database.readiness`; readiness database check result | service / state / status | LIVE_NOW / health ready | At fetch; no history; Health |
| FOUNDATION `application.lifecycle`; application state | application / enum / status | LIVE_NOW / snapshot + identity API | `updatedAt`; no trend implied; Application |
| FOUNDATION `tenant.count_by_application`; tenants returned per app | app / count / numeric | DERIVED_NOW / snapshot | Snapshot generatedAt; history requires retained snapshots; Tenants |
| FOUNDATION `principal.credential_state`; returned credential state/expiry/lastUsedAt | principal credential / enum-time / table | LIVE_NOW / snapshot identity projection | Stored dates; no rate; Principal inspector |
| OPERATIONS `audit.event_age`; time since persisted occurrence | audit event / duration / numeric | DERIVED_NOW / `occurredAt` | Event timestamp; event list is retained by API limits only; Audit |
| PROVIDER `connection.last_validated`; latest persisted validation timestamp | connection / timestamp / numeric-text | LIVE_NOW / provider connection response | `lastValidatedAt`; history needs health-check query; Connection |
| PROVIDER `connection.health_status`; current persisted health status | connection / enum / status | LIVE_NOW / provider service and snapshot | Source timestamp if returned; no assumed history; Connection |
| PROVIDER `health_check.latency`; one test's elapsed milliseconds | health check / ms / numeric | LIVE_NOW per health-check record (`latencyMs` schema); **Console availability depends on endpoint projection** | `testedAt`; per-check only; Connection |
| PROVIDER `sync_run.result_counts`; discovered/created/updated/rejected | sync run / count / numeric group | LIVE_NOW per sync-run read API if exposed; schema source `OicProviderSyncRun` | `startedAt`/`completedAt`; no aggregate trend; Catalog Sync |
| CATALOG `capability.evidence_status`; latest status for named capability | upstream model + capability / enum / status | LIVE_NOW / snapshot latest evidence projection | `observedAt`; per evidence history exists in DB but endpoint returns latest selection; Catalog |
| CATALOG `pricing.evidence`; known/unknown price evidence and unit | upstream model / source-defined currency-rate / table | LIVE_NOW / snapshot latest price or `UNKNOWN` | `observedAt`/`effectiveAt`; no billed-cost implication; Catalog |
| MODEL `revision.count`; revisions for edition | edition / count / numeric | DERIVED_NOW / snapshot nested revisions | At snapshot; no trend; Model Passport |
| MODEL `binding.scope_status`; binding records by scope/status | edition/variant / count+enum / table | DERIVED_NOW / snapshot | At snapshot; no time series; Model Factory |
| MODEL `application.visibility`; explicit visibility relationship | app+edition / boolean / status | LIVE_NOW / snapshot and model service | Relation presence; not runtime availability; Application/Passport |
| INTELLIGENCE `profile.policy_bound`; saved profile dimensions and resource limits | profile revision / config units / technical inspector | LIVE_NOW / profile API | Revision createdAt; not performance history; Profile |
| RUNTIME `execution.stage_count`; persisted stage count | execution / stages / numeric | LIVE_NOW / execution record | `startedAt`; per run; Trace |
| RUNTIME `execution.context_tokens`; actual recorded context tokens | execution / tokens / numeric | LIVE_NOW when non-null; execution record | Per run; Trace |
| RUNTIME `execution.input_output_tokens`; provider-reported token fields | execution / tokens / numeric | LIVE_NOW when non-null; execution record | Per run; null means unreported, not zero; Trace |
| RUNTIME `execution.started/completed`; persisted timestamps | execution / timestamp/duration / timeline | LIVE_NOW timestamps; DERIVED_NOW elapsed duration only if both timestamps exist | Per execution; no percentile without window query; Trace |
| LAB `workbench.paired_execution_status`; baseline/candidate status pair | workbench invocation / enum pair / compare | LIVE_NOW for the response's pair; workbench service | Per run; no stored experiment collection asserted; Workbench |
| MEMORY `memory.sensitivity/lifecycle`; stored classification/state | memory / enum / badge | LIVE_NOW / memory API/schema | `updatedAt`; no trend; Memory |
| MEMORY `memory.validity_age`; configured validUntil/lastConfirmedAt | memory / timestamp/age / numeric-text | LIVE_NOW dates; DERIVED_NOW age | Source dates; no accuracy claim; Memory |
| KNOWLEDGE `knowledge.authority_priority`; stored source ranks | knowledge / configured integer / table | LIVE_NOW / knowledge API/schema | `updatedAt`; not calibrated trust; Knowledge |
| KNOWLEDGE `knowledge.dependency_count`; explicit refs stored | knowledge / count / numeric | DERIVED_NOW / knowledge record JSON dependency list | `updatedAt`; no graph health assumption; Knowledge |
| OPERATIONS `audit.latest_event`; most recent returned audit timestamp/action | scope / timestamp+enum / event list | LIVE_NOW from audit response | `occurredAt`; list limit applies; Audit |
| OPERATIONS `api.error_rate`, `api.request_throughput`, `resource.*`; service-level observability | API/host / ratio, rate, resource unit | PLANNED / future explicit collector and retention owner | Requires event/time-series schema; Operations |
| FACTORY `catalog.diff_counts`; new/changed/missing/invalid entries for a fetched preview | sync preview / count by diff state / distribution | PLANNED until preview/diff API exists | Run-scoped only; Provider Catalog |
| FACTORY `release.readiness`; checks for a grouped model assembly | edition / check state / matrix | PLANNED until assembly/release contract exists | Versioned release attempt; Model Factory |
| LAB `evaluation.sample_confidence`; evaluator sample and uncertainty | evaluation run / count + interval / numeric/table | PLANNED / OIC-7 | Evaluator-defined window and provenance; Lab/Passport |

Do not claim a value is live simply because its Prisma column exists: mark LIVE_NOW only if a current API/BFF path can safely return it. A future consumer may expose an existing persisted field through a reviewed DTO without a new metric producer, but adding history, aggregation, confidence or prediction still needs a source contract.
