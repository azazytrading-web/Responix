# OIC Control Library Contract

**Status:** DECIDED for X1.3B architecture; no new production controls are implemented by X1.3A. Parent: [28 Interface Systems](28_OIC_INTERFACE_SYSTEM_ARCHITECTURE.md). Shared state: [34](34_OIC_INTERFACE_STATE_PERMISSION_MACHINE.md).

## Common control contract

Controls receive typed props: stable `id`, localized accessible name/description, controlled value, domain bounds/step/options when justified, unit/formatter, density, `dir`, semantic state, permission/capability reason, validation messages, and callbacks that report **intent/change**, never presumed persistence. They do not fetch, authorize, mutate, or own server truth. `UNAVAILABLE`, `UNSUPPORTED`, `READ_ONLY`, `DENIED`, `NOT_CONFIGURED`, `DISABLED`, loading and invalid are distinct.

Numeric controls require defensible domain bounds, unit, precision, step, polarity/constraints, and an explicit source contract. If bounds are unknown, do not render a slider or invent limits; use a suitable text/stepper control or report unsupported. Local interaction is marked PREVIEW until saved/applied. Labels, value and units occupy protected space; thumb/ticks/markers cannot obscure them. Major/minor tick marks are sparse and semantic; default/recommended/warning/critical/persisted/draft/comparison markers appear only when sourced and differentiated in text/accessibility, not color alone.

## Taxonomy and selection rules

| Family | Semantics / when allowed |
|---|---|
| Scalar Slider | Continuous bounded scalar with useful spatial overview. |
| Precision Slider / Fine-adjust Dial | Bounded value needing coarse/fine precision; always offer exact value entry or accessible step keys. |
| Range Slider / Dual or Multi Range | Two or more ordered boundaries only when the domain meaning defines those relationships. Multi-range requires explicit per-thumb name and crossing/ordering rules. |
| Stepped Slider / Discrete Step Selector | Small or moderate ordered discrete domain with explicit options/labels. Use native select/radio group instead when discrete choice is clearer. |
| Intensity Slider | Capability ceiling with LOW/HIGH semantic label and explanatory “available when useful” language; never claim forced per-request usage. |
| Budget Slider / Resource Budget Controller | Bounded server-supported limit with unit and scope. Token/output limits exist for runtime input; other budgets are not implied. |
| Weight Slider / Weight Distribution Mixer | Interdependent weights only if a real policy schema defines components and a sum/normalization rule. Sum-100 mixer is PLANNED absent that schema. |
| Threshold Slider / Target Range Control / Threshold Band Editor | Explicit domain, polarity, ordered bands, units and boundary rules; exact inputs accompany visual editing. Semantic preview integrates with instrument scales only via a validated mapping. |
| Numeric Stepper / Increment-Decrement | Discrete ordered domain; step, min/max and wrap/no-wrap are explicit. |
| Numeric Input + Slider hybrid | Bounded domain needing overview and exact entry; both inputs share one validated draft. |
| Rotary Dial | Continuous tuning only where spatial circular adjustment adds meaning; not a novelty replacement for a conventional control. |
| Segmented Control | Small mutually exclusive modes (normally at most five short choices); not an entity picker. |
| Toggle / Switch | Genuine binary persisted or local state; label names the on/off meaning. Never use for archive, revoke, retire or other consequential lifecycle action. |
| Multi-state Switch | Small named semantic states with explicit keyboard model; otherwise choose select/radio. |
| Parameter Matrix | Related bounded parameters with explicit per-field units and cross-field constraints; use for dense expert configuration. |
| Resource Budget Controller | Composite view over independently typed, server-supported budget values; no speculative OICU/cost field. |

The list is a semantic taxonomy, not a mandate for visually identical widgets. Presets/custom semantics, constraints, and exact values are in the next sections.

## Value, range and RTL semantics

Logical minimum and maximum retain numeric/domain meaning in all locales. RTL may mirror the track’s visual direction if it improves reading, while `aria-valuemin`, `aria-valuemax`, values, target meaning and LOW→HIGH polarity remain unchanged. Arrow behavior follows the rendered affordance and documented platform convention; tests must prove the displayed value changes in the expected direction. Home/End select logical min/max; PageUp/PageDown use an explicitly documented larger increment. Range thumbs have separate names, announce values, and never cross unless the domain permits it.

Percent, duration, latency, token count, bytes, rate, cost and future OIU values use centralized formatters with locale-aware display, canonical machine units, precision rules and UTC/local timestamp distinction. Cost/OIU controls are not offered until API-owned fields and unit semantics exist.

## Simple/advanced mode, presets and dependencies

Simple mode offers meaningful, safe server-defined presets and common choices. Advanced mode exposes supported exact values and domain constraints; it must not invent complexity. Every preset has stable identity/version and a canonical configuration. The UI marks **PRESET MATCH** only when the full relevant canonical value set matches; any change becomes **CUSTOM**, and returning to exact values restores the match. Presets not returned by a supported source are client presentation defaults only and cannot be shown as applied server options.

Controls in one configuration group share a typed draft and constraint graph. Validate field, group, cross-field, sum, min/max, dependency and incompatibility rules immediately when deterministic client rules exist; server validation remains authoritative. For a sum-constrained mixer, show remaining/over budget as the user edits, enforce the documented bound or redistribution policy, support lock/reset only when specified, and retain exact values. No “108%” surprise deferred to submit.

## X1.3B family inventory

One coherent source layout: `app/components/interface/controls/{slider,range,number,dial,choice,toggle,matrix,budget,threshold}.tsx`, shared typed contracts/formatters in `controls/types.ts` and `controls/format.ts`, component-local style modules/tokens, unit/state/interaction tests adjacent under `test/interface/controls/`. Keep public exports named and selective; shared state machine and API mutation remain outside control components. Avoid a monolithic export file, duplicated slider math, per-page CSS overrides, stringly state, magic bounds and needless DOM measurement.

Acceptance for every family: valid/invalid/bounds/step; pointer and keyboard; accessible name/value/unit/state; visible focus; disabled vs read-only vs denied; preview vs persisted distinction; EN/AR and LTR/RTL without polarity reversal; narrow/zoom/reflow; reduced motion; server validation preservation and type safety. Detailed acceptance and gallery states are in [35](35_OIC_INTERFACE_GALLERY_SPEC.md) and [36](36_OIC_INTERFACE_ACCEPTANCE_GOVERNANCE.md).
