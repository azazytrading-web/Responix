# OIC Interface System

**Status:** Oi Operator Interface System v1.0 ACCEPTED / FROZEN by owner (2026-10-06). X1.3B closeout evidence is recorded in the acceptance matrix and implementation tracker. This baseline does not itself approve production-page adoption.

## Purpose and boundaries

The OIC Interface System is a typed, OIC-owned set of reusable controls and interaction patterns for the Console. The canonical implementation is `apps/oic-console/app/components/interface/**`; stable component imports use `apps/oic-console/app/components/interface/index.ts`, and the shared stylesheet entry is `apps/oic-console/app/components/interface/interface-system.css`. Tokens live in `foundation/tokens.css`. These source paths, not the gallery, are the authoritative implementation.

The gallery is a development reference, not a production workspace. Its page is force-dynamic and returns not-found outside `NODE_ENV === "development"`. Demo fixtures, sample profile values, thresholds and weights are confined to `apps/oic-console/app/dev/interface-system/demo-data.ts`. The production Overview, BFF snapshot, API, database and production navigation do not consume these fixtures. The shared component library contains interaction behavior and display contracts, not gallery demo values.

The library has no real production-page consumer yet; that is deferred to X1.4. The earlier X1.1 shell primitives under `app/components/oic-primitives.tsx` remain in current pages; they predate this library, are not gallery copies, and are not consumers of this Interface System. Migrating those page uses is part of X1.4 adoption rather than a visual-only X1.3B patch. X1.4 must replace or wrap overlapping legacy controls with canonical Interface components, preserving each supported workflow and source contract; it must not add a third implementation. Each future page must import canonical components and stylesheet, use source-backed OIC data, select supported props/variants, and compose domain layout around them. It must not copy control anatomy, keyboard/focus behavior, picker mechanics or permission/state machines into page-local code. Page composition owns grid placement, domain labels, data adapters and available workflows; the canonical component owns its geometry, semantics, behavior, and tokens. Existing authentication, origin validation, CSRF/session protections, BFF routing and machine credential boundaries are unchanged.

**Single source of truth. Controlled propagation.** Within this OIC monorepo, a canonical component or token update reaches all consumers that import it after rebuild/redeploy. Breaking prop changes require a backward-compatible path or an explicit migration. No cross-product package is extracted in X1.3B; future products receive deliberate, versioned releases and retain their own theme, typography, identity and domain adapters.

## Technology

- Next.js 15, React 19 and TypeScript, matching the existing OIC Console.
- React Aria Components 1.21.0 for accessible interaction primitives. The wrappers keep OIC-specific labels, permissions, direction, locale, density, semantic state and visual styling at the OIC layer.
- Local CSS and React components; no chart, graph, icon or animation package was added. The canonical CSS entrypoint and tokens are owned under `components/interface`; the development route imports that same stylesheet and supplies only route layout/fixture composition.
- `apps/oic-console/app/components/interface/index.ts` selectively re-exports the family barrels. The gallery is not exported as a product surface.

## Foundation and visual tokens

`foundation/tokens.css` scopes tokens to `.oi-interface-system`. The permanent semantic palette is:

- **Amber:** OIC intelligence and product identity.
- **Cyan/turquoise:** operator interaction and manipulable controls.
- **Green:** health and success.
- **Orange:** warning and elevated risk.
- **Red:** critical, danger and failure.
- **White/gray:** primary readouts and supporting information.
- **Graphite/smoke:** passive structure and inactive controls.

The Interface System background, global Console shell, Overview, Flight Deck, instrument components, OIC branding and architectural dividers retain their established amber identity. The cyan layer applies only to controls in the Interface System gallery and any future Interface System adoption that explicitly uses its scoped tokens. This separation lets telemetry read as machine output and cyan affordances read as operator input.

| Group | Tokens |
|---|---|
| Surfaces and borders | `--oi-surface-0` through `--oi-surface-3`, `--oi-line`, `--oi-line-strong` |
| Identity and semantic colors | `--oi-text`, `--oi-muted`, `--oi-dim`, `--oi-amber`, `--oi-amber-bright`, `--oi-green`, `--oi-orange`, `--oi-red`, `--oi-disabled` |
| Operator control family | `--oi-control-accent`, `--oi-control-accent-bright`, `--oi-control-accent-soft`, `--oi-control-accent-muted`, `--oi-control-accent-border`, `--oi-control-accent-glow`, `--oi-control-surface`, `--oi-control-surface-hover`, `--oi-control-track`, `--oi-control-track-active`, `--oi-control-thumb`, `--oi-control-focus`, `--oi-control-selection`, `--oi-control-inset` |
| Density and geometry | compact/standard/precision/large control, track and thumb sizes; `--oi-space-1` through `--oi-space-6`; `--oi-radius` |
| Motion and layering | `--oi-duration-fast`, `--oi-duration-standard`, `--oi-duration-slow`, `--oi-easing`, `--oi-layer-menu`, `--oi-layer-drawer` |

