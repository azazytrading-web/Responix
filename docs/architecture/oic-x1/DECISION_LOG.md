# OIC-X1 Architecture Decision Log

**Status:** DECIDED unless marked PLANNED. Decisions apply to OIC only. Alternatives record viable paths considered, not necessarily rejected forever.

| ID | Decision; reason | Alternatives considered | Consequences | Milestones |
|---|---|---|---|---|
| X1-ADR-01 | OIC remains product/runtime/database independent; boundary must survive extraction. | Shared product tables/runtime; direct product imports. | Versioned API contracts only; separate OIC DB and credentials; hard-stop on cross-product coupling. | X1.0–X1.7 |
| X1-ADR-02 | Workspace-first IA under COMMAND, FOUNDATION, FACTORY, INTELLIGENCE, LAB, OPERATIONS. | Flat sidebar; entity-per-global-route. | Route growth happens locally within workspace; preserve current `View` during transition. | X1-1, X1-3–7 |
| X1-ADR-03 | Black/near-black surfaces, white type, restrained amber identity and precision neon. | Generic SaaS palette; full-time luminous dashboard. | Dense hierarchy with restrained emphasis; supplied image is visual-only reference. | X1-1, X1-2 |
| X1-ADR-04 | Green denotes semantic success/health only. | Brand green/decorative green. | Amber carries brand/selection; orange warning; red critical; neutral offline. | X1-1–7 |
| X1-ADR-05 | Metric Registry and Instrument Registry are separate contracts. | Metrics embed renderer; renderer computes values. | Sources/metrics evolve independently from accessible renderers/layouts. | X1-2 onward |
| X1-ADR-06 | No fake telemetry. | Demo values in live dashboard; repeating snapshots as history. | Unavailable and missing data are explicit; historical views wait for actual samples. | All |
| X1-ADR-07 | Model DNA is measurement output, never inferred from profile settings. OIC-7 owns evaluator semantics. | Slider-based “intelligence score”; ad-hoc composite score. | X1-4 may define shell but scores remain PLANNED pending method, cohort, denominator and version. | X1-4; OIC-7 dependency |
| X1-ADR-08 | Configuration surfaces follow observed reactive loop: input → persisted/effective state → execution → safe trace → outcome. | Assume immediate effects; use synthetic prediction. | Show unknown impact when no API evidence; simulations must be real and isolated. | X1-3–7 |
| X1-ADR-09 | Smart Operating Layer is contextual, source-linked advice with explicit operator apply. | Generic chatbot; autonomous operator. | Evidence, uncertainty, scope and confirmation required; no cross-product actions. | X1-7 |
| X1-ADR-10 | Owner-visible preview remains live on separate Console/API persistent processes. | Restart shared process for each task. | Maintain ports 3002/4100 during work and report actual health. | All local milestones |
| X1-ADR-11 | EN/AR and LTR/RTL are release requirements. | English-first with RTL deferred. | Every modified page passes four browser combinations; machine IDs stay LTR-isolated. | All |
| X1-ADR-12 | X1.0 adds no frontend dependency; choose renderer technology at need. | Add general-purpose chart/graph stack up front. | Existing CSS/React/SVG is the initial candidate; dependency decision belongs to the milestone and evidence. | X1.0; X1-2 onward |

## Detailed architecture records

The index above is a summary. The following records add context and are normative when a future implementation prompt omits detail.

### X1-ADR-01 — OIC product isolation

- **STATUS:** DECIDED. **DECISION:** OIC owns runtime, API, Console, contracts and dedicated OIC database; extraction must not require redesign.
- **CONTEXT:** OIC shares Git history with other products, which can obscure data/runtime boundaries.
- **ALTERNATIVES:** shared product tables/runtime or direct imports; rejected because they create hidden coupling and cross-customer risk.
- **RATIONALE:** same vendor/repository is not same product ownership. Use explicit versioned API/connector contracts.
- **CONSEQUENCES:** OIC database-name/role checks, no cross-product imports/reads/components, hard-stop if boundary is unclear.
- **AFFECTED MILESTONES:** X1.0–X1.7; especially X1.3, X1.5 and X1.7.

### X1-ADR-02 — Workspace IA

