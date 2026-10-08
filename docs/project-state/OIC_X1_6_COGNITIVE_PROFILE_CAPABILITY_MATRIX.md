# OIC-X1.6 Cognitive Profile Capability Matrix

**Source audit baseline:** OIC-X1.5 accepted tree, 2026-10-08. This records observed contracts; it is not a generic capability descriptor.

## Profile contract

| Concept | Current behavior | Classification | Workspace behavior |
|---|---|---|---|
| Read/list | `GET /api/v1/admin/intelligence/profiles`, `oic:models:read`; built-in/custom, lifecycle, latest revision and counts | SUPPORTED | Search/filter human identity; technical IDs secondary |
| Read revision history | `GET /api/v1/admin/intelligence/profiles/:id`; all immutable revisions and per-revision model-revision counts | SUPPORTED | Timeline and readback |
| Create | `POST /profiles`, `oic:models:manage`; strict identity/policy schema, creates custom profile and r1 atomically | SUPPORTED | Create form validates API bounds; verify readback |
| Clone | `POST /profiles/:revisionId/clone`; copies policy into new custom r1; archived source rejected | SUPPORTED | Clone a selected visible revision |
| New revision | `POST /profiles/:profileId/revisions`; active custom only, increments revision | SUPPORTED | Draft then immutable new revision; verify readback |
| Mutate historical revision | DB trigger/API preserve immutability | IMMUTABLE | Persisted controls read-only; change by new revision |
| Disable | Lifecycle endpoint accepts DISABLED for custom | SUPPORTED | Rare action menu, confirm/readback |
| Archive | Lifecycle endpoint accepts ARCHIVED for custom | SUPPORTED | Rare action menu, confirm/readback; archive is terminal |
| Restore archived | Service rejects transition away from ARCHIVED | UNSUPPORTED | No restore action |
| Activate disabled | Lifecycle endpoint accepts ACTIVE for custom unless archived | SUPPORTED | Action menu and readback |
| Compare configuration | Existing revision payloads permit a semantic field diff | SUPPORTED | Side-by-side values; higher is not better |
| Bind | Model revision create accepts `intelligenceProfileRevisionId`; profile detail returns counts and the Console snapshot carries model revisions | SUPPORTED (model revision contract) | Join immutable profile revisions to model revisions by exact ID; do not infer effective runtime selection |
| Execution history | Bounded application/tenant-scoped execution list carries `profileRevisionId` | SUPPORTED (bounded sample) | Link exact matching traces only; no total usage claim |
| Audit history | Profile actions emit audit events; no profile-scoped audit list endpoint found | UNSUPPORTED (profile-scoped read) | State unavailable; no invented timeline |
| Evaluation | No OIC-7 evaluator result contract/source available | UNMEASURED | Keep separate from configuration; no scores |

## Policy fields and semantics

The strict schema has eight integer intensity ceilings (`0..100`), nine bounded resource ceilings, and three booleans: `allowMemoryWrites`, `allowRevision`, and `requireEvidence`. Intensities and maxima are configuration ceilings, not observed consumption or ability. No cost/OIU field exists.

## DNA entity and provenance

DNA is a model/model-revision evaluation result with evaluator, cohort and evidence provenance; a profile is configuration and a comparison condition, not a DNA owner. The frozen registry marks all 13 evaluator dimensions `PLANNED` and names OIC-7 as owner. No measured values, method, evaluator version or cohort are available. The production workspace renders the canonical dormant `DNARadar`, plus a complete typed dimension/provenance/availability list in `UNMEASURED / AWAITING OIC-7` state. Profile values and trace counts never populate the radar.

## Canonical primitives audited

Available and used as appropriate: `PresetSelector`, `IntensitySlider`, `BudgetSlider`, `NumericStepper`, `SegmentedControl`, `ConfigurationDiff`, `CompareSurface`, `Timeline`, `Inspector`, `CommandBar`, `StickyActionBar`, `DNARadar`, and `StateBeacon`. Exact names `ComparisonPanel`, `BeforeAfterDiff`, and `RevisionTimeline` are absent; existing canonical equivalents are used rather than local replacements.

## X1.6 closeout evidence (2026-10-08)

- Owner Visual Acceptance: PASS. Owner Workflow Acceptance: PASS. The primary Configuration workspace was previously accepted; remaining major workflows were reviewed against the live implementation source and focused tests.
- Profile and revision selection use canonical React Aria `ProfilePicker` / `RevisionPicker`. Create/clone and lifecycle confirmations use canonical `Inspector`, including Escape dismissal and focus return behavior.
- EN/AR dictionary parity and native Arabic labels are tested; locale sets RTL direction. No browser automation or screen-reader audit is claimed for this environment.
- Console typecheck, lint and 52 configured tests PASS; default-heap production build PASS; `git diff --check`, changed-file secret scan and OIC boundary review PASS. Console and API return HTTP 200; database readiness is `ok`.
- Measured DNA: 0. Configured/declared DNA: 0 supported dimensions. Unmeasured DNA: 13. The evaluator dependency and all OIC-7 scoring work remain NOT IMPLEMENTED; OIC-6 remains NOT STARTED.
- Exact next return point: OIC-X1.7 Memory & Knowledge Intelligence Studio (NOT STARTED).
