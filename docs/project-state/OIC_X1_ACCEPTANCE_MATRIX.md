# OIC-X1 Acceptance Matrix

Status vocabulary is defined in [acceptance architecture](../architecture/oic-x1/20_OIC_ACCEPTANCE_ARCHITECTURE.md). This is an expandable per-milestone ledger. X1.0 documents gates; it does not claim UI acceptance. Current browser cells remain **NOT STARTED in this X1 ledger** until evidence is recorded against the architecture version; prior OIC-5 acceptance is separate.

| Milestone/surface | Desktop EN/LTR | Desktop AR/RTL | Narrow EN/LTR | Narrow AR/RTL | Keyboard | Empty/loading/error/offline/live | Security | Human workflow / integration | Owner |
|---|---|---|---|---|---|---|---|---|---|
| X1.0 / X1.0B architecture docs | N/A (docs) | N/A (docs) | N/A (docs) | N/A (docs) | N/A | N/A | UNCHANGED: no auth/code edits | PARTIAL: source, service health and document checks; no browser interaction run | X1.0B |
| X1.0C runtime interaction/governance lock | N/A (docs) | N/A (docs) | N/A (docs) | N/A (docs) | N/A | PASS: temporal/action/permission/recovery/compatibility contracts reviewed against source; no app behavior claimed | UNCHANGED: no auth/code edits | PASS after document/link/path/secret/boundary checks; no browser acceptance implied | X1.0C |
| X1.1 shell/current pages | PASS: Edge 154, 1440×900, all six nav groups and live Overview rendered | PASS: Arabic headings/group labels and RTL direction; 1440×900 | PASS: 390×844, grouped nav scrolls within shell; no document overflow | PASS: 390×844 RTL; no document overflow | PASS: command palette open, arrow focus, Enter navigation, Escape close and focus return | PARTIAL: live BFF/API/DB PASS; empty/loading/error/unavailable primitives present; no fault injection or forced-offline run | PASS: authenticated BFF data path and current guards exercised; no auth/origin/CSRF/BFF code changed; static boundary scan | PASS: all 15 routes on EN/LTR desktop; representative route in every nav group in all four cells; no mutation action performed | X1.1 |
| X1.2 Flight Deck | PASS: showcase desktop, no horizontal overflow; owner manually accepted real Overview | PASS: native Arabic/RTL showcase desktop; owner manually accepted | PASS: 390px reflow, no horizontal overflow; owner manually accepted | PASS: native Arabic/RTL showcase narrow; owner manually accepted | PASS: inspector keyboard path; 26 Console tests pass | PASS: five showcase scenarios; API/readiness/database pass; production build verified dev routes return 404 | PASS static review: auth/BFF/origin/CSRF boundaries unchanged | PASS: owner manually reviewed Overview, showcase, gallery and all board areas; automated authenticated real-Overview capture NOT AVAILABLE | GO / CLOSED by owner acceptance; cosmetic polish debt accepted |
| X1.3A Interface Systems Architecture | N/A (docs) | N/A (docs) | N/A (docs) | N/A (docs) | N/A (docs) | PASS: source-grounded interaction contracts | PASS: OIC-only docs, no auth code changes | PASS: document/link/source/boundary/service checks | X1.3A GO / CLOSED |
| X1.3B Interface Systems Implementation & Gallery | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | Owner review/authorization after X1.3A |
| X1.4 Provider Factory | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | X1.4 |
| X1.5 Model Factory / profiles / DNA | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | X1.5 |
| X1.6 Memory / Knowledge | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | X1.6 |
| X1.7 Lab / Runtime / Traces | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | X1.7 |
| X1.8 Smart Operations / final integration | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | X1.8 |

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

## X1.2 closeout attempt

