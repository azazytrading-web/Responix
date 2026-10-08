# OIC-X1 Execution Plan

**Baseline:** `aa50e61`. **Product boundary:** OIC only. **Current:** OIC-5 GO; X1.1 through X1.8 GO / CLOSED with owner acceptance recorded in the acceptance matrix. Exact next return point: OIC-X1.9 Smart Operating Layer / Operations / Final Integration, NOT STARTED. OIC-6, OIC-7 and OIC-8 remain NOT STARTED. X1.0 architecture lock precedes broad implementation. X1.0 does not commit or advance milestones.

| Milestone | Scope | Dependencies | Non-goals | Frontend surfaces | Backend/API work | Acceptance gate / return point |
| X1.0 Architecture Lock | Freeze architecture, catalogs, blueprints and gates in `docs/architecture/oic-x1/` and project-state docs. | Audit actual API/schema/Console and dirty tree. | Feature implementation, X1-2, dependency additions. | None; keep current Console preview live. | Inspection only; restore local services only if needed. | Docs checked against source; `git diff --check`; closeout for review. Then stop. |
| X1.1 Shell / Design System / Interaction Foundation | Complete shell, navigation/workspace frames, tokens, interactions, reusable states, locale/direction coverage. | X1.0 review; preserve current dirty implementation. | Flight Deck, provider/model factory redesign. | Global shell and current pages progressively framed. | Only OIC endpoints strictly needed, separate approval within milestone. | Existing pages usable at four browser layouts; security and keyboard gates; return to X1.1 closeout. |
| X1.2 Intelligence Flight Deck | Source-backed Overview instruments, groups and drilldowns. | X1.1 shell; metric/instrument contract; real source/history decision. | Fake telemetry, Model DNA, arbitrary dashboards. | Overview/System Core/Fleet/Provider/Factory/Lab sections. | Add telemetry/history API only where required and owner-approved. | Every instrument source/state/unit/freshness; four viewports; empty/offline and live. Return to X1.2. |
| X1.3A Oi Interface Systems Architecture | Lock control, command, selection, workspace and reactive interaction contracts before implementation. | X1.2 accepted; audited Console/API and locked X1 architecture. | Application code, controls, page modernization, OIC-6, cross-product package. | Documentation only; keep Console and API live. | Read-only source audit; no API changes. | Architecture docs source-grounded, linked, consistent, boundary and service checks pass; owner review. |
| X1.3B Oi Interface Systems Implementation & Gallery | Build and accept OIC-owned reusable interaction library and dev gallery in bounded stages. | X1.3A closed and owner authorizes implementation; dependency decision reviewed. | Broad page modernization, unsupported API semantics, Portal/Responix changes. | Shared controls/commands/pickers/workspaces/reactive patterns; `/dev/interface-system`. | Only separately authorized, evidenced OIC allowlist/API work. | Component, state, accessibility, locale, route-gate, visual and serial validation; return X1.3B closeout. |
| X1.4 Identity, Scope & Access Engineering Workspaces | Production adoption for Applications, Tenants, Service Principals, scopes, tenant grants and credential lifecycle using canonical Oi interface/instrument systems where applicable. | X1.3B accepted; identity APIs and security contracts audited. | Provider Factory, unsupported authorization evaluation, schema redesign, OIC-6. | Applications, Tenants, Access; scoped inspectors and relationships. | Existing OIC foundation APIs; only source-proven compatible correction; no schema change. | Four locale/viewport cells per workspace, keyboard/accessibility, exact secret/session boundaries and readback. Return to X1.4. |
| X1.5 Factory Engineering Environment | Coherent Provider → Connection → Catalog → source model → Family → Edition → Revision → Variant → Binding workflows. | X1.3B/X1.4; source/API security audit. | Credential exposure; invented capability, catalog history or lifecycle semantics. | Provider, connection, catalog, model hierarchy, bindings, visibility and cross-entity navigation. | Existing contracts only; safe metadata projection if an evidenced gap exists. | Scope, source evidence, immutable revisions, lifecycle, EN/AR, RTL and narrow. Return to X1.5 owner checkpoint. |
| X1.6 Cognitive Profiles + Model DNA | Profile configuration and source-backed DNA shell; DNA consumes valid OIC-7 evidence only. | X1.3B/X1.4/X1.5; OIC-7 measurement contract before scored DNA. | Invented scores or lifecycle semantics. | Profile, compare/passport and measured DNA only where contract exists. | Respect existing profile APIs; evaluate only with OIC-7 contract. | Profile → trace evidence; DNA method/version or unavailable. Return to X1.6. |
| X1.7 Memory & Knowledge Intelligence Studio | Scoped records, provenance, dependencies, lifecycle and linked execution. | X1.3B and current memory/knowledge API. | Cross-tenant joins, general document platform. | Memory and Knowledge studios. | Changes only for demonstrated query/relationship gaps. | GO / CLOSED after owner Visual and Workflow PASS. Exact next return: X1.8 Intelligence Lab / Runtime / Traces; do not start in X1.7 closeout. |
| X1.8 Intelligence Lab / Runtime / Traces | Controlled run, result, evidence and safe trace inspection. | X1.3B, runtime and trace contracts; OIC-5 baseline. | Hidden CoT; unsupported quality rankings. | Workbench, Runtime Lab, Trace Explorer. | Preserve bounded/safe trace DTO; add only evidenced observability. | GO / CLOSED after owner Visual and Workflow PASS; all three Lab surfaces and cross-Lab navigation accepted. Validation and production route isolation recorded below. Next: X1.9 NOT STARTED. OIC-6/7/8 NOT STARTED. |
| X1.9 Smart Operating Layer / Operations / Final Integration | Contextual source-linked advice, health/audit integration and end-to-end polish. | Prior milestones; grounded impact contracts. | Autonomous change, fabricated prediction, cross-product operations. | Context insights, Operations/Health/Audit, global cross-workspace flows. | Only required measured signals and integration contracts. | Full browser/security/product-boundary/performance matrix and owner acceptance. Return final OIC-X1 review. |

