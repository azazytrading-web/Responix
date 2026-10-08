# OIC X1.8 Lab, Runtime and Trace Capability Matrix

**Status:** GO / CLOSED — owner Visual and Workflow Acceptance PASS (2026-10-08). Source audit performed against baseline `a8dcb6c5eac2022399e3b6d62278ed3b25f3035d`. This is an API/UI capability map, not authorization: API scope, application and tenant checks remain authoritative.

## Workbench — experiment and compare

| Capability | Current source contract | Product treatment |
|---|---|---|
| Paired execution | `POST /api/v1/admin/intelligence/workbench/run`; requires runtime invocation scope. Runs the built-in baseline policy, then the requested profile revision via the OIC executor. | Use the real endpoint, preserve both returned run and trace identities, show partial/failed outcomes if returned. No fabricated run result. |
| Held inputs | Request model, prompt, selected tenant, and output ceiling are supplied to both runs. Baseline uses built-in `FAST_POLICY`; OIC uses the selected persisted profile revision. | Call it a controlled execution comparison. Explicitly disclose that effective policy/retrieval/memory/tool behavior differs, so the runs do not have identical effective context and do not establish causality. |
| Evidence | Returned output, duration, usage, finish reason and execution summary are available; persisted execution traces carry counts and safe structured metadata. | Show observed fields only. Unknown fields remain “not recorded”. No winner, score, quality ranking, cost, or evaluation semantics. |
| Experiment persistence | No `OicExperiment` model or saved-scenario API is present. | Local form state only; never label it saved/persisted. No evaluation persistence or scheduler. |
| Trace links | Workbench result includes per-run `traceId`. | Link directly to the corresponding trace inspector without manual identifier copying. |

## Runtime Lab — execute and observe

| Capability | Current source contract | Product treatment |
|---|---|---|
| Model discovery | `GET /v1/models`; requires `oic:runtime:models:read`, returns only application/tenant-visible Oi model IDs. | Read through a fixed same-origin Console BFF view using the server runtime credential. Never derive runtime eligibility from the broad control-plane catalog. |
| Invocation | `POST /api/v1/runtime/invocations`; requires `oic:runtime:invoke`; accepts Oi model ID, text input, optional granted tenant and bounded output ceiling. | Keep request bounded and explicit. Server resolves application, tenant, active binding and profile policy. Do not let browser-provided model/provider credentials cross the BFF. |
| Response | Actual output, finish reason, nullable usage, request ID, trace ID and duration. Cost is not returned. | Render actual response/evidence with field-level unavailable states. Never invent token streaming, cost, context, stage progress, or a selected profile. Runtime profile is resolved by the model binding and can be read from a resulting trace when recorded. |
| Cancellation | No client cancellation endpoint. Streaming disconnect cancellation exists only for the stream route, while current Console action uses bounded non-stream invocation. | No Cancel control. A deliberate retry is a new invocation and keeps the prior trace identity visible. |
| Tenant scope | Runtime context is derived from the configured runtime principal’s application and grants; the API independently checks selected tenant. | Offer only granted snapshot tenant choices; the API remains authoritative. |

## Execution Traces — inspect, evidence and forensics

| Capability | Current source contract | Product treatment |
|---|---|---|
| List | `GET /api/v1/admin/intelligence/executions?limit=N`; application/authorized tenant scoped, newest first, limit capped at 100. Console currently requests 50. | Display the bounded sample and source refresh time. No claim of full history, live feed, server search, or pagination. |
| Detail | `GET /api/v1/admin/intelligence/executions/:traceId`; returns identity, scope, model/profile revision, status, strategy/task/uncertainty, counts, summary, timestamps and ordered stages. | Safe read-only timeline and evidence sections; each missing field is explicit. Open by trace ID from Workbench or Runtime. |
| Stage evidence | `stageIndex`, `stageType`, status, strategy, duration, resource-use JSON, metadata JSON and timestamps. | Render stage order from the API. Only documented scalar/count/reference keys are allowed; undocumented JSON keys and arbitrary object/string payloads are omitted. |
| Retrieval/memory/verification | Counts and selected structured summary fields may exist, depending on execution path. No universal provider-call row or raw evidence-content feed is present. | Show recorded counts/references/findings only. Do not imply provider payload availability or that a reference’s content entered model context. |
| Filters/history/export/delete | No server-side trace search, pagination cursor, export, or delete endpoint is exposed by current Console BFF/API contract. | Search is explicitly limited to the currently returned bounded sample; do not imply full-history search or fabricate unsupported controls. |
| Sensitive data | Execution and stage JSON are flexible. Architecture requires an allowlist; prompts, response text as reasoning, provider payloads, credentials and private deliberation are prohibited in the inspector. | Strict safe-field projection at presentation; no raw JSON dump, hidden CoT, prompt viewer, or secret fields. |

