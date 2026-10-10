# OIC Instrument Library v1.0

**Status: VISUALLY APPROVED / FROZEN BASELINE**
**Current OIC implementation:** The Oi Instrumentation System is canonical and frozen in `apps/oic-console/app/components/instruments/`; a separately versioned cross-product package remains planned.
**Owner approval:** The owner approved the current visual direction on 2026-10-04 and accepted the X1.2 implementation on 2026-10-05. Owner manual visual acceptance is PASS. Automated authenticated real-Overview capture is NOT AVAILABLE and is not claimed.

OIC-owned React, SVG and CSS instrumentation used by the X1.2 Flight Deck. The locked stack audit is in `docs/architecture/oic-x1/05_OIC_FRONTEND_TECHNOLOGY_STACK.md`: Console uses Next 15, React 19 and TypeScript, with no visualization or motion dependency. These instruments use native SVG/CSS and add no dependencies. Architecture v1.0 remains unchanged.

## Ownership and entry points

- Components and semantic contracts: `apps/oic-console/app/components/instruments/index.tsx` and `scales.ts`.
- Stable public imports: `apps/oic-console/app/components/instruments` (the barrel entry resolves to `index.tsx`, including the public scale contracts).
- OIC theme tokens and component styling: the canonical `--oii-*` rules are globally provided by `apps/oic-console/app/styles.css`; Flight Deck `fd-*` composition rules remain page-owned.
- Registry-driven metric interpretation remains in `features/overview/metric-registry.ts` and `instrument-registry.ts`.
- Development reference gallery: `/dev/instruments`, behind a server-side `NODE_ENV === "development"` guard. It is not in Console navigation. A production `next start` process has `NODE_ENV=production`, so the route intentionally returns 404.

The development Gallery and Flight Deck showcase import the public instrument barrel used by production Overview. Gallery fixtures live only in their development routes and are never imported by Overview or data adapters. Production values remain source-derived. There are no fabricated metrics, samples, thresholds, confidence values, or deltas in the production path. Product pages compose canonical instruments; they do not copy SVG, scale, focus, or state implementations.

## Instrument and scale contracts

### Permanent gauge typography rule

**PRIMARY READOUT OCCUPIES THE SAFE INNER VISUAL ZONE. IDENTITY AND SEMANTIC LABELING MUST NOT COMPETE WITH INSTRUMENT GEOMETRY.** Circular, radial and arc instruments reserve the center for the primary reading (and a compact unit when needed). Metric identity and semantic state sit in a separate caption zone after the drawing. A state-only readiness ring may place `LIVE` or `READY` in its center, but its identity remains below the ring. ArcMeter reserves an explicit graphic row before its caption; radial gauges inset the SVG/readout geometry within their footprint to preserve clearance from tick marks and arc ends.

Vertical pressure gauges keep the measured reading beside the tube in a dedicated readout block; the tube does not become a text surface. Capacity and pressure rails follow the order **metric label → value and unit → rail → state/source**. Small instruments use an approved short label with full terminology in inspection details instead of colliding text.

This typography rule applies across Intelligence Core, Core Vitals, model pods, Lab, Cognitive Activity, Live Operations and service readiness. It does not change instrument state, scale semantics or hardware geometry.

`InstrumentProps` carries shared state, label, source/freshness, size, selection and disabled information. Bounded visualizations require explicit bounds. Telemetry also requires explicit min/max for samples; if bounds are missing it reports `SCALE UNAVAILABLE`, and missing samples remain `NO HISTORY / NO FEED`.

ArcMeter supports `SEMI` (180 degrees), `EXTENDED_SEMI` (220 degrees, OIC default), and `THREE_QUARTER` (270 degrees). RadialGauge has a 280 degree sweep with a bottom opening. The shared tick plan varies density across XS/SM/MD/LG. Current, threshold and target markers are separate from language direction; RTL does not reverse numerical semantics.

`SemanticScale` models `HIGH_IS_BAD`, `LOW_IS_BAD`, `HIGH_IS_GOOD`, `LOW_IS_GOOD`, `TARGET_RANGE`, `NEUTRAL`, and `CUSTOM`. It does not infer meaning from numeric direction. A band color requires an explicit zone. Full gradients are limited to complete, contiguous, polarity-consistent directional zones that span the declared range. Missing or incomplete threshold data stays neutral amber. Target ranges need explicit bounds. No global thresholds are assumed. Risk gradients require an explicit semantic polarity and a complete validated threshold set; they are never derived from presentation defaults.

States distinguish active, ready, degraded, fault, idle, unavailable, unmeasured, not configured, and insufficient data. Pulsing is opt-in for known LIVE/FAULT attention and respects reduced motion. Historical samples must be ordered and source-retained. DNA polygons include only valid measured dimensions; fewer than three produce no polygon. The accessible dimension list remains authoritative.

## Component reference