Control cyan is a tonal turquoise family, not a full-surface neon fill. Resting controls use graphite surfaces and subdued cyan cues; hover adds a restrained edge response; selected or engaged states gain a cyan inner plane and indicator; keyboard focus uses a high-contrast cyan outline with an offset halo. Pressed controls reduce bloom and indicate engagement with a stronger inner edge and slight depth compression. Reduced-motion preferences collapse transitions and animations to near-zero duration. Focus visibility, selected-state labels and semantic action colors remain distinct from color alone wherever the component already provides a textual or structural state. Toggle thumbs move from the inline start toward the inline end, including RTL.

Danger, warning and success actions preserve the same control geometry and interaction mechanics while overriding cyan with red, orange or green respectively. Passive controls use graphite. Primary and secondary button variants, sliders and fills, segmented rails, toggle rails and thumbs, numeric stepper assemblies, dials/knobs, picker triggers/options, selected chips, tabs, wizard progress and configuration composites use the control token family. Instrument readings and telemetry keep their semantic/instrument palette.

Gallery controls change density, desktop/narrow preview width, locale, direction, reduced-motion preference, anatomy visibility, and representative component states. The formal density options are Compact, Standard and Precision; Large remains a supported size for callers that already use it. Viewport breakpoints support small browser windows; the gallery preview also uses inline-size container queries so its narrow mode reflows according to the preview width even inside a desktop browser.

## Oi Operator Interface System v1.0 visual baseline

This is the visual contract for the interactive layer; it does not change the approved instrument system or global OIC amber identity.

- **Slider anatomy:** recessed graphite track, thin cyan active channel, solid circular cyan node, restrained calibration marks and explicit min/max labels. Precision controls may add a small center registration. While a thumb is dragged, its current value appears in a local readout above the node. Threshold meaning is expressed through separate semantic bands/markers; interaction remains cyan.
- **Power Capsule:** the switch uses an oval graphite housing, separate energy rail, pale circular control node and a state label. ON energizes the local rail in cyan while preserving the dark housing. Disabled/read-only states remain legible and distinguishable. High consequence remains an explicit armed/confirm flow; ARMED is not represented as ON.
- **Command anatomy:** primary, secondary, quiet, workspace and icon actions share a graphite housing and cyan interaction edge. Danger/warning/success keep red/orange/green semantics. Hold-to-confirm exposes local timed progress, cancels on early release or blur, and supports Space/Enter with reduced-motion handling.
- **Selector rail:** segmented choices share one recessed rail; the selected state uses a localized cyan marker and darker surface. Directional placement follows DOM direction.
- **Step unit:** increment/decrement zones sit inside a shared housing around a recessed numeric readout; the unit remains separate from the value.
- **Dial and precision knob:** a calibrated arc and center readout distinguish the rotary dial; the compact encoder-style knob uses the same control tokens while retaining fine adjustment and keyboard slider semantics.
- **Picker and capsules:** searchable picker options show entity labels and available metadata from caller-provided records. Selected options use a cyan edge. Multi-select retains dedicated removal affordances; no global search or backend discovery is implied.
- **Tabs and process bus:** workspace tabs use a shared baseline and active cyan marker. Wizard stages distinguish current (cyan), completed (green), future (graphite), warning (orange), and failed (red) based on supplied state.
- **Reactive configuration:** current, proposed and delta values remain explicit; consequence copy is labeled known, predicted/not measured, or unknown. A local demo does not imply persisted or measured outcomes.
- **Permission and availability:** denied, unsupported, unavailable, stale, conflict, read-only and disabled retain their explanatory text/structure. They are not collapsed into a color-only state.
- **Motion and focus:** micro-motion is local and finite; hold progress runs once. Reduced motion suppresses transitions and animations. Focus uses an offset cyan outline with visible contrast.
- **Anatomy mode:** the gallery-only Show anatomy control reveals labels for housing, active rail, node, calibration/readout/state, and command surface/edge/label/feedback. It is off by default and has no production component effect.
- **Responsive and locale contract:** the gallery supports Compact/Standard/Precision density and EN/AR with LTR/RTL, using the same component tree in desktop and narrow preview. Narrow layout is driven by the preview container width.

