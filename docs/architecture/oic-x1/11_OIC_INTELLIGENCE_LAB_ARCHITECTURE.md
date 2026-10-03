# OIC Intelligence Lab Architecture

**CURRENT surfaces:** Workbench accepts a controlled runtime request and compares baseline with a selected profile through actual execution; Execution Traces list and inspect persisted execution records; Runtime Lab invokes OIC runtime APIs. OIC-5 tests and ledger establish deterministic acceptance scenarios but do not imply production-wide model evaluation. **PLANNED X1-6:** unify these into task setup, controlled run, result/evidence review, safe trace and repeat/compare workflow.

## Run contract

Capture caller scope, application/tenant, model/revision, profile revision, request identity, start/end and execution status. Before run, summarize known inputs and policy limits. After run, show output according to permission, result status, uncertainty, actual usage, evidence and verification, stage sequence, trace IDs, and known missing fields. Comparison must disclose changed variables; only matched conditions support a causal comparison. Failed/unknown runs remain visible.

**CURRENT trace fields:** trace/request IDs; app/tenant/principal references; model/profile revisions; status, strategy, task type, uncertainty; stage/provider/retrieval/memory counts; context/input/output tokens where known; verification status; summary JSON; timestamps; stage type/status/strategy/duration/resourceUse/metadata. Trace stages are explicitly safe structured records; evidence graph and memory utility can carry provenance summaries without copying protected source text. Inspecters must follow the trace DTO allowlist and never show prompt or response content as “reasoning.”

**PLANNED X1-6:** stage timeline, resource accounting and safe evidence/decision-artifact visualizations. “Cognitive map” means only explicit bounded stage/evidence relationships. Hidden chain-of-thought, free-form internal deliberation and secret provider payloads are out of scope. OIC-7 evaluator/benchmark is not part of this Lab architecture.

## Lab surfaces and run flow

| Surface | Owner/source and responsibility | State/relationship contract |
|---|---|---|
| Workbench | `apps/oic-api/src/modules/runtime-plane/intelligence-workbench.controller.ts` and service; paired current baseline/profile execution | Setup → scenario → baseline → OIC/candidate → result → evidence → resources → trace. Pair IDs and changed variables are visible. |
| Experiments | No `OicExperiment` persistence model is asserted in current schema | **PLANNED** saved scenarios/runs/annotations until experiment entity/API exists. Client drafts are not called persisted experiments. |
| Runtime | Runtime plane controllers/services; actual resolved model, caller/application/tenant and runtime result | Invoke only through authorized path; show validation, API result/error and correlation. Do not imply an invocation is a benchmark. |
| Traces | `OicIntelligenceExecution` + `OicIntelligenceExecutionStage`; `intelligence.controller.ts` list/detail | Read-only persisted execution identity, safe summary and ordered stages; lifecycle is immutable, filters only when API supports them. |
| Compare | Workbench baseline/candidate or explicitly selected trace pair | Show task/provider/model/profile/policy differences and objective assertions. No hard-coded “winner”; incomparable values are labeled. |

Workbench layout contract: **SETUP** selects application/tenant, model and profile through scoped pickers; **SCENARIO** defines bounded request/task; **BASELINE** states exact baseline policy/model; **OIC / CANDIDATE** states revision/profile; **RESULT** reports actual output/status/uncertainty according to permission; **EVIDENCE** shows authorized evidence references and verifier findings; **RESOURCES** reports persisted actual counts/tokens/duration; **TRACE** links safe trace records. These can be progressive panels, not necessarily one long visible screen. Before run, disclose provider calls/budgets where server policy returns them; after run, distinguish expected limits from actual usage.

## Trace Inspector contract

Current persistence supports request/task identifiers and model/profile references; strategy/task type/uncertainty/status; stage, provider call, retrieval, memory lookup, context/input/output token counts where present; verification status; summary JSON; start/completion timestamps; stages with type/status/strategy/duration/resourceUse/metadata. The API serializer and BFF view-model must allowlist fields.

Inspector sections: **Request / Task / Model** (IDs/scope/labels only; redact input content unless an explicit permissioned product use case); **Strategy**; **Stages**; **Retrieval** (query/count and safe source IDs/coverage if stored); **Memory decisions** (selected IDs/kinds/reasons and safe utility flags); **Evidence summary** (safe references, support/conflict/coverage, not raw source text); **Candidate summary** (bounded alternatives/selection metadata, no hidden deliberation); **Verification** (status/findings codes); **Repair** (count/transition and explicit output assertions only); **Resources** (recorded usage); **Stop reason** when in persisted safe summary. Each section independently says absent/not recorded if missing.

Never expose private prompt/response, provider request payload, raw private knowledge/memory content, credentials, hidden CoT or internal deliberation under a “trace” label. Trace inspection must not broaden tenant scope. Large safe metadata is collapsed with size bounds and code wrapping. Any undocumented JSON key remains hidden pending security review.

Acceptance requires real request→execution→trace correlation, authorization, partial/missing artifacts, API failure, safe redaction, no winner language without rubric, and repeated-run comparison exposing changed variables. OIC-7 score sections remain unavailable until evaluator-owned result schema is reviewed.
