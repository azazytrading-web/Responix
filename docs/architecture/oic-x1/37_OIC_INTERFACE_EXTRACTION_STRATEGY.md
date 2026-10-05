# OIC Interface Systems Extraction Strategy

**Status:** extraction-ready architecture only; **NOT EXTRACTED**. No cross-product package, Portal change or Responix change is part of X1.3A or X1.3B. Parent: [28](28_OIC_INTERFACE_SYSTEM_ARCHITECTURE.md); product boundary: [16](16_OIC_SECURITY_AND_PRODUCT_BOUNDARIES.md).

## Current ownership

Oi Interface Systems implementation remains under `apps/oic-console/app/components/interface/`. It depends on the OIC visual skin and OIC-specific page adapters at the application composition boundary. Do not move OIC Instrument Library from OIC or create a Portal gallery now. The future Mega Platform concept is separate: **Mega Platform → Engineering Resources / Design Systems → Oi Interface Systems and Oi Instrumentation System**. That requires its own Mega Platform sprint and owner authorization; this architecture pass must not modify Portal.

## Neutral versus product-owned boundary

| Potentially neutral after validation | Always product-owned unless a later architecture explicitly changes it |
|---|---|
| Typed control props, primitive state transitions, focus/keyboard/ARIA mechanics, selection mechanics, validation wiring, nonvisual density contract, dialog/popover mechanics, generic result/retry affordances. | Black/amber or other theme tokens, typography, iconography, copy/localization defaults, domain units/scales, OIC record/API/BFF adapter, tenant/application scope semantics, lifecycle/consequence rules, permission derivation, audit and telemetry meaning, OIC-specific presets and configuration policy. |

State machine helpers are not allowed to encode OIC domain statuses as a supposedly neutral package API. Shared code consumes consumer-supplied typed states/reasons and rendering adapters. A cross-product consumer must not gain access to another product’s server records or credentials through a shared component.

## Extraction decision gate

Only propose a package after X1.3B has a tested stable public API, at least one real OIC adoption path, documented accessibility/RTL behavior, isolated OIC skin adapter, dependency/license/security review, bundle and maintenance evidence, and a second authorized consumer with an independent theme/data adapter. Then define package ownership, semver, support policy, build/test pipeline, dependency direction and migration. Until then keep code OIC-local and avoid speculative abstractions. Extraction must be separable without redesign, but no shared package is built in this work.

## Technology choice in this phase

X1.3B’s recommended behavior foundation is **React Aria Components**, styled entirely by OIC. React Aria Components is not installed in this workspace now. X1.3B must pin a compatible version, review bundle/transitive dependencies/licenses and prove Next/React 19 + RTL compatibility before adding it. Use OIC-owned typed wrappers and native React/CSS/SVG for domain composites. See the evidence-based comparison in [36 acceptance](36_OIC_INTERFACE_ACCEPTANCE_GOVERNANCE.md) and the adoption plan in [38](38_OIC_PAGE_CONTROL_ADOPTION_MATRIX.md).

### Source audit and alternatives

The audited Console is Next 15 / React 19 with TypeScript, CSS and SVG; its package has no dedicated accessible interaction library or browser-test runner. Existing OIC primitives cover a useful subset, but controls still have inconsistent keyboard/focus/validation behavior and the selection/search surfaces are not one system. The choice below is a recommendation for X1.3B implementation review, not a dependency added by this architecture lock.

| Candidate | Strength for this system | Limitation / disposition |
|---|---|---|
| Native React, CSS and SVG | No dependency; maximum fit with OIC visual and instrument language. Keep for domain composites and bespoke visualizations. | Does not itself supply consistent collection, focus, keyboard, labeling, overlay and assistive-technology behavior across the full control set. Not sufficient as the only interaction foundation. |
| **React Aria Components** | Unstyled composable component layer, with accessible form controls, selection/collection widgets, overlays, focus behavior, locale and direction support. Slider supports controlled values and multiple thumbs. Strong match for OIC wrappers plus CSS skin. **Recommended for X1.3B evaluation.** | Confirm React 19 / Next 15 compatibility, bundle and transitive dependency cost, SSR/hydration, required RTL behavior and exact public API at the pinned version before adoption. |
| Radix Primitives | Strong composable primitives and explicit RTL support; useful overlay/select foundations. | Would still require more OIC-owned form/collection behavior and shared wrappers to reach the required system coverage. Keep as a comparison candidate, not the default. |
| Ariakit | Headless patterns for menus, comboboxes, dialogs and composite widgets. | Validate breadth and maintenance fit for OIC’s complete control contract; no clear advantage over the broader recommended wrapper foundation in this phase. |
| Floating UI | Fine-grained popover, tooltip and menu positioning. | Positioning layer, not a form/selection/control system; can be evaluated only if the selected overlay implementation needs it. |
| `cmdk` / current custom command palette | Focused command-menu interaction model. | Covers command search/navigation, not sliders, forms, entity selection, dialogs or configuration workspaces. Preserve the command palette as a specialized surface. |

Official primary references reviewed 2026-10-05: [React Aria Components](https://react-aria.adobe.com/), [Slider](https://react-aria.adobe.com/Slider), [ComboBox](https://react-aria.adobe.com/ComboBox), [locale and direction](https://react-aria.adobe.com/internationalization), [Radix Primitives](https://www.radix-ui.com/primitives), [Radix RTL](https://www.radix-ui.com/primitives/docs/overview/accessibility#right-to-left), [Ariakit](https://ariakit.org/), and [Floating UI](https://floating-ui.com/). Recheck versions and framework compatibility in X1.3B; these links document the comparison, not a promise of unverified compatibility.