The gallery remains organized around eight panels (Controls, Commands, Selection, Configuration, Workspace, Feedback, States, Composites) with family subsections, rather than duplicating components into fourteen separate pages. All required control and behavior families are represented within those panels.

## Component inventory

| Family | Source | Coverage |
|---|---|---|
| Foundation | `foundation/types.ts`, `format.ts`, `tokens.css` | Shared locale/direction, semantic tone, permission, source and validation types; localized numeric formatting and scoped tokens. |
| Controls | `controls/sliders.tsx`, `numeric.tsx`, `choices.tsx`, `dials.tsx` | Scalar/range/precision/stepped/intensity/budget/weight/threshold sliders; numeric stepper and slider-input pairing; choice/segmented controls; rotary/fine-adjust dials. |
| Commands | `commands/actions.tsx` | Typed action button variants, command wrappers, keyboard command affordances, hold-to-confirm and action menu patterns. |
| Selection | `selection/pickers.tsx` | Searchable picker, multi-select, parent-scoped hierarchical selection and explicit loading/error/empty/stale announcements. |
| Workspace | `workspace/surfaces.tsx` | Workspace regions, inspector/drawer, compare and wizard surfaces with responsive structure. |
| Feedback | `feedback/feedback.tsx` | Inline status, action result and contextual feedback patterns. |
| State | `state/command-machine.ts`, `configuration.tsx` | Command lifecycle reducer; dirty configuration drafts; preview/apply/result/read-back verification; conflict retention/resolution; permission and conflict panels. These contracts do not imply that an API supports the corresponding mutation. |
| Composites | `composites/configuration.tsx` | Threshold band editor, budget/weight tuning, profile tuning, binding selection, apply/verify and impact/configuration composition. Demo profile values and revisions are passed in by the dev gallery. |

## Interaction and data contracts

- Components use controlled values and callbacks. They do not fetch data or call OIC endpoints.
- Controls distinguish allowed, read-only, denied, unsupported and unavailable permission states. A disabled visual state is not treated as authorization; the server remains authoritative for every future operation.
- Configuration drafts preserve proposed work through failed/unknown results and revision conflicts. An apply result is not a verified persisted state: a read-back step is required before marking a change verified.
- Local preview is labeled as local. No current gallery action mutates OIC data.
- High-consequence command components expose an explicit arm/confirm/cancel path. Keyboard access is built into their controls; manual focus and screen-reader review remains pending.
- Picker loading, error, no-results and stale states are announced rather than represented as an empty successful result.
- RTL direction is an explicit prop/DOM direction, not inferred from translated strings. Numeric and entity values should be bidi-isolated when adopted into real pages.

## Development gallery

The gallery route and its local composition live under `apps/oic-console/app/dev/interface-system/`:

- `page.tsx`: dynamic server route and development-only `notFound()` gate.
- `gallery.tsx`: shared-library specimens and local gallery controls.
- `messages.ts`: paired English and Arabic specimen copy.
- `demo-data.ts`: fixture values only for the gallery.
- The canonical `components/interface/interface-system.css` entrypoint supplies component anatomy, control states, density and shared responsive behavior; the route imports it directly. Gallery-specific layout remains represented by gallery classes in that stylesheet and does not define alternate controls.

Current gallery panels are ordered Controls, Commands, Selection, Configuration, Workspace, Feedback, States and Composites. The accepted owner baseline covers desktop/narrow, EN/AR, LTR/RTL, density, reduced motion, keyboard and representative states. Assistive technology review remains a future accessibility check for consuming pages. Final production build verification confirmed `/dev/interface-system` returns 404 outside development mode.

## Validation and adoption status

Owner visual acceptance is PASS, with minor spacing, typography, local proportion, picker/chip and motion-timing polish accepted as non-blocking debt. Source-of-truth audit records the canonical tree, barrel, stylesheet and token owners here. Both galleries consume canonical components; Instrument Gallery, production Overview and Flight Deck composition consume the instrument barrel. Production Overview has no Interface System consumer yet. Fixture modules remain under development routes and are excluded from production imports.

X1.4+ must consume the canonical public interface barrel and shared stylesheet (for example, `IntensitySlider`); if a reusable requirement is missing, extend the canonical contract rather than forking it. X1.3B freezes the v1.0 visual/interaction baseline. Future cross-product extraction is a separately approved, versioned milestone; Responix and Portal retain their own visual identities. See the X1 execution plan and acceptance matrix for validation and closure evidence. Manual assistive-technology review and future page acceptance remain specific to their later milestones.
