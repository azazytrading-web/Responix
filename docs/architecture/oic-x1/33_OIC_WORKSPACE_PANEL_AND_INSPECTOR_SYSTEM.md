# OIC Workspace, Panel and Inspector System

**Status:** DECIDED X1.3B contract. Current `PageFrame`, `WorkspaceFrame`, `CompareSurface`, `Drawer`, `InspectorPanel` and `WizardFrame` are client-side building blocks, not proof of complete adoption. Parent: [28](28_OIC_INTERFACE_SYSTEM_ARCHITECTURE.md).

## Workspace composition

A workspace composes global navigation, local navigation/context, a primary working region, scoped toolbar/filter/control groups, persistent action/result feedback, and optional side inspector. Small tasks remain inline; multi-step, relationship-heavy or high-consequence tasks use a progressive configuration flow. Keep one clear working region instead of boxing every control. Compact, standard and large density are semantic modes, not arbitrary font shrinking. Sticky controls preserve context without obscuring content/focus.

Supported panel patterns: Inspector Drawer, Side Inspector, Detail Panel, Configuration Sidecar, Comparison Panel, Split Workspace, Sticky Control Bar, Context Toolbar, Expandable Rack, Accordion/Disclosure, Tab Group, Workspace Tabs, Step Wizard, Progressive Configuration Flow, Before/After Diff, Revision Timeline, Entity Relationship Panel, Metric/Instrument Inspector, Command History Panel, Validation Panel, Empty/Error/Permission states. Each pattern is composed from shared primitives and owns a single focus scope.

## First-class Inspector

Opening an entity, instrument, control or result should normally preserve the parent workspace and selection. Inspector data may include summary; technical ID/version; source/freshness/status; application/tenant scope; dependencies/related entities; history where retained; measurements; configuration and semantic diff; supported actions and permission reason; and safe audit/request context. Omit unavailable fields honestly. Never show provider/session/recovery credentials, private prompts or hidden reasoning. An inspector is not a general data dump.

Selection of an inspector target may be deep-linked where useful and safe; route load re-fetches and re-authorizes. Close returns focus to invoker if still mounted, otherwise to a stable workspace heading. Escape closes the topmost non-destructive transient layer; it cannot silently discard a consequential dirty draft. Narrow screens convert side inspector to full-screen or stacked panel while preserving back-to-workspace context.

## Composite rules

- One modal/focus-trap owner at a time. A drawer may contain an inspector but not an independent competing modal.
- Menus/popovers close before route changes; wizard back preserves typed draft; step completion validates that step and the full configuration at review.
- Compare surfaces align matched fields and label missing/equivalent data; no false comparison of unlike scope, revision, unit or time window.
- Before/after diffs use explicit CURRENT and PROPOSED labels and isolate bidi-sensitive technical values.
- Action result and failure stay in the workspace shell so navigation cannot erase material feedback.
- Responsive collapse follows logical order; zoom/reflow and no document overflow are acceptance requirements.

## Current and planned

Current frame and drawer implementations are available, while a coherent inspector data contract, URL restoration, revision timeline and universal command history are planned compositions. Audit is server-owned; a local recent-action list must never be presented as audit history. See [state/permission](34_OIC_INTERFACE_STATE_PERMISSION_MACHINE.md), [gallery](35_OIC_INTERFACE_GALLERY_SPEC.md) and [acceptance](36_OIC_INTERFACE_ACCEPTANCE_GOVERNANCE.md).
