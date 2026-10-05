# OIC Interface Systems Architecture

**Version:** Oi Interface Systems 1.0 / X1.3A. **Status:** architecture contract locked by X1.3A closeout. **Owner:** OIC Console. **Implementation:** X1.3B, not this packet. **Product principle:** Independent by design. Unified by default. Separable without redesign.

This companion architecture extends, and does not replace, the OIC-X1 Architecture Lock 1.0. Existing completed milestones X1.1 and X1.2 keep their identifiers and accepted baselines. X1.3A defines the architecture; X1.3B implements and accepts the Oi Interface Systems library. The future page modernization sequence is explicitly renumbered after that foundation in [the execution plan](../../project-state/OIC_X1_EXECUTION_PLAN.md).

## Mission and operating loop

OIC is an **intelligence engineering environment**, not a CRUD admin dashboard. Its human control surface supports **SEE → UNDERSTAND → CHANGE → PREVIEW EFFECT → APPLY → OBSERVE → VERIFY**. Manual text entry is an expert/fallback path when a meaningful control or known-entity picker is unavailable. The interface feels intelligent through domain context, source-backed state, consequence explanation and preserved operator intent; it does not manufacture AI commentary.

The permanent live-development topology is separate persistent processes: API at `127.0.0.1:4100`, Console at `localhost:3002`, and a third terminal for checks/Git. Keep the owner-visible Console open in VS Code. Never print credentials or interrupt a live process without recording why, restarting it, and rechecking it.

## Source audit and capability truth (2026-10-05)

Audited `apps/oic-console/package.json`, `app/**`, components, features, `i18n.ts`, styles, BFF routes, and relevant OIC controllers/DTO validators. Also reviewed architecture 01, 03, 04, 13, 14, 18, 20, 22–27 and `DECISION_LOG.md`. Source findings are constraints, not a claim that all present controls are adopted consistently.

| Evidence class | Current finding | Architecture consequence |
|---|---|---|
| CURRENT — client only | Console has `Button`, `SearchableSelect`/`EntityPicker`, `Slider`, `RangeSlider`, `Drawer`, `InspectorPanel`, `WizardFrame`, empty/loading/error/feedback and insight primitives; `PageFrame`, `WorkspaceFrame`, `CompareSurface`, local filters and a Ctrl/Cmd+K palette exist. Slider/RangeSlider are used for profile values; EntityPicker is used in Runtime. These are not a complete uniform control platform. | X1.3B audits/reuses behaviors and migrates coherently; local previews are explicitly labeled and never persisted by themselves. Existing client state is not backend capability. |
| CURRENT — API + BFF | Same-origin session BFF, fixed read-view allowlist and explicit mutation-action allowlist; Console snapshot; provider and catalog operations including a catalog preview endpoint; model family/edition/revision/variant/binding/visibility operations; profile create/clone/revision/lifecycle; memory and knowledge search/read/write; executions/traces; health/readiness; server validation, scopes, and audit/correlation on selected operations. | Use only action-specific payloads, permission scopes and source readbacks. Existence of one preview endpoint does not imply a generic impact simulator. |
| CURRENT — server mutation | API validates resource-specific DTOs, authenticates its machine principal, enforces scopes and application/tenant boundaries, and emits request/trace/audit evidence where implemented. BFF uses same-origin and human session checks, fixed routes, server-only credentials, and input bounds. | UI gating is explanatory only. API remains final authority; keep BFF boundary and security protections unchanged. |
| PLANNED — client/system | Unified semantic controls, typed drafts, preset-match tracking, cross-field constraints, normalized permission affordances, common state machines, coherent panels/inspectors, controlled deep-link state and the development gallery. | X1.3B; no page redesign in X1.3A. |
| PLANNED — future API | General conditional revision/ETag enforcement across mutation families; generic capability descriptor; broad server-side entity search; normalized action/event feed; generic configuration impact preview; transaction/undo/rollback; universal command cancellation/progress. | Do not imply these exist. Use per-endpoint contracts and honest unavailable/unknown states. |
| PLANNED — future telemetry | Continuously refreshed operational values, retained history, measured impact/cost/latency deltas, OIC-7 evaluation values. | OIC telemetry/OIC-7 prerequisites; a control setting is never a measured outcome. |
| PLANNED — OIC-6 | Future engine/runtime capabilities and their authoritative contracts. | Show as unsupported/unavailable until an OIC-6 source contract exists. |
| PLANNED — OIC-7 | Evaluator methodology, provenance, cohort/denominator, confidence and versioned measured DNA. | No score derived from configured profile values. |
| UNSUPPORTED | Universal rollback, generic optimistic mutation, permission discovery for a human role, fake local audit history, ungrounded prediction or an unrestricted API pass-through. | Never present as available; use existing domain action or an explicit unsupported state. |