The frozen library inventory exported or integrated from the local instrument system is: `StatusRing`, `RadialGauge`, `ArcMeter`, `VerticalPressureGauge`, `CapacityRail`, `NumericInstrument`, `TelemetryStrip`, `DistributionRail`, `StateBeacon`, `NodeTrack`, `AssemblyPipeline`, `DNARadar`, `OicOrbitalGauge`, `SensorBank`, and `DeltaIndicator` (with shared `InstrumentFrame` structure). `ArcMeter` defaults to `EXTENDED_SEMI` (220 degrees); `SEMI` and `THREE_QUARTER` remain explicit variants. `OicOrbitalGauge` supports at most three independent layers and remains gallery-only until a real composite consumer exists. SensorBank renders small instrument geometry, with unmeasured cells remaining unpowered. These components, the semantic scale system, and their current Flight Deck integrations are frozen as the v1.0 baseline. Future visual evolution is additive and versioned.

Unavailable and unmeasured values remain visibly distinct and do not receive fabricated readings. Dormant/unpowered states do not imply a zero measurement. DNA polygons include only valid measured dimensions; fewer than three produce no polygon, and absent scores remain unmeasured. Every informative SVG has an accessible label or equivalent accessible text; decorative geometry is hidden from assistive technology. Keyboard focus, reduced-motion behavior, semantic state text, and non-color distinctions are required. RTL mirrors layout direction without reversing numeric scale, value, or threshold meaning; use bidi isolation where mixed-direction values require it.

## Overview integration and truth

System Core continues to render registry values. OIC-7 dimensions stay unmeasured. Fleet inventory remains source-derived; DNA shows its dormant skeleton without scores. Provider paths and Model Factory stages remain tied to snapshot counts. Cognitive Activity remains a safe structured sample, and the Lab has no-history state until retained samples exist. Existing page hierarchy and adapters are preserved. The current metric definitions do not provide semantic threshold zones, so production Overview gauges remain neutral amber.

## Future extraction readiness (documentation only)

The future extraction concept is **Oi Instrumentation System**. Status: **PLANNED / NOT IMPLEMENTED**. It is not a runtime product or package in X1.2; no files are extracted, no Portal showcase or Responix adoption is claimed, and current ownership remains exclusively OIC Console.

Potential neutral primitives for a later deliberate extraction:

- SVG arc/radial geometry, tick planning, marker positioning and bounded value math.
- Polarity and threshold-zone contracts, validation, and gradient eligibility.
- Accessible state semantics, unavailable states, and reduced-motion behavior.
- Generic gauge, pressure, rail, telemetry, distribution, pipeline and radar structures.

OIC-specific presentation that should remain theme-owned:

- Amber/green/orange/red palette and neon glow tuning.
- OIC orbital mark, Oi typography, section labels and console density.
- OIC-7 DNA dimension names, Flight Deck compositions and OIC data adapters.

Keep generic component props independent of OIC records, API paths and tokens. A later package would introduce its own theme adapter and would require a separate architecture decision and migration plan.

## Local review and focused checks

The `/dev/instruments` route deliberately returns 404 in production. Start the Console in development mode with the exact workspace command `pnpm --filter @oic/console dev` (or from the package directory `pnpm dev`); it serves port 3002. Keep the OIC API on 4100 in its own persistent process. Then visit `http://localhost:3002/dev/instruments` and the authenticated Overview at `http://localhost:3002`. The gallery is not a normal production navigation page.

Synthetic values are labelled `DEMO` and exist only in the gallery; gallery fixtures are not imported into production Overview. Production data remains source-derived and absent telemetry/history/DNA values remain absent or unmeasured. This documentation freezes the implementation baseline only; X1.2 release status is recorded separately in the acceptance matrix and tracker after its required gates pass.

## X1.2 Flight Deck closure rule

**Overview is the OIC Brain Vital Monitor.** The top Service State, Intelligence Core and Core Vital Signs zones form one Core Monitoring Rack sized by information density. The Hero Core Load remains mounted when production telemetry is absent, reports `UNMEASURED` and honest source coverage, and never invents production weights or energy readings. Synthetic composite values are confined to `/dev/flight-deck`, which returns 404 outside development mode.

Physical instrument geometry is invariant across telemetry states. State changes value, status and illumination; state does not redesign the interface. The production Overview and development showcase render the same Overview composition and the same instrument library.

For the final X1.2 micro-fit, the Service State, Intelligence Core and Core Vital Signs are three zones in one top monitoring rack. Service counts and Intelligence Core use compact 3×2 matrices; Core Vitals retains its approved instrumentation and density. The development showcase supplies demo signals only through its development-gated route and never through production Overview/BFF data paths.

## Permanent design rules

1. Overview = OIC Brain Vital Monitor.
2. State changes telemetry and illumination, not physical cockpit geometry.
3. The primary gauge reading occupies the protected inner readout zone.
4. Instrument identity and semantic state must not compete with gauge geometry.
5. Missing telemetry never justifies an unfinished-looking interface.

## Accepted Cosmetic Polish Deb

Minor refinements may remain, including micro-spacing, typography alignment, small instrument-label polish and local density refinements. They do not reopen X1.2 and may be addressed later only as opportunistic polish or real bug fixes. No new sprint is created; the X1.2 baseline remains frozen.
