# OIC Model Factory Architecture

**DECIDED:** Model Factory is a workspace over OIC's actual model product hierarchy, not unrelated CRUD pages. **CURRENT schema:** `OicModelFamily → OicModelEdition → OicModelRevision → OicModelVariant`; a revision may reference an intelligence-profile revision. Variants can reference provider definition/upstream model/transport profile. `OicRuntimeBinding` maps edition and variant to provider connection and PLATFORM/APPLICATION/TENANT scope, environment and DRAFT/active lifecycle state. `OicApplicationModelVisibility` is a separate application visibility relation. Do not conflate upstream catalog model identity with Oi Model product identity.

## Workspace and passport

**PLANNED X1-4 surface:** fleet overview with family/edition/revision tree, filters by lifecycle/scope, and a persistent inspector. A Model Passport summarizes stable identity, lifecycle, revisions, variants, profile link, bindings, visibility, source references and recent linked traces. A passport is a read model over these entities, not a new canonical record.

History is immutable revision lineage; edits create revisions where API contract says so. Binding status, provider connection health, application visibility, and model lifecycle are distinct facts. Show scope explicitly and expose effective binding precedence only as API-resolved behavior. Compare revisions using same-scoped fields and identify absent/incomparable data.

**CURRENT API surfaces:** model-fabric controller provides family/edition/revision/variant creation, runtime binding and binding status, edition lifecycle, and application visibility. Verify exact API semantics before adding any operation. **PLANNED:** evaluation is linked to OIC-7-owned evidence; no score, promotion gate, quality rating, cost claim, or “best model” recommendation is synthesized here. A dashboard-style overview is subordinate to the working hierarchy.

Acceptance includes supported lifecycle and rollback behavior, binding/visibility isolation, revision provenance, picker-first controls, real empty/error states, technical IDs, and EN/AR + LTR/RTL.

## Entity-by-entity contract

| Layer | CURRENT owner/source and relationships | Lifecycle/actions/default/inspector | Metrics and OIC-7 |
|---|---|---|---|
| Fleet | Snapshot in `console-snapshot.controller.ts`; families and their editions | Default scoped tree/counts; filter lifecycle; inspector shows families without inventing active state | Record counts may derive from snapshot; evaluated fleet quality PLANNED OIC-7 |
| Family | `OicModelFamily`; contains editions | API lifecycle as supported; create family only via verified action; default family grouping; inspector key/description/creation metadata | Edition count from relation; quality aggregation OIC-7 only |
| Edition | `OicModelEdition`; belongs family, owns revisions/bindings/visibility relationships | Lifecycle ACTIVE/ARCHIVED/retired only per DTO; detail links current/latest revision and scope | Lifecycle/binding counts; OIC-7 release evidence later |
| Revision | `OicModelRevision`; ordered within edition; instructions/specification and optional profile revision | Immutable version lineage; create next revision; inspector diffs fields and linked profile revision | Revision number is identity, not quality; outcome metrics from matched executions only |
| Variant | `OicModelVariant`; revision + kind and optional provider/upstream/transport references | Add variant through model API; inspect provider ancestry and eligibility; no arbitrary upstream reassignment without supported API | Variant counts and binding presence from snapshot; measured reliability later |
| Intelligence | Profile identity/revision in intelligence module; model revision may reference profile revision | Select via entity picker; inspect immutable policy values; profile lifecycle distinct from model lifecycle | Intensity is configuration; OIC-7 owns measured output |
| Binding | `OicRuntimeBinding`; edition/variant/connection and platform/app/tenant scope/environment/status | Draft/active transition via API; scope validated; list effective resolver result only if API returns it | Status/scope counts; execution-resolved binding evidence future if trace supports |
| Visibility | `OicApplicationModelVisibility`; application↔edition | Set/remove through API contract; inspect app+edition; distinct from runtime binding | Presence/count only; no “available” implication without resolver |
| Evaluation | No general OIC-7 evaluator record asserted in X1 sources | No create/promote/evaluate workflow in X1 unless a separate API owner contract arrives | All quality/efficiency scores PLANNED OIC-7 |
| History | Existing revision lineage, audit events and execution records | Default chronological revision/action references; inspect source events; don't synthesize release history | Stored timestamps only; aggregate performance history needs explicit query/retention |

## Model Passport

**PLANNED X1-4 read model** assembled from source entities; it is not a canonical model record. Sections are rendered only when source data is available:

1. **Identity:** family/edition/product key, display name, IDs and current scope.
2. **Lifecycle:** API lifecycle plus last changed audit reference if available.
3. **Current revision:** latest revision identifier and fields with provenance; “latest” derived by numeric revision.
4. **Current variant:** variant kind, provider/upstream/transport ancestry when present.
5. **Runtime binding:** each binding, status, environment, scope and connection health; mark multiple applicable bindings rather than guessing resolver precedence.
6. **Applications / visibility:** explicit application visibility rows, separate from bindings.
7. **Provider ancestry:** provider definition → connection → upstream model → Oi variant; show only persisted links.
8. **Profile assignment:** referenced profile revision and policy settings, not model quality.
9. **Operational state:** latest execution status associated to model/revision only if trace relation is authoritative; otherwise show no association.
10. **Resource state:** actual tokens/calls/duration per execution; fleet aggregates only with declared time window/cohort.
11. **DNA / Evaluation:** OIC-7 evaluator version, method, cohort, sample, uncertainty and dimensions, or explicit “not measured.”
12. **History:** revisions, audit events and associated traces with source timestamp and authorized links.

Technical detail includes stable entity IDs, API version, source timestamp, raw enum and safe relation keys. All sections support permission/partial-load state independently.

## Assembly Pipeline

**Relationship visualization of CURRENT records:** family → edition → revision → variant → provider definition/upstream model and connection; edition → binding → app/tenant scope; revision → profile revision; application → visibility. Render persisted edges with endpoint names and scope. This diagram can be generated from snapshot records but is not proof that binding is currently selected by runtime.

**PLANNED capability:** a validated “release assembly” pipeline could stage changes, run checks and publish/activate a coherent edition. No new pipeline entity, transactional aggregate, simulation or automated promotion is implied by the current hierarchy. Do not mutate backend semantics to suit the Assembly Pipeline metaphor; use existing actions until a separate API contract defines atomicity, rollback and audit.
