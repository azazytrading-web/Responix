# OIC-X1 Implementation Tracker

## Baseline and milestone history

- **Baseline:** `aa50e61` on branch `oic`.
- **Current state:** OIC-5 GO; OIC-X1.0C architecture lock GO, version 1.0 LOCKED; X1.1 shell/design-system/interaction foundation GO after authenticated browser acceptance and final validation.
- **X1.1 delivered files:**
  - Modified: `apps/oic-console/app/console-app.tsx`, `features/overview/overview-view.tsx`, `features/runtime/runtime-view.tsx`, `i18n.ts`, `styles.css`.
  - New: `apps/oic-console/app/components/oic-frames.tsx`, `oic-primitives.tsx`.
- X1.0C preserved the then-uncommitted X1.1 application work. The listed X1.1 files are now included in the X1.1 closeout.

## Architecture work and milestone position

- **Completed in X1.0C:** runtime interaction/governance contracts 21–27, cross-links and decision amendments 15–24; execution plan bootstraps, acceptance matrix and tracker update (see `docs/architecture/oic-x1/`).
- **Current milestone:** X1.0 Architecture Lock v1.0; LOCKED after X1.0C GO validation.
- **X1.1:** completed against Architecture Lock v1.0. See the X1.1 browser run and validation evidence in `OIC_X1_ACCEPTANCE_MATRIX.md`.
- **Next:** X1.2 remains NOT STARTED and requires a separate instruction.
- **Deferred:** Flight Deck/instrument runtime, telemetry histories/alerts/resource metrics, Model DNA scores until OIC-7 methodology, graph/chart dependency decision, arbitrary layouts, autonomous SOL, generic chat.

## Dependencies and preview

- Console package declares Next.js, React and React DOM only; no Console chart/graph/icon/animation package and no Console test/browser-runner script. Custom CSS and local React components are the current approach.
- API is NestJS with `@oic/contracts`, `@oic/database`, Prisma and Zod. Selected Node test suites run after build; they are not browser acceptance.
- **Preview topology:** Console `http://localhost:3002` and API `http://127.0.0.1:4100` run in separate persistent sessions. API live/readiness/database health passed; Console returned HTTP 200 after the production build was completed and the development preview restored. The authenticated BFF snapshot returned live records. No secrets are recorded here.
- Console `.env.local` points to `http://127.0.0.1:4100`; file contents other than that endpoint were not recorded. Previous data-path diagnosis confirmed BFF snapshot and protected API path worked when both services ran; this pass did not change BFF/auth code.

## Validation and boundaries

- X1.1 validation: Console typecheck, lint and production build passed; `git diff --check` passed; configured Console tests are N/A (no test script/browser runner). API source was unchanged. Authenticated BFF snapshot/health, all 15 EN/LTR desktop destinations, four locale/viewport cells, representative routes, no-overflow and command-palette keyboard checks passed. Empty/loading/error/unavailable primitives are implemented; forced-failure/offline and screen-reader checks were not run.
- OIC-only product changes. Responix and Mega Platform Portal are untouched. X1.1 adds no dependency, API change, schema change or auth change.
- Existing preview processes must remain live; separately verify Console HTTP and API readiness at closeout.

## Expanded X1.1–X1.7 position

The detailed goals, allowed/forbidden scope, documents to read, data/dependency decisions, human checkpoints, live-preview arrangement, acceptance and return points are locked in `OIC_X1_EXECUTION_PLAN.md`.

| Milestone | Status | Exit evidence / dependency |
|---|---|---|
| X1.0 / X1.0B / X1.0C | GO / LOCKED v1.0 | Docs-only architecture commit; X1-1 working tree preserved separately. |
| X1.1 | GO | Shell, frames/primitives, Overview/runtime presentation and locale/style foundation complete. Authenticated four-cell viewport matrix, 15-route EN/LTR walk, command keyboard path, API/BFF data path, typecheck/lint/build and scoped boundary checks passed; evidence limits are recorded in the acceptance matrix. |
| X1.2 | NOT STARTED | Wait for X1.1 acceptance; no instrument implementation now. History/source contract and OIC-7 boundaries apply. |
| X1.3 | NOT STARTED | Current API entities exist; workspace still planned. Provider security contract is prerequisite. |
| X1.4 | NOT STARTED | Model hierarchy/profile APIs exist. OIC-7 evaluator methodology is required before measured DNA. |
| X1.5 | NOT STARTED | Current memory/knowledge APIs and schema exist; studio/graph/analytics remain planned. |
| X1.6 | NOT STARTED | Current Workbench/runtime/traces exist; unified Lab surfaces and trace inspector contract remain planned. |
| X1.7 | NOT STARTED | No SOL/alert/host telemetry implementation claimed. Requires source-backed advice and final integration. |

## X1.1 completion checkpoint

**Completed:** global COMMAND/FOUNDATION/FACTORY/INTELLIGENCE/LAB/OPERATIONS navigation; command palette; PageFrame and WorkspaceFrame; local interaction primitives including Slider/RangeSlider, EntityPicker, Drawer/Inspector, Wizard, CompareSurface, contextual states, ActionFeedback and ContextualInsight; responsive black/amber design foundation; EN/AR and LTR/RTL shell; Overview and Runtime presentation updates. Existing authentication, origin, CSRF, BFF and machine-identity paths were not weakened or changed.

**Closeout:** the four-cell authenticated browser matrix and required route walk passed; the command palette keyboard path passed; live API, database readiness and real Overview BFF data passed; typecheck, lint and production build passed. The acceptance matrix records the exact scope and evidence limits. The Console package has no frontend test script/browser runner. No X1.2 Flight Deck/telemetry implementation or OIC-6 work was started.

## Documentation lock version and OIC-7 dependencies

Architecture lock now has two review layers: X1.0 structure/direction and X1.0B detailed implementation contracts. Metric and Model DNA documents expressly separate current trace/control evidence from OIC-7-owned evaluator quality, confidence, cohort, and comparative semantics. OIC-7 telemetry, evaluator APIs, historical retention, alert/resource collection, general experiments, and custom deck persistence remain known future dependencies, not current capabilities.