- **STATUS:** DECIDED. **DECISION:** six global domains with local workspace navigation and entity inspectors.
- **CONTEXT:** current `View` state has 15 destinations and future operator surfaces will grow.
- **ALTERNATIVES:** increasingly long flat sidebar or entity/action globally; rejected due poor scale/context.
- **RATIONALE:** keep global mental model stable while local surface groups can grow by ownership.
- **CONSEQUENCES:** current view names map to target workspaces; future URL/deep-link layer must preserve scope and history.
- **AFFECTED MILESTONES:** X1.1–X1.7.

### X1-ADR-03 — Black/amber identity and semantic green

- **STATUS:** DECIDED. **DECISION:** neutral black/near-black, white text, intelligence amber; green is success/health only.
- **CONTEXT:** operator console requires dense precision without decorative color ambiguity.
- **ALTERNATIVES:** generic SaaS palette, green-tinted surfaces, unrestricted status colors; rejected.
- **RATIONALE:** color has stable product/semantic meaning; textual/icon labels preserve accessibility.
- **CONSEQUENCES:** amber marks identity/selection, orange warning/degraded, red fault/destructive, neutral offline; no mint cast.
- **AFFECTED MILESTONES:** X1.1 onward; Flight Deck X1.2.

### X1-ADR-04 — Precision neon and restrained motion

- **STATUS:** DECIDED. **DECISION:** glow has NONE/SUBTLE/ACTIVE/EMPHASIS levels with rare emphasis; motion is purposeful and reduced-motion aware.
- **CONTEXT:** reference image sets craftsmanship/density and precise light language only.
- **ALTERNATIVES:** permanent glow, bloom, flashing/gaming style; rejected because it weakens hierarchy and accessibility.
- **RATIONALE:** optical emphasis must map to focus, selection or real live state.
- **CONSEQUENCES:** no large bloom; no glow for offline/unknown; avoid continuous animation.
- **AFFECTED MILESTONES:** X1.1–X1.2 and all instrument surfaces.

### X1-ADR-05 — Metric and Instrument Registry separation

- **STATUS:** DECIDED. **DECISION:** metric definitions/instances are separate from renderer contracts and deck layout.
- **CONTEXT:** telemetry grows by entity/source; visualization choices evolve independently.
- **ALTERNATIVES:** renderer-owned calculations or page-specific hard-coded tiles; rejected due source drift and Overview rewrites.
- **RATIONALE:** normalize/validate data once; renderers consume provenance-carrying instances.
- **CONSEQUENCES:** unknown metrics stay inspectable; renderer changes cannot rewrite metric truth; registry currently PLANNED.
- **AFFECTED MILESTONES:** X1.2–X1.7.

### X1-ADR-06 — Dynamic entity instrumentation

- **STATUS:** DECIDED (future behavior). **DECISION:** model/provider groups discover entities and compatible metrics from authorized API data and registry `entityType`.
- **CONTEXT:** fleet/providers change without frontend release.
- **ALTERNATIVES:** cards hard-coded to names; rejected because new entities disappear or require layout changes.
- **RATIONALE:** stable entity typing and metric registry allow safe extensibility.
- **CONSEQUENCES:** absent metric means unavailable/offline, not placeholder; runtime registry work is PLANNED.
- **AFFECTED MILESTONES:** X1.2–X1.4.

### X1-ADR-07 — No fake telemetry

- **STATUS:** DECIDED. **DECISION:** no invented sample, threshold, history, alert, score or trend in live product views.
- **CONTEXT:** current source coverage is narrower than the intended future deck.
- **ALTERNATIVES:** decorative demo charts or repeating snapshots; rejected as misleading.
- **RATIONALE:** operator decisions require causal source and freshness.
- **CONSEQUENCES:** render unavailable/unknown/idle explicitly; historical views wait for retention/query contracts.
- **AFFECTED MILESTONES:** all X1.

### X1-ADR-08 — Partial Model DNA and OIC-7 ownership

- **STATUS:** DECIDED. **DECISION:** partial measured dimensions are allowed; no score synthesis from missing fields. OIC-7 owns evaluator semantics.
- **CONTEXT:** current OIC-5 exposes controls and per-run evidence, not a benchmark population/evaluator contract.
- **ALTERNATIVES:** normalize radar area or make up defaults; rejected as invalid measurement.
- **RATIONALE:** comparisons require defined cohort, denominator, confidence and version.
- **CONSEQUENCES:** “not measured” is a first-class state; OIC-7 evidence is a dependency for scored DNA.
- **AFFECTED MILESTONES:** X1.4, X1.6, X1.7.

### X1-ADR-09 — Profile settings do not equal quality