## Cross-surface links and boundaries

| Flow | Source support | Treatment |
|---|---|---|
| Workbench → Trace | Actual paired result contains trace IDs. | Directly select and inspect the exact trace. |
| Runtime → Trace | Runtime response contains trace ID. | Directly select and inspect the exact trace. |
| Trace → Model/Profile | Trace includes model/profile revision IDs; current Console has model/profile views. | Navigate with the source ID where a supported destination can resolve it; preserve identifier as LTR technical data. |
| Trace → Memory/Knowledge | Execution summary may contain safe IDs/references; dedicated record detail routes exist. | Link only when an allowlisted actual reference is present and the API can resolve it; no synthetic joins. |
| Locale/layout | Console owns EN/AR, document direction, canonical Interface and Instrument systems. | Owner accepted EN/AR, LTR/RTL and narrow composition; source/tests cover native Arabic, technical bidi isolation and responsive reflow. No automated browser cell capture claimed. |
| Production boundaries | Console action and read BFF routes enforce session, origin on mutations, fixed route allowlists and server-side machine credentials. | Preserve all controls. No dev gallery imports, browser credentials, API/schema redesign, or other product edits. |

## Source references

- `apps/oic-api/src/modules/runtime-plane/intelligence-workbench.controller.ts`
- `apps/oic-api/src/modules/runtime-plane/intelligence-workbench.service.ts`
- `apps/oic-api/src/modules/runtime-plane/openai-compatibility.controller.ts`
- `apps/oic-api/src/modules/runtime-plane/runtime.service.ts`
- `apps/oic-api/src/modules/intelligence/intelligence.controller.ts`
- `apps/oic-api/src/modules/intelligence/intelligence-profile.service.ts`
- `packages/oic-database/prisma/schema.prisma` (`OicIntelligenceExecution`, `OicIntelligenceExecutionStage`)
- `apps/oic-console/app/api/console/route.ts`
- `apps/oic-console/app/api/action/route.ts`
- `docs/architecture/oic-x1/11_OIC_INTELLIGENCE_LAB_ARCHITECTURE.md`
- `docs/architecture/oic-x1/16_OIC_SECURITY_AND_PRODUCT_BOUNDARIES.md`

## Review and validation status

## Final owner acceptance and closeout (2026-10-08)

- **Owner decision:** Visual Acceptance PASS; Workflow Acceptance PASS; Workbench PASS; Runtime Lab PASS; Execution Traces PASS. The owner manually accepted the final composition, including pre-run and zero-trace states. No real provider call was required.
- **Truthfulness:** Workbench remains operational comparison only. There is no score/winner, quality ranking, fake evaluator, synthetic execution/history/telemetry, or unsupported OIC-7/OIC-8/OIC-6 capability. Configured ceilings are distinct from returned usage.
- **Trace safety:** rendering remains an explicit allowlist of safe identifiers, enums, counts, timestamps, resource keys and durations. Flexible metadata and arbitrary JSON are never dumped; private prompts, responses, provider payloads, secrets and deliberation remain excluded.
- **Security:** no authentication, session, origin, CSRF, BFF, machine credential, or tenant/application authorization weakening. Runtime discovery remains session-protected through the same-origin BFF; the server remains authoritative.
- **Canonical/source:** Lab surfaces use canonical Interface controls and source-backed Instrument components. Development galleries/fixtures are not imported. Shared ribbon is local continuity only; main sidebar remains authoritative.
- **Validation:** Console typecheck/lint, all 66 Console tests, focused Lab assertions, default-heap production build, production development-route 404 isolation, live Console/API/database readiness, `git diff --check`, secret scan and OIC product-boundary scan PASS. Owner accepts EN/AR and LTR/RTL responsive direction. No full keyboard or screen-reader audit is claimed.
- **Disposition:** X1.8 GO / CLOSED. Accepted cosmetic debt is non-blocking. Exact next return point: OIC-X1.9 Smart Operating Layer / Operations / Final Integration, NOT STARTED. OIC-6, OIC-7 and OIC-8 remain NOT STARTED.