- **Run date:** 2026-10-04. **Starting head:** `703e3f0`. **Preview:** Console `http://localhost:3002`; OIC API `http://127.0.0.1:4100`.
- **Instrument baseline:** owner visual approval recorded; OIC Instrument Library v1.0 is documented as VISUALLY APPROVED / FROZEN BASELINE. Gallery remains development-only, server-guarded, and absent from Console navigation. Future **Oi Instrumentation System** extraction remains PLANNED / NOT IMPLEMENTED.
- **Live services:** OIC `/api/v1/health/live` returned 200; `/api/v1/health/ready` returned 200 with database `ok`; Console and `/dev/instruments` returned HTTP 200 in development. API code and database schema were unchanged.
- **Automated evidence:** Console typecheck passed; ESLint passed; all 16 Console tests passed; production build passed with the repository default Node heap. Build compilation took 33.7 seconds, then type/lint checks, static generation and trace collection completed. No arbitrary heap increase was used.
- **Build diagnosis:** prior `.next` held 204 MB across development and production webpack caches. No duplicate build process was active. The controlled build passed after stopping the dev server that shared `.next`; the preview was restored afterward. This supports build/dev contention or shared generated-state as a plausible prior factor, but does not prove the historical OOM's exact cause. No implementation or heap workaround was needed.
- **Browser evidence gap:** owner confirmed private sign-in, but the isolated browser's DevTools session exited and this host provided no functioning browser automation bridge. No authenticated Overview/BFF observation, four-cell EN/AR viewport checks, keyboard/focus review, overflow/zoom check, or visual integration PASS is claimed.
- **Security/boundary:** no API, database, BFF, session, origin, CSRF, credential, Portal, or cross-product source was changed. Changed paths are limited to `apps/oic-console/**` and the X1 project-state documents. Cross-product import and secret-pattern scans returned no matches; no environment file, `.next`, temp file, browser profile, or screenshot is staged. `git diff --check` passed. No X1.3 or OIC-6 work started. No commit or push is made because X1.2 GO gates are incomplete.
- **Performance sanity:** the instrument implementation uses local SVG/CSS and no chart/motion dependency. Static search found no per-instrument interval, animation-frame loop, or `ResizeObserver`; Overview has one drawer keyboard/focus effect.

## X1.2-R4 final micro-fit evidence (2026-10-05)

- **Rendered showcase:** Edge CDP screenshots captured the development Flight Deck at desktop and 390px narrow widths, in EN/LTR and AR/RTL. NOMINAL, DEGRADED, CRITICAL, MIXED and DORMANT were switched and captured. All four viewport/locale combinations retained every board section with no document horizontal overflow (`scrollWidth === clientWidth`).
- **Gauge fit:** radial readout boxes remain centered in their SVG zones; component captions render after the gauge graphic. The cognitive ArcMeter reserves an 88px graphic row; screenshot geometry measured the label below the SVG and state below the label. Service counts remain a 3×2 matrix, Intelligence Core remains a balanced 3×2 matrix, and Core Vitals retains its existing instrumentation.
- **Real Overview limitation:** the isolated review browser redirected `/` to the Operator sign-in page after the Console restart. No fresh authenticated post-fit capture of the real Overview or its dormant source signals is claimed. The owner-provided real Overview screenshot remains reference evidence but predates this pass. No credentials or browser session data were inspected or requested.
- **Validation:** Console typecheck, Console lint, all 26 configured Console tests, default-heap production build, `git diff --check`, development route HTTP 200, production 404 for both dev galleries, API live/readiness HTTP 200 and database `ok` passed. Production build was run without the dev server sharing `.next`; Console preview was restored afterward.
- **Artifacts/boundaries:** `.tmp-edge-profile/` is excluded by one exact local `.git/info/exclude` rule; `.dev-runtime/` and `.next/` remain ignored. No generated profile, screenshot, environment file, build output, Portal or Responix path is staged. Security/boundary scan found only expected UI copy and request parsing references, no credential values or cross-product imports.
- **Closeout:** no commit or push is made while the authenticated real Overview visual gate remains unverified. The shared production Overview and API/BFF contracts were not changed by the micro-fit pass.

## X1.2 owner acceptance and final closeout (2026-10-05)