**Milestone numbering amendment (2026-10-07):** completed X1.1, X1.2, X1.3A, X1.3B and X1.4 keep their historical labels. X1.4 is the Identity, Scope & Access adoption milestone. The current X1.5 owner packet groups Provider Factory, Catalog and Model Factory into one Factory Engineering Environment; X1.6 is Cognitive Profiles / DNA, followed by Memory/Knowledge, Lab/Runtime and Smart Operations.

Every later milestone specifies exact APIs/fields, migration need, rollback, and dependencies before coding. If OIC-7 work is unavailable, keep affected UI explicitly unmeasured and continue independent scope.

## Milestone implementation packets

### X1.3A — Oi Interface Systems Architecture

- **GOAL:** lock the reusable interaction architecture and backend-truth contracts before further broad page modernization.
- **SCOPE:** docs under `docs/architecture/oic-x1/28–38_*`, explicit cross-references in existing X1 architecture, source-grounded project-state updates.
- **FORBIDDEN:** application code, package installation, controls/gallery implementation, page modernization, API/DB changes, Portal/Responix edits, X1.3B or OIC-6.
- **GATE:** source references and Markdown links valid; decision and adoption matrix complete; live Console/API/readiness/database pass; diff/boundary/secret scans pass; docs-only OIC commit and push; stop for owner review.
- **RETURN:** X1.3A architecture closeout.

### X1.3B — Oi Interface Systems Implementation & Gallery