### Five systems, one operator platform

1. **Oi Control System** — typed, semantic inputs and bounded configuration families; see [29](29_OIC_CONTROL_LIBRARY_CONTRACT.md).
2. **Oi Command System** — consequence-aware actions, command states and result feedback; see [30](30_OIC_COMMAND_AND_ACTION_SYSTEM.md).
3. **Oi Selection & Configuration System** — scoped search, entity relationship choice and configuration selectors; see [31](31_OIC_SELECTION_AND_PICKER_SYSTEM.md).
4. **Oi Workspace & Panel System** — work regions, inspectors, panels and progressive tasks; see [33](33_OIC_WORKSPACE_PANEL_AND_INSPECTOR_SYSTEM.md).
5. **Oi Reactive Interaction System** — draft, preview, apply, observe and verify semantics; see [32](32_OIC_REACTIVE_CONFIGURATION_SYSTEM.md).

Their common states and ownership rules are defined in [34](34_OIC_INTERFACE_STATE_PERMISSION_MACHINE.md); adoption is mapped in [38](38_OIC_PAGE_CONTROL_ADOPTION_MATRIX.md).

## Neutral mechanics and OIC identity

The future neutral layer owns typed primitive APIs, input/selection mechanics, focus and keyboard behavior, interaction state transitions, validation plumbing, overlay mechanics, density-independent layout behavior, and accessibility contracts. It must not import OIC API paths, OIC records, lifecycle rules, copy or styles.

OIC owns the black/near-black surfaces, white information, controlled amber intelligence accent, restrained illumination, semantic green (health/ready/success/safe), amber (attention/warning/elevated), red (fault/critical/destructive/error), OIC typography/tokens, Arabic product copy, domain units and semantics, API/BFF adapters, scopes, lifecycle, and component composition. No mint-green surfaces, generic SaaS blue, cheap neon, gaming treatment, Matrix clichés or consumer gradient-heavy styling. Preserve the premium aerospace/intelligence-engineering/advanced industrial-control identity. See [03 visual system](03_OIC_VISUAL_DESIGN_SYSTEM.md).

## Platform-wide invariants

- Persisted state belongs to the server. Selection, open panels, search text, typed draft and explicitly labeled local previews belong to the client until a supported command succeeds.
- Configuration values describe settings/capability ceilings. They are not quality scores, runtime utilization, or guaranteed per-request behavior. Intelligence intensity 100 does not mean every request uses maximum compute.
- Distinguish predicted from measured, preview from persisted, and applied from verified. If no source can compute impact, say **IMPACT NOT YET MEASURED** or **EFFECT UNKNOWN**.
- A human session, server-side machine credential, API scopes and application/tenant grant are separate boundaries. Never expose machine/provider/session/recovery secrets to components or URLs.
- Existing instruments remain a distinct frozen system. Controls can update their local preview only where the mapping is explicit and valid; configuration weights do not create DNA measurements.
- Dense engineering information is allowed; readable labels, visible focus, stable geometry, responsive reflow, accessible names and non-color states are not optional.

## Companion contracts

The 28–38 documents divide implementation detail by one coherent system each: architecture (28), controls (29), commands (30), selectors (31), reactive configuration (32), workspace/panels (33), shared state and permission machine (34), development gallery (35), acceptance (36), extraction (37), and page adoption (38). Normative semantics live once in the closest contract and other documents link to it.

## X1.3B implementation sequence and gate

Implement one milestone in bounded reviewed stages, in this exact dependency order: **foundation/tokens → primitive behavior layer → controls → commands → selection → workspace surfaces → reactive state components → composite patterns → development gallery → accessibility verification → localization/RTL verification → owner visual acceptance → serial focused validation/build → full diff/boundary review → commit/push**. The stage gates and component grouping are specified in [38](38_OIC_PAGE_CONTROL_ADOPTION_MATRIX.md#x13b-bounded-build-sequence) and [36](36_OIC_INTERFACE_ACCEPTANCE_GOVERNANCE.md). Each stage leaves the dev route and live services usable. No implementation begins until the owner authorizes X1.3B.
