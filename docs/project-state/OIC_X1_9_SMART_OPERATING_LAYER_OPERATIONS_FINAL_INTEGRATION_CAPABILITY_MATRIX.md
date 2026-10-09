# OIC-X1.9 Smart Operating Layer / Operations / Final Integration Capability Matrix

**State:** PARTIAL — OWNER REVIEW PENDING. Source and implementation checkpoint only; not owner acceptance. **Date:** 2026-10-09. **Product boundary:** OIC Console/API only. No commit or push.

## Official scope and current surfaces

The committed execution plan defines X1.9 as **Smart Operating Layer / Operations / Final Integration**. Production routes are the authenticated Console shell at `/` with `?view=health` (Health & readiness) and `?view=audit` (Audit trail). The overview and other workspaces remain as implemented in their accepted milestones; this checkpoint adds no fabricated advisor, alert feed, metric history, aggregate endpoint, or autonomous action. X1.9 is the final X1 milestone; the exact return is final OIC-X1 closeout after owner review. OIC-6, OIC-7 and OIC-8 remain NOT STARTED.

Classifications: **SUPPORTED** is implemented by the current source contract; **READ_ONLY** is an observation/inspection; **DENIED** is caller authorization denial; **UNAVAILABLE** is a failed or unreachable source; **NOT_CONFIGURED** means no source/contract exists; **UNSUPPORTED** means the API does not expose that capability; **PLANNED** means a future contract/decision is required. A failure/empty distinction is preserved in UI. No success is inferred from an HTTP code without checking returned health semantics.

## Source contracts

| Surface | API source and exact contract | BFF and browser behavior | Permission / provenance |
|---|---|---|---|
| Health & readiness | `apps/oic-api/src/modules/health/health.controller.ts`: `GET /api/v1/health/live` returns `{status:"ok", service, contractVersion}` for process liveness. `GET /api/v1/health/ready` runs `SELECT 1`; returns `{status:"ok", checks:{database:"ok"}}`, or HTTP 503 with database `unavailable`. Neither endpoint exposes history or host metrics. | `apps/oic-console/app/api/console/route.ts?view=health` independently reads both endpoints, records observation time/status, and returns distinct live/ready source states. `HealthView` has manual refresh, separate process and dependency blocks, database status only from readiness, and distinct unavailable/failure states. | The BFF requires the existing authenticated Console session. The health endpoints are public liveness/readiness endpoints and do not use the machine credential. Their results are read-only, manually fetched observations; not continuous telemetry.
| Audit trail | `apps/oic-api/src/modules/identity/foundation.controller.ts`: `GET /api/v1/admin/audit`, requires `oic:audit:read`, accepts optional UUID `applicationId` and integer `limit` 1–100 (default 50). `FoundationService.readAudit` enforces operator/application/tenant scope and returns newest-first events, bounded to 100. Rows are append-only. The API currently returns stored metadata too. | BFF requires session, uses server-side `controlPlaneCredential()`, fixes `limit=100`, validates optional application UUID, and projects each row to scalar `id`, actor/application/tenant IDs, action, target type/ID, request/trace IDs and occurrence time. Metadata is excluded before reaching the browser. UI search/action filtering is local to this returned sample; application scope triggers a new authorized read. Inspector displays allowlisted fields; exact related entities can navigate to owner workspaces. | API authorization is authoritative; HTTP 403/404 is rendered as unavailable/denied without revealing protected existence. Session and machine credentials remain server-side. Audit identifiers are copyable only in the Inspector; primary actions use named related-workspace links when the target type has a known relationship.

## Capability classification

