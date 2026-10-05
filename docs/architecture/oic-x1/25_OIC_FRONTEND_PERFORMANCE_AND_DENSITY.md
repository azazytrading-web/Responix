# OIC Frontend Performance and Density Architecture

**Status:** DECIDED strategy; numeric budgets require measurement. Flight Deck is X1-2 and must follow [telemetry](06_OIC_TELEMETRY_AND_INSTRUMENT_ARCHITECTURE.md), [live state](21_OIC_LIVE_STATE_AND_TEMPORAL_ARCHITECTURE.md), and [acceptance](27_OIC_VISUAL_ACCEPTANCE_GOVERNANCE.md).

## Budget method

Before setting numeric limits, capture a representative baseline in the supported browser and environment: payload sizes and endpoint count by workspace, request cadence, visible and total entity cardinality, React commit/render timings, long tasks, DOM node count, chart point count, retained client memory, subscription count, and CPU/network behavior with the tab visible and hidden. Record machine/browser/build, scope and dataset shape. Set per-workspace budgets from measured operator tasks and API capacity, then add regression checks/owner-visible evidence. Re-measure at 1, 5, 20 and 50+ active models and with provider/instrument growth. Do not advertise a hard target before this evidence exists.

## Acquisition, rendering and history

- Fetch bounded workspace aggregates through shared query/refresh cycles. Do not poll per gauge, model card or instrument. Coalesce identical scope/query requests; cancel obsolete reads safely; cap page sizes and defer deep telemetry until inspection.
- Normalize once and share immutable entity/metric state. Memoize stable rows/instruments and update only consumers whose source values changed. Keep expensive charts and secondary panels progressive/deferred.
- Window long lists only when measured DOM/render cost justifies it; retain accessible row/list semantics, focus, selection and announced position. Prefer pagination or grouping where it better explains scope.
- Render initial summary and primary action first. Lazy-load secondary history, technical inspectors and non-visible sections without hiding failures.
- Historical queries must be bounded by backend-supported range and sample count. Downsample timestamped data while preserving extrema, gaps and actual aggregation semantics; never invent continuity or smooth away incidents. Snapshot refreshes are not chart history.
- Use a single state subscription per page/source group where a real feed exists. Limit concurrent streams by documented server/client capacity; close/reduce nonessential work when hidden and reconcile on resume. Existing OIC Console has no telemetry subscription today.
- Avoid decorative animation as refresh. Animate only meaningful state change, respect reduced motion, and keep motion frequency below source update cadence. Reduced-motion mode removes nonessential transitions and continuously moving effects.

## Density and fleet scaling

| Active models | Presentation strategy |
|---|---|
| 1 | Full passport/selected model detail and source-backed instruments; avoid a large empty fleet grid. |
| 5 | Small comparison group with stable metric columns, labels and clear per-model state. |
| 20 | Search/filter, grouped sections and priority metrics; show a bounded initial set with progressive detail. |
| 50+ | Paginated/windowed inventory, scope filters and summary aggregates; preserve readable card/table size. Never shrink every instrument until labels or controls fail. |

Provider connections and metrics follow the same bounded grouping. New instruments attach to a shared metric acquisition result, not their own endpoint. The operator can find, compare and inspect entities without losing names, units, source, freshness or action state.

## Flight Deck acceptance

Benchmark the seven sections using realistic source-backed data, worst-case supported cardinality and sparse/unknown values. Measure network requests per refresh cycle, aggregate payload, rendering cost, browser responsiveness, DOM/window size, retained samples and active connections. Acceptance fails if a new widget creates an independent poll, fake live animation, unbounded history, or blocks the shell while deep telemetry loads. Performance never permits skipping scope checks, accessible labels, empty/error state, textual values or RTL-safe layout.

The X1.3B interface tests must also measure control-count rerender cost and large picker behavior before virtualization or observers are introduced. Keep state local to the changed control, debounce supported remote search, and virtualize only after real cardinality/profiling justifies it. Acceptance and measurement record are in [36](36_OIC_INTERFACE_ACCEPTANCE_GOVERNANCE.md); no speculative numeric budget is asserted.