- **Owner visual acceptance:** PASS. The owner manually reviewed the real Overview, development Flight Deck showcase, Instrument Gallery, top monitoring rack and all Fleet/DNA/Provider/Factory/Lab/Cognitive/Operations areas. This acceptance closes the visual gate; it does not rewrite the fact that automated authenticated real-Overview capture was **NOT AVAILABLE**.
- **Showcase visual matrix:** PASS from the completed screenshot and viewport checks: desktop and narrow, EN/LTR and AR/RTL, all five scenarios, no horizontal document overflow. Automated authenticated capture remains NOT AVAILABLE and is not relabelled as a pass.
- **Technical gates:** Console typecheck, lint, configured Console tests, default-heap production build, `git diff --check`, secret-pattern scan, OIC boundary scan, Console 3002 HTTP 200, API live/readiness HTTP 200 and database readiness `ok` passed.
- **Accepted Cosmetic Polish Debt:** micro-spacing, typography alignment, small instrument-label polish and local density refinements may remain. These are accepted non-blocking cosmetic debt and do not reopen X1.2; address later only as opportunistic polish or when a real bug is found. No new sprint is created.
- **Disposition:** X1.2 = GO / CLOSED by owner acceptance. Demo/browser/build artifacts are ignored and unstaged. OIC-only scope is confirmed. X1.3 and OIC-6 remain not started.

## X1.1 browser run record

- **Run date:** 2026-10-03. **Browser:** Microsoft Edge 154.0.4258.48. **Preview:** Console `http://localhost:3002`; API `http://127.0.0.1:4100`.
- **Locale/viewport matrix:** EN/LTR and AR/RTL at 1440×900 and 390×844. `document.documentElement.scrollWidth` stayed within the viewport; all six global navigation groups remained present. The narrow navigation scrolls inside its own bounded strip.
- **Route walk:** all 15 destinations rendered the expected page heading in EN/LTR desktop. Overview, Applications, Provider Factory, OIC Memory, Intelligence Workbench and Health & readiness rendered with the correct selected destination in each of the four matrix cells.
- **Authenticated data path:** `/api/session` reported authenticated; BFF snapshot and health each returned 200. Snapshot counts were 15 applications, 19 tenants, 13 principals, 12 connections, 19 upstream models, 7 model families and 60 audit rows. Health and database readiness were `ok`.
- **Keyboard:** command palette opened; ArrowDown moved focus to a result; Enter navigated and returned focus; Escape closed and returned focus.
- **Evidence limits:** no destructive or write workflow was run. No forced API failure/offline or screen-reader test was performed. No Console test/browser-runner script is configured.


## X1.2 V5 integration checkpoint ? owner review pending

- **Run date:** 2026-10-04. **Base:** `703e3f0`. X1.2 remains PARTIAL; no GO, commit, or push is claimed.
- **Integrated:** shared instrument renderers now cover the Overview System Core, dormant 13-dimension OIC-7 rack, standby inventory and lifecycle, DNARadar, provider-to-connection-to-catalog path, AssemblyPipeline, Lab, cognitive SensorBank, and API/database readiness in Live Operations. Cognitive categories not exposed by the current bounded execution API remain null with `NO_SOURCE_ADAPTER`.
- **Localization:** the runtime Arabic copy map was inspected as UTF-8 and a regression test now checks every Arabic map value for mojibake markers, with coverage for Flight Deck section/time strings and newly added cognitive copy. The locale button updates React locale state and the `lang`/`dir` attributes without a reload; a manual authenticated toggle observation remains part of owner review.
- **Focused evidence:** typecheck, lint, all 17 focused Console tests, and `git diff --check` passed. No production build or final browser matrix was run in this checkpoint.
- **Live services:** Console `http://localhost:3002/` and development gallery `/dev/instruments` returned 200. OIC API `http://127.0.0.1:4100/api/v1/health/live` and `/ready` returned 200; readiness was `ok` with database `ok`. Console PID 13092 and API PID 3944 remain listening.
- **Review gate:** owner visual inspection remains required for the authenticated Overview in EN/LTR and AR/RTL at desktop and narrow widths, including a live EN?AR?EN toggle and normal-zoom layout. No browser visual PASS is claimed. Do not close X1.2 until this checkpoint is reviewed and remaining closeout gates are run.

## X1.2 V9.2R3 final closeout

