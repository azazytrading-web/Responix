# OIC Acceptance Architecture

Every milestone is accepted independently across backend, database, API, frontend, English UX, Arabic UX, LTR, RTL, integration, human-visible workflow, local preview/deployment and security. A server unit test cannot prove a human workflow; a screenshot cannot prove scope enforcement.

## Status vocabulary

`PASS` verified with recorded evidence; `PARTIAL` some rows pass and named gaps remain; `NOT STARTED` no evidence; `BLOCKED` a concrete dependency prevents evaluation; `BASELINE-PREEXISTING` known before this milestone; `UNCHANGED` intentionally not changed and regression not implied; `N/A` documented reason why inapplicable. Never use PASS for intent or an unobserved browser state.

## Browser and behavior matrix

| Layout | Required locale/direction |
|---|---|
| Desktop | EN/LTR; AR/RTL |
| Narrow | EN/LTR; AR/RTL |

For each changed page verify default, entity selection, action confirmation/result, empty, loading, error, offline/unavailable, live or idle as applicable, keyboard, focus, zoom/reflow, translated labels, code/ID direction, responsive inspector, and permission-denied path. Record viewport, browser/version, seed/source and screenshots/evidence without credentials.

Also cover LIVE versus STALE, OFFLINE/RECONNECTING, PARTIAL SUCCESS, PERMISSION DENIED, unsaved DIRTY state, server revision conflict, recovery/reconciliation, unknown future metric, unknown instrument hint, INSUFFICIENT_DATA, and NOT_CONFIGURED wherever applicable. Never require a future backend capability merely to pass a current milestone; verify its honest unsupported/unavailable fallback instead. X1-2 Flight Deck performance acceptance measures endpoint count/batching, bounded data and history, render/DOM/memory behavior, hidden-tab behavior and 1/5/20/50+ model density under [performance architecture](25_OIC_FRONTEND_PERFORMANCE_AND_DENSITY.md); no numeric target is accepted without measurement. Detailed visual evidence and stress outcomes are in [visual acceptance governance](27_OIC_VISUAL_ACCEPTANCE_GOVERNANCE.md).

## Gates

Functional: API-confirmed paths, transitions, scope and persistence. Visual: alignment, density, hierarchy and all four browser combinations. Accessibility: semantic controls, keyboard, focus, contrast, reduced motion and screen-reader labels. Security: BFF session, same-origin/CSRF, machine credential separation, scope isolation, no secret browser exposure. Performance: bounded payloads, no unbounded polling/history, page responsiveness on representative entity counts. Product boundary: OIC-only files/runtime/database and explicit API contracts.

Current repo scripts: API typecheck/lint/build plus selected Node test suite; Console typecheck/lint/build but no Console test script or declared Playwright/browser runner. Any workspace-level testing libraries are not a Console browser acceptance tool. Browser evidence must name the external/manual/explicit runner actually used. Keep API `127.0.0.1:4100` and Console `localhost:3002` in separate persistent terminals during owner review.

## Evidence by acceptance dimension

| Dimension | Automated evidence | Human-visible evidence |
|---|---|---|
| Structural | Typecheck/lint/build; DOM landmark/heading checks where frontend test runner exists; source/path inventory | Inspect shell hierarchy and page organization |
| Functional | API/controller/unit/acceptance tests; BFF route/action tests; persisted read-back | Complete operator task and confirm result, scope and recovery |
| Visual | Screenshot regression only if configured and reproducible | Review all four locale/direction/viewport cells at real browser zoom; compare density/contrast/hierarchy |
| Interaction | Keyboard/component tests and server action assertions | Tab/arrow/Escape/focus restoration, picker, drawer, wizard and error recovery |
| Localization / RTL | Locale key coverage and static bidi safeguards where possible | Native Arabic terminology, alignment, mixed text and numeric order |
| Accessibility | Semantic/axe or equivalent when configured; reduced-motion/contrast token checks | Screen-reader label/status and keyboard focus spot check |
| Responsive | CSS/build checks and viewport automation if configured | Desktop+narrow overflow, inspector movement, zoom/reflow |
| Security | API guard, same-origin, session, scope, secret-filter tests; bundle scanning | Verify browser network/payload has no machine/provider secret and denial is visible |
| Performance | Bounded API/payload test; build bundle report when available; representative list profiling | Observe interaction delay at representative real entity count |
| Product boundary | Changed-path check, import scan, schema/database env guard | Confirm no foreign product UI/runtime/state appears |
| Human workflow | Contract tests cover transitions but not comprehension | Operator completes normal and failure path without raw IDs/password sharing |

PASS requires linked, reproducible evidence for the relevant row. For browser-only claims record browser/version, viewport, locale/direction, account role label (no credential), source fixture or sanitized real data, timestamp and artifact path. Screenshot with fake/example telemetry cannot prove data correctness. API logs without browser evidence cannot prove visible UX.

## Automated vs human gates and closure

Automate: schema/DTO validation, auth/scope denial, BFF mapping, persistence/read-back, missing/null/zero distinction, locale key presence, build/type/lint, static boundary scan, reduced-motion stylesheet presence, API health and deployment startup. Human browser review: information hierarchy, Arabic terminology, visual density, directionality, focus behavior, real workflow comprehension, and owner-visible preview.

Milestone closure sequence: `IMPLEMENT → FOCUSED CHECKS → HUMAN REVIEW → FINAL SERIAL VALIDATION → DIFF REVIEW → COMMIT → PUSH`. Each gate records commit base, changed paths, test commands/results, browser matrix evidence, security/product-boundary evidence, known gaps and reviewer. A failed gate returns to the owning milestone; no commit/push is implied by X1.0B. Never run heavy unrelated suites for docs-only work.

For X1.3B, use the layered contract/state/interaction/RTL/gallery/production-404/component integration tests and truthful browser/owner evidence defined in [36](36_OIC_INTERFACE_ACCEPTANCE_GOVERNANCE.md). A browser runner is not currently configured for the Console; do not fabricate browser evidence or make fragile automation the sole human gate.
