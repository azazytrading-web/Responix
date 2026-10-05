# OIC Interface Systems Gallery Specification

**Status:** target for X1.3B only. Preferred route: `/dev/interface-system`, matching existing `/dev/instruments` and `/dev/flight-deck`. Parent contracts: [28](28_OIC_INTERFACE_SYSTEM_ARCHITECTURE.md), [29–34](29_OIC_CONTROL_LIBRARY_CONTRACT.md).

## Governance and route

The server route is force-dynamic and calls `notFound()` unless `NODE_ENV === "development"`. It is not included in production navigation and does not use a client-only hide as its security boundary. Production acceptance starts the production server and proves 404. Keep OIC authentication, same-origin, CSP, origin, CSRF, session and BFF protections unchanged. Gallery fixtures are imported only under the development route/test code; no gallery state is routed into Overview, BFF snapshot, API, database, or production navigation.

Banner and page title remain visible in every scenario: **DEVELOPMENT REFERENCE · DEMO VALUES ONLY · NOT LIVE OIC TELEMETRY**. Label each interactive simulation and state its boundary. Apply simulation is local and visibly fictional; it never invokes `/api/action`.

## Design lab structure

Organize by system, not as a random component pile: `01 Controls`, `02 Commands`, `03 Selection`, `04 Configuration`, `05 Workspace`, `06 Feedback`, `07 State`, `08 Composite Patterns`. Each specimen has a concise contract panel: purpose/selection rule, props/state, keyboard, locale/direction, density, source status and known limitations. Support controls to choose component/family, scenario state, EN/AR, LTR/RTL, compact/standard/large, desktop/narrow, and reduced/normal motion. Provide responsive viewport inside the live Console, without a second fake design implementation.

## Required state matrix

Every applicable family is visibly demonstrated with: `DEFAULT`, `HOVER`, `FOCUS`, `ACTIVE`, `DIRTY`, `VALIDATING`, `VALID`, `INVALID`, `LOADING`, `APPLYING`, `SUCCESS`, `FAILED`, `PARTIAL`, `DENIED`, `READ_ONLY`, `DISABLED`, `UNAVAILABLE`, `NOT_CONFIGURED`, `CONFLICT`, `STALE`; additionally `ARMED`, `DESTRUCTIVE`, `UNKNOWN_RESULT` where semantically applicable. Distinct state controls must alter the real shared components, not static screenshot mocks.

## Interaction lab

Demonstrate slider and range changes; exact numeric entry; preset→custom→preset-match; constraint and weight-budget violation/recovery; scoped picker search/results/no-results/error/archived; local preview; review/apply simulation; success, failure, partial, denied, unknown-result reconciliation, stale revision/conflict comparison, and retained draft; workspace/inspector open/close/focus restoration; keyboard palette action routing; RTL and narrow reflow; reduced motion. Simulation labels persist through result states. “Applied” means only simulated in the gallery.

## Composite examples

Provide Profile Tuning Rack (capability ceiling), Provider Connection Setup, Model Binding Selector, Permission Scope Matrix (fixture only), Threshold Editor with instrument preview, Resource Budget Rack, Before/After Configuration Diff, Apply+Verify sequence, and Conflict Resolution Panel. Explicitly mark backend operations as current supported endpoint, client-only, future API, future telemetry, OIC-6/OIC-7 dependent, or unsupported. No production workflow may be invoked from these gallery composites.

## Gallery test and acceptance

Automate development rendering, component/state mapping, all gallery selectors, synthetic-data import boundary, native EN/AR strings, keyboard paths and development route gating. Owner reviews craft at desktop/narrow and all four EN/AR × LTR/RTL cells, normal/reduced motion. Build production and confirm 404. Gallery screenshot is not evidence of API, authorization, accessibility or production Overview behavior. See [36](36_OIC_INTERFACE_ACCEPTANCE_GOVERNANCE.md).