| Capability | Health & readiness | Audit trail |
|---|---|---|
| LIST | UNSUPPORTED — endpoints return observations, not a service inventory. | SUPPORTED — bounded newest-first event sample. |
| READ | READ_ONLY — process live and dependency readiness observations. | READ_ONLY — authorized event fields. |
| SEARCH | UNSUPPORTED. | SUPPORTED — client-side search over current sample only. |
| FILTER | UNSUPPORTED. | SUPPORTED — application scope via API; action filter within current sample. |
| INSPECT | READ_ONLY — inspect endpoint, HTTP status, observed time, service/version, database check. | READ_ONLY — contextual Inspector of allowlisted event fields; metadata hidden. |
| HISTORY | UNSUPPORTED — no health history endpoint. | SUPPORTED — persisted append-only audit records, but only the bounded result sample is returned. |
| REFRESH | SUPPORTED — explicit manual re-read; no polling. | SUPPORTED — explicit manual re-read of current scope. |
| RETRY | UNSUPPORTED as a domain action. A failed read may be requested again using refresh. | UNSUPPORTED as an audit/domain action. A failed read may be requested again using refresh. |
| RECOVER | NOT_CONFIGURED — no recovery contract. | UNSUPPORTED. |
| ENABLE | UNSUPPORTED. | UNSUPPORTED. |
| DISABLE | UNSUPPORTED. | UNSUPPORTED. |
| ARCHIVE | UNSUPPORTED. | UNSUPPORTED. |
| RESTORE | UNSUPPORTED. | UNSUPPORTED. |
| CANCEL | UNSUPPORTED. | UNSUPPORTED. |
| ABORT | UNSUPPORTED. | UNSUPPORTED. |
| ACKNOWLEDGE | UNSUPPORTED — no alert/acknowledgment source. | UNSUPPORTED — events are immutable. |
| HEALTH | SUPPORTED — `LIVE` means the API process endpoint returned its contract success body; failure is distinct from unreachable. | NOT_CONFIGURED — no audit subsystem-health endpoint. |
| READINESS | SUPPORTED — readiness is separate from process liveness; database readiness is only the returned readiness check. | NOT_CONFIGURED — no audit dependency readiness endpoint. |
| TELEMETRY | UNSUPPORTED — no host metrics or live feed. | UNSUPPORTED — audit events are evidence/history, not telemetry. |
| AUDIT | READ_ONLY — health reads do not create/modify audit rows. | SUPPORTED — authorized immutable event sample; no audit mutation. |
| ERROR EVIDENCE | READ_ONLY — source failure/HTTP status and timestamp; no stack dump. | READ_ONLY — safe action/target/correlation/timestamp fields; stored metadata omitted. |
| RELATIONSHIPS | UNSUPPORTED — no associated-entity relation. | SUPPORTED when `targetType` is recognized; known identity targets carry exact target ID, execution link uses returned trace ID. Other targets do not get guessed links. |

## Cross-workspace integration and global convergence

- Operations is two source-oriented workspaces rather than an endless status dashboard: Health observations and persisted Audit evidence.
- Global shell connection status is explicitly **API process liveness only**: a successful returned `live` observation (HTTP 200 and `{status:"ok"}`) maps to Connected; a pending read maps to Checking; a known request/liveness failure maps to Unavailable; missing liveness evidence maps to Unknown. It does not aggregate dependency readiness. The shell tooltip and EN/AR copy direct dependency interpretation to Health & readiness.
- Canonical Interface controls: `ActionButton`, `EntityPicker`, `SearchableSelect`, `TextInput`, and `Inspector`; canonical Instrument controls: `StateBeacon` and `StatusRing`. No gallery imports or cloned primary controls.
- EN/AR messages and locale direction are wired through the Console. Owner Visual and Workflow Acceptance PASS for Health & Readiness and Audit Trail. A separate automated viewport matrix and screen-reader audit are not claimed.
- Audit action identifiers remain machine codes in the event list; no incomplete glossary translation is claimed. Dates use the shared locale formatter; opaque identifiers render LTR.
- Overview and all closed milestones remain source-backed. No global advisor was added: the plan requires approved grounding, permission and uncertainty contracts, which are not present. Contextual advice is therefore **PLANNED**, not populated with inferred advice.
- No production navigation destinations were added; existing Health & readiness and Audit trail entries are used. No new route, API, database/schema, authorization, session, origin, CSRF, or credential behavior was added.

## Truthfulness and security invariants

- No synthetic health, readiness, telemetry, operational history, alert, score, risk, impact prediction, recovery result, or advice.
- HTTP 200 alone is not called healthy: the returned API health body must carry `status: "ok"`; API readiness and database readiness stay separate from liveness.
- A sample count describes the bounded returned events, not a total. Search/filter are explicitly sample-scoped. Empty, denied, failed and loading are distinct.
- No raw audit metadata, credential, provider secret, protected prompt or hidden reasoning is rendered. Console session, same-origin/CSRF protections on actions, BFF boundaries and server machine credentials are unchanged.
- No DB schema or API contract change. No Responix, Mega Platform Portal, OIC-6/7/8 work.

## Acceptance and validation state

**Disposition:** X1.9 GO / CLOSED by owner acceptance. Console typecheck/lint and 72 configured tests pass; X1.9 focused 6/6; shell-status regression 1/1; Interface 8/8; Instrument 9/9; X1.4 6/6; X1.5 5/5; X1.6 7/7; X1.7 7/7; X1.8 7/7; locale/i18n 1/1. Default-heap production build passes; all three dev-only routes return 404 in production; Console/API/database live checks pass; diff, added-line secret and OIC-boundary scans pass. No separate browser automation or screen-reader audit is claimed. This is final X1 implementation; exact next return is FINAL OIC-X1 PROGRAM CLOSEOUT. OIC-6/7/8 remain NOT STARTED.