- **GOAL:** implement the locked reusable OIC interaction library and development-only `/dev/interface-system` gallery.
- **PREREQUISITE:** explicit owner authorization after X1.3A review; X1.3A alone does not authorize this stage.
- **IMPLEMENTATION SEQUENCE:** follow [the architecture sequence](../architecture/oic-x1/38_OIC_PAGE_CONTROL_ADOPTION_MATRIX.md#x13b-bounded-build-sequence) and the contracts in 29–37; no stage invents architecture.
- **GATE:** state/contract/interaction/RTL/gallery/production-404 tests, owner visual review, serial validation, full OIC-only diff and artifact review.
- **RETURN:** X1.3B closeout; do not automatically begin X1.4.

#### Final source-of-truth closeout (2026-10-06)

- **STATUS:** GO / CLOSED after owner acceptance, final validation, commit and normal push. Oi Operator Interface System v1.0 is ACCEPTED / FROZEN; the Oi Instrumentation System remains canonical and frozen.
- **SOURCE OF TRUTH:** `/components/interface` and `/components/instruments` are authoritative implementations with public barrels. Both development galleries consume their canonical components. Production Overview and Flight Deck composition use canonical instruments; real Interface adoption starts in X1.4. No production/gallery duplicate implementation was found. Fixtures stay confined to development routes.
- **VALIDATION:** Console typecheck, lint, all configured tests (34), production build, production dev-route 404 gates, source-of-truth/isolation tests, `git diff --check`, secret and boundary scans pass. Live Console and API/database readiness are confirmed; full evidence is in the acceptance matrix.
- **BOUNDARY:** OIC Console and X1 docs only; no auth, origin, CSRF/session, BFF, API/database, Responix, Portal, X1.4 or OIC-6 changes.
- **NEXT:** OIC-X1.4 is the next return point and remains NOT STARTED. OIC-6 remains NOT STARTED.

#### X1.3B implementation checkpoint (2026-10-06)

- **STATUS:** PARTIAL; owner visual and interaction review pending. Implementation is limited to the typed OIC interface library and development-only `/dev/interface-system` gallery described by architecture docs 28–38.
- **VALIDATION:** focused Console typecheck, lint and interface-system tests passed. Production build/404, manual browser layout/locale/direction matrix, keyboard/focus review and owner workflow acceptance are not claimed. See the acceptance matrix for the evidence and gaps.
- **BOUNDARY:** no production page adoption, API/BFF/database/security change, Portal or Responix change; demo fixtures remain development-only. Keep Console `:3002` and API `:4100` running.
- **NEXT:** owner inspects `/dev/interface-system`; retain PARTIAL until the visual/interaction gate is explicitly recorded. No commit, push, X1.4, X1.5 or OIC-6 work is part of this checkpoint.

### X1.1 — Shell / Design System / Interaction Foundation

#### LIVE DEVELOPMENT BOOTSTRAP (required first step)

1. Verify/start the OIC API at `127.0.0.1:4100` in its own persistent terminal.
2. Verify/start the OIC Console at `localhost:3002` in a separate persistent terminal.
3. Confirm the owner-visible Console remains open inside VS Code throughout frontend work.
4. Use a third terminal for typecheck, lint, tests, build and Git.
5. Keep the frontend available throughout implementation; do not silently change ports.

- **GOAL:** finish shell/global-local navigation, frames, token contract, interaction primitives, async states, responsive behavior and EN/AR + LTR/RTL foundation; retain functional existing pages.
- **PREREQUISITES / READ:** X1.0 architecture review; read 01–05, 14–18, 20–27 and this project-state plan. Preserve dirty X1-1 code and map its gaps before edits.
- **ALLOWED / FORBIDDEN:** OIC Console shell, page frame, local interaction and locale labels; strictly necessary OIC BFF path only. No Flight Deck instruments, provider/model factory redesign, fake data, new packages, API scope changes or Responix/Portal edits.
- **FRONTEND / API-BFF / DATA:** complete `console-app.tsx`, `oic-frames`, `oic-primitives`, `i18n`, CSS and existing views. Keep current server BFF/auth boundary; only add fixed allowlist routes if a current surface requires one. Data remains existing OIC responses, with explicit unavailable states.
- **DEPENDENCY DECISIONS:** none by default; document any package need, but defer install to owner-reviewed milestone. **LIVE PREVIEW:** Terminal A Console `localhost:3002`, Terminal B API `127.0.0.1:4100`, Terminal C validation/Git; keep A open in VS Code and B available when feature needs API.
- **HUMAN CHECKPOINT / GATE:** operator reviews shell and completes representative current workflows in four viewport/locale layouts; keyboard, failure states, focus and security. Commit/push only after separate human acceptance, serial validation and diff review. **RETURN:** X1.1 closeout and gaps list.

### X1.2 — Intelligence Flight Deck

#### LIVE DEVELOPMENT BOOTSTRAP (required first step)

1. Verify/start the OIC API at `127.0.0.1:4100` in its own persistent terminal.
2. Verify/start the OIC Console at `localhost:3002` in a separate persistent terminal.
3. Confirm the owner-visible Console remains open inside VS Code throughout frontend work.
4. Use a third terminal for typecheck, lint, tests, build and Git.
5. Keep the frontend available throughout implementation; do not silently change ports.

- **GOAL:** assemble source-backed instruments across seven defined sections and progressive levels.
- **PREREQUISITES / READ:** accepted X1.1; read 03, 05–07, 18–21, 25–27; confirm source/history DTOs before UI.
- **ALLOWED / FORBIDDEN:** Overview, instrument renderer and necessary OIC telemetry endpoints/schema only. No invented telemetry, fake history, OIC-7 scores, custom deck persistence or X1-3+ workspace replacement.
- **FRONTEND / API-BFF / DATA:** `OverviewView`, Metric/Instrument registries, groups, time/filter controls only for supported queries; API/BFF can add bounded history/read aggregation with source/unit/time semantics. DATA requires source owner, staleness, sample/window, null-vs-zero and drilldown.
- **DEPENDENCY DECISIONS:** prototype native SVG/CSS first; chart library needs measured need/bundle/accessibility/RTL decision. **LIVE PREVIEW:** Terminal A :3002, B :4100, C checks, separately persistent.
- **HUMAN CHECKPOINT / GATE:** validate each section on real source, stale/offline/fault states, dynamic model/provider registration, all four browser combinations and keyboard. Commit/push after review and serial evidence. **RETURN:** X1.2 closeout; defer unsupported metric family clearly.

### X1.4 — Identity, Scope & Access Engineering Workspaces

- **GOAL:** complete Applications, Tenants, Service Principals and Access as canonical OIC engineering workspaces, including safe scope/grant, external-reference and credential lifecycle workflows.
- **PREREQUISITES / SOURCE AUDIT:** accepted X1.3B; audit `foundation.controller.ts`, `foundation.service.ts`, `console-snapshot.controller.ts`, same-origin `/api/action`, scoped console snapshot routing, current Prisma schema, and canonical Interface/Instrument public barrels.
- **ALLOWED / FORBIDDEN:** `apps/oic-console/**`, narrowly required compatible OIC API correction and X1 project-state evidence. No schema changes, generalized search API, permission-evaluation invention, Provider/Model Factory work, Responix, Mega Platform Portal or OIC-6.
- **FRONTEND / DATA:** source-backed app/tenant/principal index, search/filter/selection, inspector, relationship navigation, ApplicationPicker/TenantPicker, external references, known scope allowlist, tenant grants, credential metadata/issue/rotate/revoke and one-time secret presentation. Unsupported evaluation remains explicit.
- **LIVE PREVIEW:** keep Console `localhost:3002` and API `127.0.0.1:4100` in separate persistent processes; use a third terminal for checks. Do not ask for or inspect the Operator password.
- **HUMAN CHECKPOINT / GATE:** focused tests, typecheck/lint, canonical regressions, secret/boundary checks and authenticated Applications/Tenants/Access EN/AR × LTR/RTL desktop/narrow browser acceptance; then owner visual/workflow review. **RETURN:** X1.4 PARTIAL owner checkpoint; no commit/push before owner acceptance.
### X1.5 — Factory Engineering Environment

#### LIVE DEVELOPMENT BOOTSTRAP (required first step)

1. Verify/start the OIC API at `127.0.0.1:4100` in its own persistent terminal.
2. Verify/start the OIC Console at `localhost:3002` in a separate persistent terminal.
3. Confirm the owner-visible Console remains open inside VS Code throughout frontend work.
4. Use a third terminal for typecheck, lint, tests, build and Git.
5. Keep the frontend available throughout implementation; do not silently change ports.

- **GOAL:** create one connected engineering workspace across provider definitions, connections, credentials metadata, checks, upstream catalog, model families, editions, immutable revisions, variants, bindings and visibility.
- **PREREQUISITES / READ:** X1.1 accepted; read 02, 04, 05, 09, 16–27; inspect provider controller/service/DTO and secret tests.
- **ALLOWED / FORBIDDEN:** provider Console feature, same-origin BFF allowlist and strictly required OIC provider APIs. No cross-product provider reuse, secret display after issue, cost claims, capability guarantee from catalog, or arbitrary catalog JSON as default.
- **FRONTEND / API-BFF / DATA:** source-backed Provider → Connection → Catalog → Model Factory lineage, capability/health evidence, lifecycle, family/edition/revision/variant/binding and visibility. Add endpoint only after documented contract. Never fabricate catalog diff or history.
- **DEPENDENCY DECISIONS:** graph/chart package not required; catalog editor JSON uses current controls. **LIVE PREVIEW:** A :3002, B :4100, C validation; never terminate preview to run validations.
- **HUMAN CHECKPOINT / GATE:** demonstrate onboarding, error/retry, credential set/revoke, scope denial, catalog evidence and model lineage; inspect browser network for no secret. Four viewport/locale cells, focused tests and production build. One owner checkpoint; no commit/push before review. **RETURN:** X1.5 PARTIAL owner checkpoint.

### X1.6 — Cognitive Profiles + Model DNA — GO / CLOSED (2026-10-08)

#### LIVE DEVELOPMENT BOOTSTRAP (required first step)

1. Verify/start the OIC API at `127.0.0.1:4100` in its own persistent terminal.
2. Verify/start the OIC Console at `localhost:3002` in a separate persistent terminal.
3. Confirm the owner-visible Console remains open inside VS Code throughout frontend work.
4. Use a third terminal for typecheck, lint, tests, build and Git.
5. Keep the frontend available throughout implementation; do not silently change ports.

- **GOAL:** modernize cognitive profile workflows and source-backed DNA; DNA only consumes validated evaluation results. Model hierarchy, bindings and visibility are included in X1.5 under the current owner packet.
- **PREREQUISITES / READ:** accepted X1.3B, X1.4 and X1.5; read 02, 08, 10, 14, 17–27; obtain OIC-7 evaluator contract before scoring UI.
- **ALLOWED / FORBIDDEN:** OIC model/profile screens and exact necessary API DTO/BFF needs. Do not reshape API entities to fit UI metaphor, conflate variant/upstream model, infer binding resolution, turn settings into scores or promote on invented metric.
- **FRONTEND / API-BFF / DATA:** fleet/tree/passport/revision/variant/relationship/binding/visibility/policy. API remains source for valid transitions and scope. DATA is existing `OicModel*`, profile revision, audit and traces; OIC-7 measurements only with provenance/version/sample.
- **DEPENDENCY DECISIONS:** native table/list first; SVG graph/radar decision from measured comparison need. **LIVE PREVIEW:** A :3002, B :4100, C checks.
- **HUMAN CHECKPOINT / GATE:** operator follows family→edition→revision→variant and app/tenant binding/visibility path; validates partial/unmeasured DNA and RTL. Commit/push after acceptance. **RETURN:** X1.6 closeout.

- **CLOSEOUT:** Owner Visual Acceptance PASS and Workflow Acceptance PASS. Profiles, tuning, revision engineering, comparison, DNA foundation, exact model relationships and activity truthfulness are accepted. Console typecheck/lint, 52 tests, default-heap production build, HTTP health, DB readiness, diff, secret and OIC-boundary checks passed. See `OIC_X1_ACCEPTANCE_MATRIX.md` and `OIC_X1_6_COGNITIVE_PROFILE_CAPABILITY_MATRIX.md`.
- **BOUNDARY:** measured DNA and all evaluator/scoring/promotion work remain NOT IMPLEMENTED pending OIC-7; OIC-6 remains NOT STARTED. No next-milestone implementation is included.
- **X1.6 RETURN AT THAT CHECKPOINT:** OIC-X1.7 Memory & Knowledge Intelligence Studio (historical next step; now GO / CLOSED below). OIC-X1.8, OIC-6 and OIC-7 were NOT STARTED at that checkpoint.

### X1.7 — Memory & Knowledge Intelligence Studio

#### LIVE DEVELOPMENT BOOTSTRAP (required first step)

1. Verify/start the OIC API at `127.0.0.1:4100` in its own persistent terminal.
2. Verify/start the OIC Console at `localhost:3002` in a separate persistent terminal.
3. Confirm the owner-visible Console remains open inside VS Code throughout frontend work.
4. Use a third terminal for typecheck, lint, tests, build and Git.
5. Keep the frontend available throughout implementation; do not silently change ports.

- **GOAL:** safely edit/inspect app/tenant-scoped memory and knowledge with provenance, dependencies and supported lifecycle.
- **PREREQUISITES / READ:** accepted X1.1; read 04, 12, 14–27; audit API filtering/mutation allowlists and customer boundary.
- **ALLOWED / FORBIDDEN:** Memory/Knowledge workspace and minimal OIC DTO improvements if justified. No cross-tenant graph, vector-engine assumptions, fabricated retrieval utility, raw IDs as default, or editing server-owned embeddings.
- **FRONTEND / API-BFF / DATA:** separate Memory Engineering and Knowledge Engineering workspaces share canonical controls. Search uses supported metadata only. Knowledge is curated evidence records, not document ingestion/sync; runtime references stay bounded and do not expose prompt content, scores or unsupported source pipelines. The only API-BFF correction maps existing Memory `sensitivity` and `validUntil` fields through strict allowlists. No schema or database change.
- **DEPENDENCY DECISIONS:** dependency canvas starts accessible list; graph package deferred until scale/use measured. **LIVE PREVIEW:** A :3002, B :4100, C checks.
- **CLOSEOUT (2026-10-08):** Owner Manual Visual Acceptance PASS and Owner Workflow Acceptance PASS. Memory Studio PASS; Knowledge Studio PASS; domain separation, truthfulness, provenance, canonical adoption and security PASS. Console typecheck/lint, 59 tests, focused X1.7 tests 7/7, default-heap production build, production development-route 404 isolation, live health, API/database readiness, smoke routes, diff, changed-file secret-pattern scan and OIC-only boundary scan PASS. No screen-reader audit is claimed. Minor accepted visual polish is non-blocking. **RETURN:** OIC-X1.8 Intelligence Lab / Runtime / Traces, NOT STARTED. Do not start it in this closeout.

### X1.8 — Intelligence Lab / Runtime / Traces

#### LIVE DEVELOPMENT BOOTSTRAP (required first step)

1. Verify/start the OIC API at `127.0.0.1:4100` in its own persistent terminal.
2. Verify/start the OIC Console at `localhost:3002` in a separate persistent terminal.
3. Confirm the owner-visible Console remains open inside VS Code throughout frontend work.
4. Use a third terminal for typecheck, lint, tests, build and Git.
5. Keep the frontend available throughout implementation; do not silently change ports.

- **GOAL:** connect controlled setup, runtime result, evidence/resources and safe trace inspection.
- **PREREQUISITES / READ:** accepted X1.1; read 05, 10–11, 14, 17–27; preserve OIC-5 gates and trace allowlist.
- **ALLOWED / FORBIDDEN:** Workbench, Runtime Lab, Trace Explorer and necessary OIC runtime DTOs. No private CoT, provider payload, unsupported benchmark store, arbitrary winner ranking, or exposing secrets.
- **FRONTEND / API-BFF / DATA:** setup/scenario/pair/result/evidence/resources/trace. API may expose only safe existing stage fields or evidenced additions. Experiment persistence stays PLANNED absent a reviewed record/schema.
- **DEPENDENCY DECISIONS:** timeline/list native first; graph/visual library only with bounded data rationale. **LIVE PREVIEW:** A :3002, B :4100, C validation.
- **IMPLEMENTATION CHECKPOINT (superseded):** trace request correlation through scope-safe detail and compare changed conditions; verify private payload absent; inspect all four locale/layouts. That checkpoint was PARTIAL pending owner review. The final owner acceptance and closeout below supersede it. **RETURN:** X1.8 final closeout.

#### X1.8 FINAL OWNER ACCEPTANCE AND CLOSEOUT (2026-10-08)

- Source/API/schema audit and the current-contract capability map are complete in `OIC_X1_8_LAB_RUNTIME_TRACE_CAPABILITY_MATRIX.md`.
- Workbench uses the real paired execution endpoint and describes effective-policy/context differences; it does not persist experiments or claim quality/cost evaluation.
- Runtime discovers application/tenant-visible Oi IDs through a fixed same-origin Console BFF view and server runtime credential. Invocation continues through the existing protected action route.
- Trace detail shows allowlisted identifiers, enums, counts, timestamps and approved resource keys only. Raw JSON, prompt/response trace content, provider payload and private deliberation are excluded.
- **Owner decision:** Visual Acceptance PASS; Workflow Acceptance PASS; Workbench PASS; Runtime Lab PASS; Execution Traces PASS. Owner manually reviewed and accepted the final Lab composition and pre-run/zero-data states; no provider call was required. Accepted cosmetic debt is non-blocking.
- **Cross-Lab and methodology:** Experiment → Runtime → Trace is local navigation/context while the main sidebar remains authoritative. Workbench is operational comparison only, not evaluation: no score/winner, with held conditions, different effective policies and only returned numeric evidence. Runtime distinguishes discovery/precondition unavailability from an attempted invocation failure. Trace search is limited to its returned bounded sample.
- **Truthfulness/security:** no fake telemetry, progress, retrieval, memory/knowledge usage, verification, cost, history, runtime context or traces; no protected prompt, private deliberation or credentials rendered. Trace detail stays allowlisted. Existing authentication, session, origin, CSRF, BFF, server machine credential, and tenant/application authorization remain authoritative. OIC-6/7/8 are NOT STARTED.
- **Localization/accessibility/responsive:** owner accepted EN/AR and LTR/RTL direction and the responsive/narrow Lab composition. Source and focused tests cover native Arabic, direction, canonical controls, semantic states and narrow reflow. No full keyboard or screen-reader audit is claimed; browser cell captures were not automated.
- **Validation:** Console typecheck/lint and all 66 Console tests pass; default-heap production build succeeds; production dev-route isolation is verified below. Console root and `/dev/flight-deck` return HTTP 200 in development; API liveness and database readiness return HTTP 200 with database `ok`; `git diff --check`, secret and OIC product-boundary scans pass. No provider invocation or live mutation was needed for acceptance.
- **Disposition:** X1.8 = GO / CLOSED. Exact next return point is OIC-X1.9 Smart Operating Layer / Operations / Final Integration, NOT STARTED. OIC-6, OIC-7 and OIC-8 remain NOT STARTED. Do not start another milestone in this closeout.

### X1.9 — Smart Operating Layer / Operations / Final Integration

#### LIVE DEVELOPMENT BOOTSTRAP (required first step)

1. Verify/start the OIC API at `127.0.0.1:4100` in its own persistent terminal.
2. Verify/start the OIC Console at `localhost:3002` in a separate persistent terminal.
3. Confirm the owner-visible Console remains open inside VS Code throughout frontend work.
4. Use a third terminal for typecheck, lint, tests, build and Git.
5. Keep the frontend available throughout implementation; do not silently change ports.

- **GOAL:** integrate grounded fact/insight/advice states with Health, Audit and cross-workspace operator workflows.
- **PREREQUISITES / READ:** accepted prior milestones; read 01, 06, 13–18, 20–27; source-backed impact/evaluator contracts.
- **ALLOWED / FORBIDDEN:** contextual insight, operations surfaces, final OIC integration. No autonomous remediation, generic chatbot-first UI, ungrounded prediction or cross-product action.
- **FRONTEND / API-BFF / DATA:** source-linked insight lifecycle and confirmed apply/result; Operations aggregates only with owner endpoint. API work only for explicit OIC-owned measured sources and guarded actions.
- **DEPENDENCY DECISIONS:** no advisor model/package until grounding, permission and uncertainty contract approved. **LIVE PREVIEW:** A :3002, B :4100, C validation, kept separate and visible in VS Code.
- **HUMAN CHECKPOINT / GATE:** end-to-end actions and failures, every locale/viewport, accessibility, security, performance and isolation; owner review. Commit/push only after final serial validation and diff approval. **RETURN:** OIC-X1 final closeout.

## Permanent local environment protocol

Every frontend implementation sprint uses Terminal A (Console dev process, fixed port 3002, visible in VS Code), Terminal B (OIC API at 4100 when needed), and Terminal C (build/test/lint/Git). Do not silently change ports or repeatedly terminate A/B. If a build truly requires interruption, record why, restart the same service and verify HTTP/health before proceeding. Never inspect/request Operator password or weaken auth, origin, CSRF, session, BFF or machine credential boundaries.

## X1.4 final closeout (2026-10-07)

- **Status:** GO / CLOSED by explicit owner Visual and Workflow Acceptance PASS. The accepted scope and evidence limits are recorded in `OIC_X1_ACCEPTANCE_MATRIX.md`.
- **Next return point:** OIC-X1.5. X1.5 and OIC-6 remain NOT STARTED. No Provider Factory or Model Factory modernization is included in this closeout.

## X1.5 final closeout (2026-10-07)

- **Status:** GO / CLOSED by owner Visual Acceptance PASS and Workflow Acceptance PASS for Provider Factory, Upstream Catalog and Model Factory.
- **Browser evidence:** automated authenticated EN/AR × desktop/narrow × LTR/RTL matrix is UNAVAILABLE due accepted local browser/CDP tooling limitation. Owner manual review is accepted; no further browser automation or profile attempts are authorized by this closeout.
- **Validation:** Console typecheck, lint, 45 tests, API focused snapshot tests (2/2), API typecheck/build, default-heap Console production build, `git diff --check`, secret scan and OIC boundary scan PASS. API readiness reports database `ok`; Console and API remain on their prescribed ports.
- **State:** X1.6 — Cognitive Profiles + Model DNA is the exact next return point defined below and remains NOT STARTED. Its OIC-7 evaluator-contract prerequisite applies before DNA scoring UI. OIC-6 remains NOT STARTED.

## X1.6 final closeout (2026-10-08)

- **Status:** GO / CLOSED. Owner Visual Acceptance PASS and Workflow Acceptance PASS; primary Configuration workspace visual direction was already accepted, and remaining workflows were checked against source and focused tests.
- **Validation:** Console typecheck and lint PASS; all 52 configured Console tests PASS; default-heap production build PASS after stopping only Console and restarting it on port 3002; Console root and requested workspaces HTTP 200; API live/readiness HTTP 200 with database `ok`; `git diff --check`, changed-file secret scan and OIC boundary review PASS.
- **Truthfulness and security:** DNA remains unmeasured with OIC-7 dependency preserved. No synthetic values, ranking, evaluator/scoring/promotion, OIC-6 features or authentication/session/origin/CSRF/BFF weakening. No Responix or Mega Platform Portal changes.
- **Next return point:** OIC-X1.7 — Memory & Knowledge Intelligence Studio. X1.7, OIC-6 and OIC-7 remain NOT STARTED.
