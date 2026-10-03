# OIC-X1 Execution Plan

**Baseline:** `aa50e61`. **Product boundary:** OIC only. **Current:** OIC-5 GO; X1-1 PARTIAL with dirty work. X1.0 architecture lock precedes broad implementation. X1.0 does not commit or advance milestones.

| Milestone | Scope | Dependencies | Non-goals | Frontend surfaces | Backend/API work | Acceptance gate / return point |
|---|---|---|---|---|---|---|
| X1.0 Architecture Lock | Freeze architecture, catalogs, blueprints and gates in `docs/architecture/oic-x1/` and project-state docs. | Audit actual API/schema/Console and dirty tree. | Feature implementation, X1-2, dependency additions. | None; keep current Console preview live. | Inspection only; restore local services only if needed. | Docs checked against source; `git diff --check`; closeout for review. Then stop. |
| X1.1 Shell / Design System / Interaction Foundation | Complete shell, navigation/workspace frames, tokens, interactions, reusable states, locale/direction coverage. | X1.0 review; preserve current dirty implementation. | Flight Deck, provider/model factory redesign. | Global shell and current pages progressively framed. | Only OIC endpoints strictly needed, separate approval within milestone. | Existing pages usable at four browser layouts; security and keyboard gates; return to X1.1 closeout. |
| X1.2 Intelligence Flight Deck | Source-backed Overview instruments, groups and drilldowns. | X1.1 shell; metric/instrument contract; real source/history decision. | Fake telemetry, Model DNA, arbitrary dashboards. | Overview/System Core/Fleet/Provider/Factory/Lab sections. | Add telemetry/history API only where required and owner-approved. | Every instrument source/state/unit/freshness; four viewports; empty/offline and live. Return to X1.2. |
| X1.3 Provider Factory | Workspace across provider definitions, connections, credentials metadata, checks, sync and upstream catalog. | X1.1; API/security source audit. | Billing/economics not modeled; credential exposure. | Provider Factory/catalog and scoped inspectors. | Only missing OIC API contracts evidenced by needs. | Credential custody, scopes, provider failure/sync and real status. Return to X1.3. |
| X1.4 Model Factory + Cognitive Profiles + Model DNA | Model Passport and actual hierarchy; profile configuration; DNA shell consumes valid OIC-7 evidence only. | X1.1/1.3; OIC-7 measurement contract before scored DNA. | Invented scores or lifecycle semantics. | Fleet, hierarchy, revisions, bindings, visibility, profile, compare/passport. | Respect existing model/profile APIs; evaluate only if OIC-7 contract exists. | Hierarchy/scope/lifecycle; profile → trace evidence; DNA method/version or unavailable. Return to X1.4. |
| X1.5 Memory & Knowledge Intelligence Studio | Scoped records, provenance, dependencies, lifecycle and linked execution. | X1.1 and current memory/knowledge API. | Cross-tenant joins, general document platform. | Memory and Knowledge studios. | Changes only for demonstrated query/relationship gaps. | Scope isolation, provenance/dependency integrity, lifecycle and empty/failure. Return to X1.5. |
| X1.6 Intelligence Lab / Runtime / Traces | Controlled run, result, evidence and safe trace inspection. | X1.1, runtime and trace contracts; OIC-5 baseline. | Hidden CoT; unsupported quality rankings. | Workbench, Runtime Lab, Trace Explorer. | Preserve bounded/safe trace DTO; add only evidenced observability. | Request→trace→result, scope, matched compare, no sensitive payload, four layouts. Return to X1.6. |
| X1.7 Smart Operating Layer / Operations / Final Integration | Contextual source-linked advice, health/audit integration and end-to-end polish. | Prior milestones; grounded impact contracts. | Autonomous change, fabricated prediction, cross-product operations. | Context insights, Operations/Health/Audit, global cross-workspace flows. | Only required measured signals and integration contracts. | Full browser/security/product-boundary/performance matrix and owner acceptance. Return final OIC-X1 review. |

Every later milestone specifies exact APIs/fields, migration need, rollback, and dependencies before coding. If OIC-7 work is unavailable, keep affected UI explicitly unmeasured and continue independent scope.

## Milestone implementation packets

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

### X1.3 — Provider Factory

#### LIVE DEVELOPMENT BOOTSTRAP (required first step)

1. Verify/start the OIC API at `127.0.0.1:4100` in its own persistent terminal.
2. Verify/start the OIC Console at `localhost:3002` in a separate persistent terminal.
3. Confirm the owner-visible Console remains open inside VS Code throughout frontend work.
4. Use a third terminal for typecheck, lint, tests, build and Git.
5. Keep the frontend available throughout implementation; do not silently change ports.