- **STATUS:** DECIDED. **DECISION:** profile intensity/budget fields are control configuration only.
- **CONTEXT:** API profile revisions persist intensity and bounded resource policy.
- **ALTERNATIVES:** display sliders as intelligence capability/quality; rejected because control is not outcome.
- **RATIONALE:** quality needs controlled evaluation; runtime output depends on model/task/provider and conditions.
- **CONSEQUENCES:** settings are labeled configured values; only matched OIC-7 measures support quality dimensions.
- **AFFECTED MILESTONES:** X1.4, X1.6.

### X1-ADR-10 — Reactive configuration

- **STATUS:** DECIDED. **DECISION:** show CURRENT, DRAFT, known/predicted/unknown impact, optional real simulation, APPLY, RESULT and later OBSERVATION separately.
- **CONTEXT:** persistence and actual runtime adoption are different events.
- **ALTERNATIVES:** show optimistic “live impact” immediately; rejected absent resolver/trace evidence.
- **RATIONALE:** operator must distinguish confirmed configuration from actual execution effect.
- **CONSEQUENCES:** draft diff, server result and later trace correlation are explicit; predictions require a versioned owner.
- **AFFECTED MILESTONES:** X1.3–X1.7.

### X1-ADR-11 — Contextual advisor, not chatbot-first

- **STATUS:** DECIDED. **DECISION:** Smart Operating Layer presents grounded facts/insights/recommendations in current context and never silently applies a change.
- **CONTEXT:** operational assistance must retain scope and evidence.
- **ALTERNATIVES:** generic chat panel or autonomous remediation; rejected due weak provenance/consent.
- **RATIONALE:** guidance is useful when attached to page/entity/action and source.
- **CONSEQUENCES:** source, freshness, confidence, known/predicted class and permissioned apply path required.
- **AFFECTED MILESTONES:** X1.7.

### X1-ADR-12 — Safe trace artifacts only

- **STATUS:** DECIDED. **DECISION:** Trace Inspector exposes allowlisted persisted structured artifacts, never private CoT or secret payload.
- **CONTEXT:** OIC-5 persists bounded execution/stage records and safe summaries.
- **ALTERNATIVES:** raw metadata/whole request-response or free-form internal reasoning; rejected for privacy/security and because those are not trace contracts.
- **RATIONALE:** observable causality can be explained by stage, source and verifier summaries.
- **CONSEQUENCES:** DTO allowlist, unknown-key hiding, role/scope authorization and explicit missing-state display.
- **AFFECTED MILESTONES:** X1.1, X1.5–X1.7.

### X1-ADR-13 — Live preview is permanent

- **STATUS:** DECIDED. **DECISION:** separate persistent Console :3002 and API :4100; keep Console visible in VS Code.
- **CONTEXT:** owner needs continuous inspection of the real implementation.
- **ALTERNATIVES:** shared/ephemeral process or silent port shift; rejected because preview continuity matters.
- **RATIONALE:** rapid operator review requires stable live service.
- **CONSEQUENCES:** Terminal A/B/C pattern and post-build recovery verification in every frontend milestone.
- **AFFECTED MILESTONES:** all frontend X1 milestones.

### X1-ADR-14 — EN/AR plus LTR/RTL is mandatory

- **STATUS:** DECIDED. **DECISION:** all changed UI passes English and Arabic in both desktop and narrow direction contexts.
- **CONTEXT:** locale toggle alone does not prove layout/string quality.
- **ALTERNATIVES:** defer Arabic/RTL until after frontend work; rejected because direction impacts navigation/components.
- **RATIONALE:** localization and layout are architecture, not translation polish.
- **CONSEQUENCES:** logical CSS, glossary, bidi-safe IDs, four-cell browser evidence per changed page.
- **AFFECTED MILESTONES:** all X1.

## X1.0C runtime interaction and governance amendments

These amendments complete the X1.0 architecture lock. They extend the existing product, telemetry and interaction decisions without changing application code. Statuses describe architecture decisions, not implementation completion.

### X1-ADR-15 — Snapshot, live state and history are distinct

**DECIDED:** snapshots, live observations, stale values, retained samples, window aggregates, evaluations and configuration revisions have separate semantics and source times. Freshness thresholds belong to the source/domain owner. Current Console requests are snapshot/readback paths; Native runtime SSE is not a Console telemetry stream. See [21](21_OIC_LIVE_STATE_AND_TEMPORAL_ARCHITECTURE.md).

### X1-ADR-16 — Acquire aggregates, not individual instruments