- **Run date:** 2026-10-05. **Branch:** `oic`. **Preview:** Console `http://localhost:3002`; OIC API `http://127.0.0.1:4100`.
- **Top control rack:** one `OIC CORE MONITORING RACK` with Service State / Intelligence Core / Core Vital Signs at 16.5% / 33% / 49.5% of the 1440px desktop board. DOM capture measured zones at 226px / 451px / 677px inside a 1370px rack. API and database rings plus six counts are compact; all six intelligence slots are 3x2; all 15 registered vital slots remain mounted.
- **Hero Core Load:** shared hero rail remains mounted in production as `UNMEASURED`, coverage `0/12`, with no production aggregate or inferred weights. Demo uses an explicit deterministic weighted composite; the energy contributor has an authoritative future source contract, W/kW/Wh/kWh units, and no token/cost inference. Inspector exposes coverage, source, freshness, maturity and contributors.
- **Visual evidence:** isolated Edge matrix captured and inspected desktop EN/LTR, desktop AR/RTL, 390px narrow EN/LTR and narrow AR/RTL. All five scenarios switched successfully. Document scroll width equalled viewport width in all cells; browser console had no errors. Nominal and dormant desktop captures plus lower-board capture were inspected; no clipping/collision was observed. Inspector opened and Escape closed it. The authenticated owner browser was left untouched and the live Console remained available; no cookies or session secrets were inspected. Real route and development showcase use the same `OverviewView`; a fresh authenticated pixel capture was unavailable in the isolated profile.
- **Live data path:** Console `/`, `/dev/instruments`, `/dev/flight-deck` returned 200 in development. OIC API health/live and health/ready returned 200; readiness reported database `ok`. The production build served `/` as 200 and both `/dev/flight-deck` and `/dev/instruments` as 404.
- **Validation:** all 25 Console tests pass; the focused Flight Deck suite passes 7/7; typecheck and ESLint pass; production build passes with default heap; `git diff --check` passes. Secret-pattern scan found no high-confidence matches; changed paths remain within `apps/oic-console/**` and X1 project-state docs. No auth, BFF, API, database, schema, origin, CSRF, Responix, or Portal implementation was changed.
- **Temporary state:** Generated Edge profiles, caches, screenshots and acceptance scripts remain untracked. The pre-existing `.tmp-edge-profile/` is preserved. The workspace safety review rejected exact-path removal commands, so cleanup is incomplete. No X1.3 or OIC-6 work started.
- **Status:** X1.2 closeout BLOCKED before commit/push. Validation passed, but temporary artifact cleanup and clean-worktree gates remain false; GO is not claimed.


## X1.3A interface systems architecture lock (2026-10-05)

- **Scope/result:** architecture and source audit only. No application/API/DB/Portal/Responix code or dependency changed; X1.3B implementation did not start. The production Overview, X1.2 instrument system and development-only Flight Deck showcase remain governed by their existing acceptance records.
- **Audit:** reviewed the Console package/dependencies, route and component structure, interaction primitives, BFF action/console routes, relevant OIC API controllers/contracts, and architecture/project-state documents. Confirmed the current code has partial client controls and bounded endpoint-specific operations, not a general command, permission-discovery, preview/impact, conditional-write, cancellation, rollback or event-stream API.
- **Architecture evidence:** docs 28–38 define the interface system, control contracts, actions, pickers, reactive configuration, workspace/inspector, state/permission behavior, development gallery, acceptance governance, extraction boundary and page adoption. Docs 01, 03, 04, 13, 14, 18, 20, 22–27 and DECISION_LOG link to the lock. The execution plan, tracker and matrix record X1.3A/B and the explicit future numbering transition; historical X1.1/X1.2 closeout labels remain intact.
- **Technology recommendation:** React Aria Components is recommended for X1.3B evaluation; no dependency was installed. Compatibility, bundle, transitive dependency, license, SSR and RTL verification remain X1.3B gates.
- **Validation:** documentation link/numbering/source-reference and scope checks, secret scan and git diff --check recorded at closeout. Console and OIC API remain on their required separate local ports; no app test/build was run because application code was not changed.
- **Disposition:** X1.3A = GO / CLOSED for architecture lock. X1.3B is the next return point and remains NOT STARTED; do not begin implementation without the next owner request.
