# OIC Visual Acceptance Governance

**Status:** DECIDED evidence contract for every frontend milestone. No visual result passes on the phrase “looks good.” Functional correctness, security and accessibility outrank cosmetic similarity. Read with [localization/RTL](15_OIC_LOCALIZATION_RTL_ACCESSIBILITY.md), [performance](25_OIC_FRONTEND_PERFORMANCE_AND_DENSITY.md), and [acceptance architecture](20_OIC_ACCEPTANCE_ARCHITECTURE.md).

## Review dimensions

Review and record: identity fidelity; black/amber identity; semantic color discipline; precision-neon restraint; typography hierarchy; spacing; alignment; information density; instrument legibility; interaction clarity; loading/empty/fault/stale/permission state distinction; motion discipline; responsive behavior; RTL geometry; Arabic typography and bidi; global overflow; focus, keyboard, contrast, zoom and accessible names. Screenshots support visual comparison but cannot establish function, permission, accessibility or source truth.

## Evidence for each frontend milestone

1. Name milestone, commit/build, date, owner, browser and version, API build/source, test account role (never credential), locale, direction, viewport width/height as actually measured, zoom and data scenario.
2. Capture the same principal task before/after when an existing comparable surface exists. Keep viewport, browser, locale, direction and data shape matched; explain unavoidable differences.
3. Capture entry/default, a primary interaction, and representative loading, empty, unavailable/error, stale/partial and denied states when the milestone owns them. Include keyboard/focus evidence and a functional readback for mutations.
4. Review the four required matrix cells: desktop EN/LTR, desktop AR/RTL, narrow EN/LTR, and narrow AR/RTL. These are the supported acceptance pair at two layout classes; do not invent EN/RTL or AR/LTR modes. Verify locale and document direction are explicitly configured rather than inferred from browser locale.
5. Record issues by dimension and severity, identify blockers, attach stable screenshot/browser evidence, and mark PASS/PARTIAL/FAIL with rationale. A screenshot without browser/build/config metadata is not reproducible evidence.

## Viewports and gate precedence

Use dimensions from the supported browser/VS Code preview and actual acceptance setup, recording exact width and height in the evidence. Existing OIC-5 ledger records authenticated Chrome checks at 1440px desktop and 390px narrow; these are existing evidence points, not a claim of full X1 coverage or mandatory device presets. Do not invent marketing viewport sizes. X1-1 still requires its own authenticated acceptance evidence against the current build. For every changed page test at least the existing desktop and narrow widths, and add intermediate widths when layout breakpoints or overflow warrant it.

Visual PASS requires no unexplained hierarchy/alignment/overflow/state-regression issue, but a cosmetic pass cannot override broken API behavior, scope, keyboard operation, accessible state, localization or readability. Data must remain source-backed. Captures must not expose credentials or sensitive customer payloads; use approved safe fixtures and redact only in a way that preserves the behavior under review.

## Architecture stress test

| Case | Contract answer / remaining dependency |
|---|---|
| A — 1 to 40 active models | Group, search/filter and page/window inventory; keep readable size and shared acquisition. Benchmark 1/5/20/50+ before numeric performance budgets. |
| B — 30 new metrics in OIC-7 | Versioned registry definitions, grouped acquisition and progressive rendering. Unknown metrics use semantic generic rendering only when unit/type are safe; else unsupported state. |
| C — new visualization type | Unknown hint falls back only to a meaning-preserving accessible representation; otherwise explicit unsupported state. Plugin trust/install lifecycle remains deferred. |
| D — provider degrades while Model Factory open | Current Console has no global event feed; next supported refresh/read shows timestamped state. Future invalidation/feed must be scoped, batched and reconciled; do not promise instant update today. |
| E — source stops, last value exists | Retain value/time, transition to AGING/STALE under source-owned threshold; do not call it live or replace with zero. |
| F — profile save succeeds, one downstream refresh fails | Show mutation APPLIED and refresh PARTIAL separately; reconcile/read-retry failed source. No implicit rollback. |
| G — two tabs edit same revision | Preserve local draft and compare to server revision after conflict; no silent overwrite. Current API lacks generic conditional writes; expected-version enforcement is a prerequisite for consequential mutable editors. |
| H — operator can view but not mutate | Distinguish READ_ONLY/ACTIONABLE/NOT_AUTHORIZED; API 403 remains final. No hidden UI inference or permission leak. |
| I — Arabic/RTL narrow dense fleet | Group/list/paginate rather than shrink; test native Arabic and bidi IDs/numbers, logical layout and measured supported narrow viewport. Existing 390px is reference evidence, not sufficient alone. |
| J — Workbench moves through safe cognitive states | Current persisted execution/stage reads are historical; Native runtime SSE streams response content, not safe Console stage state. Live progress requires a separate redacted semantic event contract. |
| K — OIC-7 adds DNA dimensions | Version/additive dimensions and render unknown values in accessible table/list. Compare/radar only when evaluator, range and cohort are compatible. |
| L — history unavailable, live snapshot available | Keep current snapshot available and mark historical controls/series unavailable or partial. No interpolated history from snapshots. |

Any newly discovered gap is recorded as PARTIAL with owner and prerequisite; it is not covered by a visual approximation.