**DECIDED:** workspace/source-level batching and shared refresh cycles are the default; no endpoint or timer per instrument. Polling, SSE or WebSocket require measured need and defined scope, freshness, capacity, failure and reconciliation contracts. See [25](25_OIC_FRONTEND_PERFORMANCE_AND_DENSITY.md).

### X1-ADR-17 — Event vocabulary does not require a distributed bus

**DECIDED:** operator events have a versioned, secret-free semantic envelope and source-backed status. Existing audit/execution records are not a general change feed; candidate event types remain PLANNED without a safe producer. No new bus is required in X1. See [22](22_OIC_ACTION_COMMAND_EVENT_ARCHITECTURE.md).

### X1-ADR-18 — Permission-aware affordances never authorize

**DECIDED:** visible/read-only/actionable/not-authorized/not-applicable/unavailable are distinct UX states. Human Console session and API machine-principal scopes are separate; API authorization is authoritative. Never weaken BFF, origin, CSRF, session or credential boundaries. See [23](23_OIC_PERMISSION_AWARE_OPERATOR_UX.md).

### X1-ADR-19 — No assumed rollback; reconcile ambiguous writes

**DECIDED:** show confirmed, partial and unknown mutation outcomes separately. Timeout/network ambiguity requires reconciliation before retry; retry only under endpoint-specific idempotency. “Rollback” is reserved for backend-supported reversal. High-impact writes use confirmed server state. See [24](24_OIC_FAILURE_RECOVERY_AND_ROLLBACK.md).

### X1-ADR-20 — Draft and configuration diff are shared primitives

**DECIDED:** workspaces share saved/dirty/invalid/validating/ready/submitting/applied/failed semantics and semantic current/proposed diff. No silent overwrite or invented collaborative editing. Consequential concurrency needs an API-enforced expected revision. See [14](14_OIC_REACTIVE_CONFIGURATION_ARCHITECTURE.md) and [22](22_OIC_ACTION_COMMAND_EVENT_ARCHITECTURE.md).

### X1-ADR-21 — Availability and compatibility are explicit

**DECIDED:** feature availability states are distinct from freshness and lifecycle. Metric, instrument, DNA, capability, impact and event contracts are versioned; unknown input degrades safely without semantic misrepresentation. A generic capability descriptor is PLANNED until implemented. See [26](26_OIC_VERSIONING_CAPABILITY_AND_COMPATIBILITY.md).

### X1-ADR-22 — Performance is measured architecture

**DECIDED:** set numeric budgets only after browser/API measurement at representative data scale. Bound requests, rendering, history, subscriptions and memory; preserve legibility as entity count grows. See [25](25_OIC_FRONTEND_PERFORMANCE_AND_DENSITY.md).

### X1-ADR-23 — Visual acceptance requires reproducible evidence

**DECIDED:** review dimensions, browser/build/configuration, actual viewport, locale/direction, states, functional readback and accessibility are recorded. “Looks good” is not an acceptance result. Existing OIC-5 widths are reference evidence, not X1 acceptance. See [27](27_OIC_VISUAL_ACCEPTANCE_GOVERNANCE.md).

### X1-ADR-24 — Owner-visible local preview is permanent

**DECIDED:** during each frontend milestone, keep the Console on `localhost:3002` and OIC API on `127.0.0.1:4100` as separate persistent processes, visible in VS Code; use a third terminal for validation/Git. Do not silently change ports or routinely terminate previews. Preserve all auth/origin/CSRF/session/machine-credential controls and never request the Operator password. See [execution plan](../../project-state/OIC_X1_EXECUTION_PLAN.md).

## X1.3A — Interface Systems architecture lock (2026-10-05)

### X1-ADR-25 — One OIC Interface Systems layer, with a deferred dependency decision

**DECIDED:** X1.3B implements one OIC-owned typed interface system, composed from OIC-styled interaction primitives, workspace patterns and domain adapters. React Aria Components is the recommended behavior foundation after X1.3B pins and verifies a version against React 19 / Next 15, SSR, RTL, bundle, dependency and license requirements. No package is installed and no library extracted in X1.3A. Keep domain instruments and OIC semantic rendering in OIC-owned components. See [architecture](28_OIC_INTERFACE_SYSTEM_ARCHITECTURE.md), [contracts](29_OIC_CONTROL_LIBRARY_CONTRACT.md) and [extraction strategy](37_OIC_INTERFACE_EXTRACTION_STRATEGY.md).

