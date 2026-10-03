# OIC Frontend Technology Stack and Visualization Strategy

## Audited stack

**CURRENT (repository):** pnpm workspace; `@oic/console` is Next.js 15 (the installed build reported 15.5.21), React/React DOM 19, TypeScript 5.7 range. Next App Router serves a single dynamic page whose client `ConsoleApp` switches `View` state. API routes implement the BFF. Styling is custom global CSS in `app/styles.css`; no Console-declared UI, icon, chart, graph, or animation dependency. Existing UI dependencies are only Next/React/React DOM. Existing icons are CSS/text glyphs; existing design components are local React/CSS. `pnpm-lock.yaml` contains packages for other workspace consumers; that is not evidence they are approved/installed in the Console. Console has `lint`, `typecheck`, `build`, `dev`, `start`; no test script or declared browser runner. API uses NestJS 11, TypeScript, Zod, Prisma via `@oic/database`; API tests use Node's test runner after build.

**CURRENT:** locale dictionaries are `en`/`ar`; locale cookie `oic_locale` sets document `lang`/`dir`; CSS has logical properties and some RTL selectors. Coverage is mixed and requires page-by-page completion. No Canvas/chart runtime exists. Native SVG/CSS can serve bounded, accessible local instruments without dependency. Keep server secrets/API calls inside server/BFF boundaries.

## Strategy by visualization

All future strategies are **DECIDED candidates**, not implemented libraries. No dependency is added in X1.0; decide at the milestone that needs it, against bundle, accessibility, SSR, RTL, data-volume and licensing needs. Where the table says **CURRENTLY UNAVAILABLE**, that capability lacks a Console implementation or source contract today; the native browser primitive is only a candidate, not an approved dependency.

| Type | Availability; candidate approach | Why it may be needed; milestone decision |
|---|---|---|
| Radial / arc / numeric instrument | SVG/HTML primitives are available; no OIC implementation yet. Candidate: native SVG arcs plus semantic numeric text; CSS for simple rails. | Compact metric display; decide in X1-2 after metric contract. Accessible value remains authoritative. |
| Capacity rail / vertical pressure gauge | HTML/CSS primitives available; no OIC instrument yet. Candidate: scale, labels and threshold markers. | Bounded capacity/pressure with explicit range; decide in X1-2. |
| Sparkline | SVG available; no OIC sparkline renderer. Candidate: small native SVG with source interval and missing-data gaps. | Compact real history only; decide in X1-2 after source/history contract. |
| Historical chart | **CURRENTLY UNAVAILABLE:** no Console chart package and no general time-series contract. Candidate: small chart library vs SVG after history API exists. | Historical querying/zoom may be needed; decide in X1-2 or owning domain milestone. |
| Distribution / heatmap | **CURRENTLY UNAVAILABLE:** no reusable distribution/heatmap renderer. Candidate: SVG/HTML cells for bounded data; evaluate library only if interaction/scale warrants. | Dense comparisons; decide in X1-4 / X1-6 based on real dataset size. |
| Timeline | Semantic list is available; no shared timeline component. Candidate: list first, SVG overlay only for actual temporal relationships. | Trace/event ordering; decide in X1-6. |
| Relationship graph / topology | **CURRENTLY UNAVAILABLE:** no Console graph package or renderer. Candidate: accessible node list plus bounded SVG; assess graph package when scale is known. | Entity/evidence relationships; decide in X1-3 / X1-4. |
| Model DNA | **CURRENTLY UNAVAILABLE:** no evaluator contract/results and no renderer. Candidate: semantic trait table/radar-like SVG only after OIC-7 semantics. | Measured comparison; decide in X1-4 only if OIC-7 provides versioned evidence. |
| Live cognitive map | **CURRENTLY UNAVAILABLE:** no map UI; safe trace artifacts exist. Candidate: event/stage timeline or safe graph projection, never chain-of-thought. | Explain persisted stage/evidence relationships; decide in X1-6. |
| Animation | Browser CSS transitions exist; no animation package or shared motion layer. Candidate: CSS transitions plus reduced-motion support. | Only where motion communicates state; decide per milestone; no decorative motion. |

**DECIDED:** choose Canvas only if measured data volume exceeds SVG/DOM limits and an equivalent accessible textual representation exists. Visuals must support EN/AR and RTL without flipping numeric/time semantics. Existing Node API tests do not substitute for frontend interaction or browser acceptance.

## Capability decision register

Bundle impact below is qualitative; no candidate package was installed or measured in this pass.

| Capability | Current support / technique | Suitability, bundle impact and risks | Recommended X1 approach / decision point |
|---|---|---|---|
| Component rendering | React 19 + Next App Router, local TSX | Existing stack, no incremental bundle; SSR/client boundaries and focus need checks | Continue local feature components; X1-1 |
| CSS / tokens | `app/styles.css`, custom vars, no CSS framework | High suitability; physical properties cause RTL risk; contrast is per rendered pair | Semantic tokens and logical properties; X1-1 |
| Icons | CSS/text glyphs, no Console icon package | Sufficient now; package adds bundle; glyph meaning and direction vary | Prefer existing marks/simple inline SVG; choose package only when gaps block workflows; X1-1 review |
| SVG | Browser-native | Good for bounded graphs/charts; little bundle; text/direction/accessibility need deliberate labels | SVG with title/description plus table/text fallback; X1-2 onward |
| Canvas | Browser-native; no current Canvas | High-volume drawing only; custom interaction cost; inaccessible without parallel representation | Avoid until SVG/DOM benchmark fails; measured decision only |
| Sparklines | No shared component; SVG candidate | Small renderer; requires real timestamped samples and gaps | Native SVG after history API; X1-2 |
| Temporal charts | No package or general time-series contract | Zoom/brush/multi-series may warrant library; bundle varies; RTL axes/tooltips risk | Compare small chart library with SVG prototype after API and representative data; X1-2/owning milestone |
| Heatmaps/distribution | No shared renderer | Bounded SVG/HTML can suffice; large grids may justify library; color-only risk | Table/cell fallback; assess scale and keyboard grid before package; X1-4/X1-6 |
| Graphs/topology | No graph package/renderer | Bounded SVG is viable; force layout can be CPU-heavy; keyboard/RTL risk is high | Accessible list first, deterministic SVG if needed; consider package only after graph-size evidence; X1-3/4 |
| Model DNA | No evaluator contract or renderer | Visual form is less important than measurement validity; radar comparisons can mislead | No score before OIC-7; table primary, optional SVG after semantics; X1-4 |
| Animation | CSS transitions/reduced-motion rule; no animation package | Native cost low; motion sensitivity/distraction risk | CSS state transitions only, no decorative motion; milestone review |
| Virtualization | No virtual-list package or implementation | Can reduce DOM at high cardinality; adds bundle/focus complexity | Try API pagination/windowing first; profile browser with real cardinality before dependency; X1-3 onward |

For missing capabilities, candidates are native SVG/HTML/CSS, a small single-purpose library, or a general framework. Decide using source maturity, interactions, accessibility, RTL, SSR/hydration, measured gzip delta, representative performance, maintenance, license and data cardinality. Record the choice at the consuming milestone before install.