- **GOAL:** create provider definition/connection/credential/catalog operator workspace with scoped onboarding and truthful checks.
- **PREREQUISITES / READ:** X1.1 accepted; read 02, 04, 05, 09, 16–27; inspect provider controller/service/DTO and secret tests.
- **ALLOWED / FORBIDDEN:** provider Console feature, same-origin BFF allowlist and strictly required OIC provider APIs. No cross-product provider reuse, secret display after issue, cost claims, capability guarantee from catalog, or arbitrary catalog JSON as default.
- **FRONTEND / API-BFF / DATA:** overview, connections, credentials metadata, capabilities, upstream catalog, test/sync feedback. Add endpoint only after documented contract. Use existing provider definitions/connections, credential metadata, check/sync/evidence records; preview diff only if actual API supports it.
- **DEPENDENCY DECISIONS:** graph/chart package not required; catalog editor JSON uses current controls. **LIVE PREVIEW:** A :3002, B :4100, C validation; never terminate preview to run validations.
- **HUMAN CHECKPOINT / GATE:** demonstrate onboarding, error/retry, credential set/revoke, scope denial and catalog evidence; inspect browser network for no secret. Four viewports/locales. Commit/push after acceptance. **RETURN:** X1.3 closeout.

### X1.4 — Model Factory + Cognitive Profiles + Model DNA

#### LIVE DEVELOPMENT BOOTSTRAP (required first step)

1. Verify/start the OIC API at `127.0.0.1:4100` in its own persistent terminal.
2. Verify/start the OIC Console at `localhost:3002` in a separate persistent terminal.
3. Confirm the owner-visible Console remains open inside VS Code throughout frontend work.
4. Use a third terminal for typecheck, lint, tests, build and Git.
5. Keep the frontend available throughout implementation; do not silently change ports.

- **GOAL:** provide coherent workspace over actual model hierarchy, profile revisions, bindings, visibility and source-backed passport; DNA only consumes validated evaluation results.
- **PREREQUISITES / READ:** accepted X1.1 and X1.3; read 02, 08, 10, 14, 17–27; obtain OIC-7 evaluator contract before scoring UI.
- **ALLOWED / FORBIDDEN:** OIC model/profile screens and exact necessary API DTO/BFF needs. Do not reshape API entities to fit UI metaphor, conflate variant/upstream model, infer binding resolution, turn settings into scores or promote on invented metric.
- **FRONTEND / API-BFF / DATA:** fleet/tree/passport/revision/variant/relationship/binding/visibility/policy. API remains source for valid transitions and scope. DATA is existing `OicModel*`, profile revision, audit and traces; OIC-7 measurements only with provenance/version/sample.
- **DEPENDENCY DECISIONS:** native table/list first; SVG graph/radar decision from measured comparison need. **LIVE PREVIEW:** A :3002, B :4100, C checks.
- **HUMAN CHECKPOINT / GATE:** operator follows family→edition→revision→variant and app/tenant binding/visibility path; validates partial/unmeasured DNA and RTL. Commit/push after acceptance. **RETURN:** X1.4 closeout.

### X1.5 — Memory & Knowledge Intelligence Studio

#### LIVE DEVELOPMENT BOOTSTRAP (required first step)

1. Verify/start the OIC API at `127.0.0.1:4100` in its own persistent terminal.
2. Verify/start the OIC Console at `localhost:3002` in a separate persistent terminal.
3. Confirm the owner-visible Console remains open inside VS Code throughout frontend work.
4. Use a third terminal for typecheck, lint, tests, build and Git.
5. Keep the frontend available throughout implementation; do not silently change ports.

- **GOAL:** safely edit/inspect app/tenant-scoped memory and knowledge with provenance, dependencies and supported lifecycle.
- **PREREQUISITES / READ:** accepted X1.1; read 04, 12, 14–27; audit API filtering/mutation allowlists and customer boundary.
- **ALLOWED / FORBIDDEN:** Memory/Knowledge workspace and minimal OIC DTO improvements if justified. No cross-tenant graph, vector-engine assumptions, fabricated retrieval utility, raw IDs as default, or editing server-owned embeddings.
- **FRONTEND / API-BFF / DATA:** inventory/composer/source editor/dependency list/inspectors/trace links. Add BFF fields only from explicit source. Use existing OicIntelligenceMemory/Knowledge; new search/history metrics need API query/retention contract.
- **DEPENDENCY DECISIONS:** dependency canvas starts accessible list; graph package deferred until scale/use measured. **LIVE PREVIEW:** A :3002, B :4100, C checks.
- **HUMAN CHECKPOINT / GATE:** demonstrate create/edit/archive and scope denial, dependency unknown/conflict states, sensitivity and focus in four layouts. Commit/push after acceptance. **RETURN:** X1.5 closeout.

### X1.6 — Intelligence Lab / Runtime / Traces

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
- **HUMAN CHECKPOINT / GATE:** trace request correlation through scope-safe detail and compare changed conditions; verify private payload absent; all four locale/layouts. Commit/push after acceptance. **RETURN:** X1.6 closeout.

### X1.7 — Smart Operating Layer / Operations / Final Integration

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