### X1-ADR-26 — Controls preserve domain meaning and bounds

**DECIDED:** sliders/ranges use domain-provided minimum, maximum, step, units, presets and validation; presets never imply permission to save. Numeric controls preserve exact values and formatting semantics. Each control has explicit labels, help, disabled/read-only/unauthorized/error states, focus behavior, keyboard behavior and EN/AR direction rules. Styling cannot redefine a domain scale or authority. See [control contract](29_OIC_CONTROL_LIBRARY_CONTRACT.md).

### X1-ADR-27 — Drafts, previews and authoritative state remain distinct

**DECIDED:** editable workspaces keep local draft separate from last-loaded server state, validation/preview output and confirmed persisted state. Preview has no mutation side effect. Save, publish, test, revoke and other commands require explicit intent and server authorization. Ambiguous outcomes reconcile against authoritative state; no client-only permission, impact or rollback claim. See [reactive configuration](32_OIC_REACTIVE_CONFIGURATION_SYSTEM.md), [state machine](34_OIC_INTERFACE_STATE_PERMISSION_MACHINE.md) and existing [failure/recovery contract](24_OIC_FAILURE_RECOVERY_AND_ROLLBACK.md).

### X1-ADR-28 — Component availability reflects evidence, not speculation

**DECIDED:** show action availability based on the server response and current route contract. Do not invent generic permission discovery, universal preview/impact, conditional-write, cancellation, undo or rollback APIs. Distinguish unsupported, unavailable, not authorized, invalid, conflict and transport-uncertain states. API authorization remains authoritative. See [command/action system](30_OIC_COMMAND_AND_ACTION_SYSTEM.md), [permission-aware UX](23_OIC_PERMISSION_AWARE_OPERATOR_UX.md) and [state machine](34_OIC_INTERFACE_STATE_PERMISSION_MACHINE.md).

### X1-ADR-29 — X1.3A locks architecture; X1.3B owns code and gallery delivery

**DECIDED:** X1.3A is documentation/source audit only. X1.3B is the next return point for implementation of shared controls, selection/pickers, configuration state, workspace panels, gallery, tests and incremental page adoption. The gallery is development-only and must use production components. X1.3A makes the planned milestone transition explicit: future Provider Factory, Model Factory, Memory, Runtime/Lab and SOL milestones are X1.4 through X1.8; completed X1.1 and X1.2 records keep their historical labels. See [execution plan](../../project-state/OIC_X1_EXECUTION_PLAN.md), [gallery spec](35_OIC_INTERFACE_GALLERY_SPEC.md), [acceptance governance](36_OIC_INTERFACE_ACCEPTANCE_GOVERNANCE.md) and [page matrix](38_OIC_PAGE_CONTROL_ADOPTION_MATRIX.md).

## X1.3B — Interface System v1.0 source-of-truth lock (2026-10-06)

### X1-ADR-30 — OIC interface libraries are canonical; galleries are consumers

**DECIDED:** The OIC-owned Interface System and Instrument System are executable source-of-truth libraries. Production pages and development galleries import their components through the public library barrels; galleries may compose examples but may not maintain alternate controls or instrument renderers. Interface theme/component styles live with the canonical Interface System, while page composition styles stay with their owning page. Development fixtures remain isolated to development routes and never feed production Overview, BFF snapshots, runtime or persisted data. Future cross-product reuse requires a separately reviewed, versioned package and compatibility contract; X1.3B does not extract or duplicate these libraries. The owner accepted Interface System v1.0 and its visual baseline for this milestone; X1.4 is the next planned adoption milestone and is not started by this decision.

## X1 final source audit — canonical convergence complete (2026-10-10)

**RECORDED:** The authorized convergence repair migrated Runtime, Overview, Catalog, and Flight Deck Inspector exceptions to canonical public Interface components. The owner extended scope to the Profiles archive filter and additional same-class exceptions; Profiles now uses `ToggleControl`, and legacy Factory form choices use `EntityPicker` with key submission and required selection. The final production audit found zero material raw UX controls or local Inspector clones. Unused legacy definitions in `oic-primitives` are not mounted in production; the shell command palette is a separate interaction with no canonical palette equivalent. Development fixtures remain isolated from production. OIC-X1 is CLOSED / FROZEN / GO; X1.1–X1.9 owner acceptance remains historical and unchanged. Next return point: OIC-6; OIC-6–OIC-9 remain NOT STARTED.
