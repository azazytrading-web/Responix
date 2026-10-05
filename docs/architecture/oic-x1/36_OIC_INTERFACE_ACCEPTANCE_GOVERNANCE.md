# OIC Interface Acceptance Governance

**Status:** DECIDED acceptance contract for X1.3B. Parent: [28](28_OIC_INTERFACE_SYSTEM_ARCHITECTURE.md); general X1 evidence vocabulary: [20](20_OIC_ACCEPTANCE_ARCHITECTURE.md), [27](27_OIC_VISUAL_ACCEPTANCE_GOVERNANCE.md).

## Test layers

1. **Contract/unit:** prop types, bounds/units, semantic classification, formatters, thresholds, relationship and preset matching.
2. **State-machine:** draft/command transitions; unknown result; partial state; stale/conflict; permissions independent of lifecycle.
3. **Interaction:** pointer and keyboard semantics, selection, apply confirmation, Escape/focus restoration, failed action draft retention, menu/wizard behavior.
4. **Localization/RTL:** actual Arabic native copy, `lang`/`dir`, bidi code IDs, screen-reader values, slider/range numerical semantics, number/time format.
5. **Component integration:** controls inside real frames/drawers, validation summaries, command result persistence, instrumentation preview contract.
6. **Development gallery:** all families and states, controlled scenarios, no network/API side effect, visible demo marking.
7. **Production route gate:** production `/dev/interface-system`, `/dev/instruments`, `/dev/flight-deck` return 404; none is linked from production navigation.
8. **Visual acceptance:** reproducible headless capture where configured plus owner review of actual running Console.

Current Console has a Node test script and no configured browser runner in `apps/oic-console/package.json`; do not claim browser automation exists. X1.3B should first use existing Node/React-supported test infrastructure where practical and add a browser runner only after a measured need, dependency review and explicit install decision. Component interaction tests are required; screenshot snapshots alone are insufficient. No fabricated browser evidence.

## Required matrix

Every changed family covers desktop EN/LTR, desktop AR/RTL, narrow EN/LTR and narrow AR/RTL, with normal and reduced motion. Exercise semantics, default/active/hover/focus, disabled/read-only/denied, loading/empty/error/stale, keyboard, zoom/reflow, focus, validation and source truth. There must be no document horizontal overflow, clipped control, label collision, color-only state, dead click or lost focus. Responsive checks use the real Console design system at representative bounds; document dimensions/browser/version and evidence.

Every command/reactive path distinguishes preview, applied and verified. Apply failure retains draft; conflict preserves local work; inaccessible action exposes a safe reason; ambiguous network outcome reconciles before any retry. An applied state without readback is never verified. Security checks prove UI affordance does not authorize, BFF allowlist/session/origin/CSRF protections remain, API checks scope, no secrets enter browser output, no gallery fixture reaches production and no local fake audit trail is shown.

## Performance and scaling

Use controlled React state near the changed control; avoid global page rerender on every pointer tick. Batch source reads; lazy-load technical inspector/history and non-visible heavy surfaces without hiding failure. No per-control `ResizeObserver`, interval, animation-frame loop or decorative DOM flood absent measured need. Debounce remote search and use server query/page contract. Virtualize only when real cardinality and profiling justify it; preserve listbox semantics, focus and result count. No universal size budget without measurement: baseline bundle, render latency, DOM count and memory for representative control/picker counts, then record threshold and delta.

## Browser acceptance and owner gate

Automated component/interaction checks and production-route checks are required; browser automation is supplementary, not the sole acceptance gate. If browser runner is unavailable, record that truthfully, use HTTP/build and test evidence, keep preview live, and request owner visual acceptance as the final visual gate. Do not claim screenshot or human verification that did not occur. The owner’s accept/reject applies to a named committed visual baseline; cosmetic debt is recorded separately.

## X1.3B closeout order

Finish each bounded stage; run focused tests; conduct owner visual review; run serial typecheck/lint/tests/build; run `git diff --check`, secret and product-boundary scans; review full staged diff and excluded artifacts; commit OIC-only; push normally to `origin/oic`; verify commit/ref and clean tracked worktree. Stop for owner review after closeout; do not automatically start the next product milestone.
