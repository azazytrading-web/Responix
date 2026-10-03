# OIC-X1 Acceptance Matrix

Status vocabulary is defined in [acceptance architecture](../architecture/oic-x1/20_OIC_ACCEPTANCE_ARCHITECTURE.md). This is an expandable per-milestone ledger. X1.0 documents gates; it does not claim UI acceptance. Current browser cells remain **NOT STARTED in this X1 ledger** until evidence is recorded against the architecture version; prior OIC-5 acceptance is separate.

| Milestone/surface | Desktop EN/LTR | Desktop AR/RTL | Narrow EN/LTR | Narrow AR/RTL | Keyboard | Empty/loading/error/offline/live | Security | Human workflow / integration | Owner |
|---|---|---|---|---|---|---|---|---|---|
| X1.0 / X1.0B architecture docs | N/A (docs) | N/A (docs) | N/A (docs) | N/A (docs) | N/A | N/A | UNCHANGED: no auth/code edits | PARTIAL: source, service health and document checks; no browser interaction run | X1.0B |
| X1.0C runtime interaction/governance lock | N/A (docs) | N/A (docs) | N/A (docs) | N/A (docs) | N/A | PASS: temporal/action/permission/recovery/compatibility contracts reviewed against source; no app behavior claimed | UNCHANGED: no auth/code edits | PASS after document/link/path/secret/boundary checks; no browser acceptance implied | X1.0C |
| X1.1 shell/current pages | PASS: Edge 154, 1440×900, all six nav groups and live Overview rendered | PASS: Arabic headings/group labels and RTL direction; 1440×900 | PASS: 390×844, grouped nav scrolls within shell; no document overflow | PASS: 390×844 RTL; no document overflow | PASS: command palette open, arrow focus, Enter navigation, Escape close and focus return | PARTIAL: live BFF/API/DB PASS; empty/loading/error/unavailable primitives present; no fault injection or forced-offline run | PASS: authenticated BFF data path and current guards exercised; no auth/origin/CSRF/BFF code changed; static boundary scan | PASS: all 15 routes on EN/LTR desktop; representative route in every nav group in all four cells; no mutation action performed | X1.1 |
| X1.2 Flight Deck | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | X1.2 |
| X1.3 Provider Factory | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | X1.3 |
| X1.4 Model Factory / profiles / DNA | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | X1.4 |
| X1.5 Memory / Knowledge | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | X1.5 |
| X1.6 Lab / Runtime / Traces | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | X1.6 |
| X1.7 Smart Operations / final integration | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | X1.7 |

Per page expand with: keyboard/screen reader; scope-denied; empty; filtered empty; loading; API error; offline/unavailable; idle; live/stale; lifecycle transition; technical inspector; resize/zoom; reduced motion; source/method/freshness; screenshots and trace/request evidence. Record browser/version, dimensions, test account role without credential, API/database build, run date and owner. Do not transfer old pass claims into this matrix without matching evidence.

## Gate evidence matrix

| Dimension | Required evidence to mark PASS | Automation vs owner review |
|---|---|---|
| Structural | Correct OIC workspace/component/data ownership; referenced routes/files exist | Static path scan plus architecture review |
| Functional | Primary/secondary action, persistence/read-back and recovery | API/BFF tests plus observed workflow |
| Visual | Hierarchy, density, states, overflow in all four locale/viewports | Screenshot diff when configured plus human browser review |
| Interaction | Keyboard, picker, tabs, inspector/drawer, wizard, confirm and focus return | Component automation if available plus manual keyboard review |
| Localization / RTL | Native labels, bidi isolation, mirrored geometry | Key/static checks plus Arabic browser review |
| Accessibility | Names, focus, contrast, announcements, zoom and reduced motion | Automated audit when configured plus keyboard/screen-reader spot check |
| Responsive | No lost action/page overflow at target desktop/narrow bounds | Viewport automation if configured plus actual browser review |
| Security | Session/origin, API scopes, app/tenant isolation, no secret in client | Guard tests/scans plus network inspection |
| Performance | Bounded payload/render at representative entity cardinality | Automated payload/build report plus human responsiveness check |
| Product boundary | Only OIC paths/DB/contracts changed; no imports/data coupling | Git path/import/schema scans plus review |
| Human workflow | Operator completes normal and failure path without raw ID/password workaround | Owner-observed browser task; cannot be replaced by unit test |

Each PASS links a reproducible command/test/artifact or dated owner review. PARTIAL names passed subset and missing evidence. BLOCKED names dependency/owner/next action. UNCHANGED is not regression-tested.

## X1.1 browser run record

- **Run date:** 2026-10-03. **Browser:** Microsoft Edge 154.0.4258.48. **Preview:** Console `http://localhost:3002`; API `http://127.0.0.1:4100`.
- **Locale/viewport matrix:** EN/LTR and AR/RTL at 1440×900 and 390×844. `document.documentElement.scrollWidth` stayed within the viewport; all six global navigation groups remained present. The narrow navigation scrolls inside its own bounded strip.
- **Route walk:** all 15 destinations rendered the expected page heading in EN/LTR desktop. Overview, Applications, Provider Factory, OIC Memory, Intelligence Workbench and Health & readiness rendered with the correct selected destination in each of the four matrix cells.
- **Authenticated data path:** `/api/session` reported authenticated; BFF snapshot and health each returned 200. Snapshot counts were 15 applications, 19 tenants, 13 principals, 12 connections, 19 upstream models, 7 model families and 60 audit rows. Health and database readiness were `ok`.
- **Keyboard:** command palette opened; ArrowDown moved focus to a result; Enter navigated and returned focus; Escape closed and returned focus.
- **Evidence limits:** no destructive or write workflow was run. No forced API failure/offline or screen-reader test was performed. No Console test/browser-runner script is configured.
