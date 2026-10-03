# OIC-X1 Implementation Tracker

## Baseline and working tree

- **Baseline:** `aa50e61` on branch `oic`.
- **Current state:** OIC-5 GO; OIC-X1.0C architecture lock GO, version 1.0 LOCKED; X1-1 PARTIAL / active dirty work. X1.0C commits documentation only; no X1-1 source is staged.
- **Existing uncommitted X1-1 files (preserve exactly):**
  - Modified: `apps/oic-console/app/console-app.tsx`, `features/overview/overview-view.tsx`, `features/runtime/runtime-view.tsx`, `i18n.ts`, `styles.css`.
  - New: `apps/oic-console/app/components/oic-frames.tsx`, `oic-primitives.tsx`.
- No X1-1 implementation file was changed during X1.0C. This pass adds architecture/project-state Markdown only; preserve the listed dirty X1-1 files exactly.

## Architecture work and milestone position

- **Completed in X1.0C:** runtime interaction/governance contracts 21–27, cross-links and decision amendments 15–24; execution plan bootstraps, acceptance matrix and tracker update (see `docs/architecture/oic-x1/`).
- **Current milestone:** X1.0 Architecture Lock v1.0; LOCKED after X1.0C GO validation.
- **X1-1:** remains PARTIAL; resume only after architecture lock review and separate instruction.
- **Next:** resume X1-1 against Architecture Lock v1.0. Do not start X1-2 automatically.
- **Deferred:** Flight Deck/instrument runtime, telemetry histories/alerts/resource metrics, Model DNA scores until OIC-7 methodology, graph/chart dependency decision, arbitrary layouts, autonomous SOL, generic chat.

## Dependencies and preview

- Console package declares Next.js, React and React DOM only; no Console chart/graph/icon/animation package and no Console test/browser-runner script. Custom CSS and local React components are the current approach.
- API is NestJS with `@oic/contracts`, `@oic/database`, Prisma and Zod. Selected Node test suites run after build; they are not browser acceptance.
- **Preview topology:** Console `http://localhost:3002` in persistent process/session `68323`; API `http://127.0.0.1:4100` in persistent process/session `80662`. Processes are separate. API health live (contract v1) and database readiness returned OK; Console returned HTTP 200 after compilation. No secrets are recorded here.
- Console `.env.local` points to `http://127.0.0.1:4100`; file contents other than that endpoint were not recorded. Previous data-path diagnosis confirmed BFF snapshot and protected API path worked when both services ran; this pass did not change BFF/auth code.

## Validation and boundaries

- X1.0C validation: cross-document/local-link/source-path/secret/boundary audit and `git diff --check`; no backend suites/build run for docs-only changes.
- OIC-only product changes. Responix and Mega Platform Portal are untouched. No new dependency, API change, schema change or auth change in X1.0C.
- Existing preview processes must remain live; separately verify Console HTTP and API readiness at closeout.

## Expanded X1.1–X1.7 position

The detailed goals, allowed/forbidden scope, documents to read, data/dependency decisions, human checkpoints, live-preview arrangement, acceptance and return points are locked in `OIC_X1_EXECUTION_PLAN.md`.

| Milestone | Status | Exit evidence / dependency |
|---|---|---|
| X1.0 / X1.0B / X1.0C | GO / LOCKED v1.0 | Docs-only architecture commit; X1-1 working tree preserved separately. |
| X1.1 | PARTIAL / ACTIVE dirty worktree | Current shell, frames/primitives, Overview/runtime presentation and locale/style work are present in the listed dirty files. Prior focused typecheck/lint/build passed. Remaining: architecture review, finish bounded foundation scope, four-way authenticated browser review, keyboard/accessibility/error-state evidence, final diff review and owner commit/push instruction. |
| X1.2 | NOT STARTED | Wait for X1.1 acceptance; no instrument implementation now. History/source contract and OIC-7 boundaries apply. |
| X1.3 | NOT STARTED | Current API entities exist; workspace still planned. Provider security contract is prerequisite. |
| X1.4 | NOT STARTED | Model hierarchy/profile APIs exist. OIC-7 evaluator methodology is required before measured DNA. |
| X1.5 | NOT STARTED | Current memory/knowledge APIs and schema exist; studio/graph/analytics remain planned. |
| X1.6 | NOT STARTED | Current Workbench/runtime/traces exist; unified Lab surfaces and trace inspector contract remain planned. |
| X1.7 | NOT STARTED | No SOL/alert/host telemetry implementation claimed. Requires source-backed advice and final integration. |

## Current implementation checkpoint (X1.1)

**Present in dirty source, not independently declared milestone-complete:** current navigation/page frame and primitive composition; styling/token foundation; changes to Overview and Runtime views; EN/AR labels and RTL presentation updates; health refresh tied to snapshot state. These are the existing X1-1 working changes and must be preserved byte-for-byte during X1.0B. Prior turn recorded Console typecheck, lint and production build passing after the UI updates. The Console package still lacks a test script/browser runner, so that is not browser acceptance.

**Remaining before X1.1 closeout:** apply reviewed architecture to any remaining X1.1-only gaps; run authenticated browser acceptance in EN/LTR desktop, AR/RTL desktop, EN/LTR narrow, AR/RTL narrow; capture keyboard/focus and empty/loading/error/unavailable/live behavior; verify no auth/BFF scope regression; final serial validation and scoped diff review. No commits/pushes were made by X1.0B and none are authorized by this documentation pass.

## Documentation lock version and OIC-7 dependencies

Architecture lock now has two review layers: X1.0 structure/direction and X1.0B detailed implementation contracts. Metric and Model DNA documents expressly separate current trace/control evidence from OIC-7-owned evaluator quality, confidence, cohort, and comparative semantics. OIC-7 telemetry, evaluator APIs, historical retention, alert/resource collection, general experiments, and custom deck persistence remain known future dependencies, not current capabilities.
