# OIC-X1.5 Factory Capability Matrix

Source audit and implementation scope for the X1.5 Factory Engineering Environment. This matrix reflects current OIC API/BFF contracts; a visible control is not evidence of backend support unless marked below. Owner Visual Acceptance and Workflow Acceptance are **PASS**; X1.5 is **GO / CLOSED**. The automated authenticated locale/viewport matrix remains unavailable due accepted local browser/CDP tooling limitations.

Legend: **SUPPORTED** = existing API/BFF operation or persisted source-backed field; **READ_ONLY** = list/read only; **NOT CONFIGURED** = domain capability exists but no adapter/source is configured; **UNSUPPORTED** = no current API contract; **PLANNED** = future work.

| Entity | List / Read | Create | Update / Lifecycle | Archive / Restore / Delete | Sync / Validate | Relationships / Search / Filter | History / Revision |
|---|---|---|---|---|---|---|---|
| Provider Definition | SUPPORTED; code-owned registration | UNSUPPORTED | READ_ONLY; no definition mutation route | UNSUPPORTED | Only explicitly returned metadata; no inferred provider promises | Provider connections and source support are shown; local search/filter | No definition history or revision API |
| Provider Connection | SUPPORTED | SUPPORTED | Configuration update is UNSUPPORTED; status changes are SUPPORTED for API-accepted states | Archive is SUPPORTED; restore/delete are UNSUPPORTED | Explicit connection test is SUPPORTED; never automatic | Provider, credential metadata, source models and binding counts are source-backed; app/tenant scope | Latest safe health checks are projected; credential values are never projected |
| Catalog Source / Upstream Model | SUPPORTED | Manual/fixture ingestion is SUPPORTED through existing preview/sync contract | Lifecycle operations are SUPPORTED where API allows | Archive is a supported catalog lifecycle state; restore/delete are UNSUPPORTED | Preview/sync are SUPPORTED; local fixture is configured; external discovery is NOT CONFIGURED | Provider/connection lineage and capability/pricing evidence when present; local search/filter | Recent sync outcomes/counts are projected; no field-level baseline diff or deletion inference |
| Model Family | SUPPORTED | SUPPORTED | Family rename/edit is UNSUPPORTED; retirement is SUPPORTED subject to edition lifecycle | Retirement only; archive/restore/delete are UNSUPPORTED | N/A | Editions and source lineage through variants; local search/filter | No family revision history API |
| Edition | SUPPORTED | SUPPORTED | Lifecycle transitions are SUPPORTED only as allowed by the model service | Retirement is a lifecycle state; archive/restore/delete are UNSUPPORTED | N/A | Family, revisions, variants, bindings and application visibility | Revision lineage is persisted; edition lifecycle history is not projected |
| Revision | SUPPORTED | SUPPORTED; append-only | UPDATE is UNSUPPORTED by design | Delete/archive/restore are UNSUPPORTED | N/A | Belongs to an edition and contains variants | Immutable revisions are SUPPORTED; no edit after creation |
| Variant | SUPPORTED | SUPPORTED | Mutation after creation is UNSUPPORTED by current contract | Archive/restore/delete are UNSUPPORTED | N/A | Revision, optional upstream model, provider transport and bindings | No variant revision history API |
| Runtime / Provider Binding | SUPPORTED | SUPPORTED | Status update is SUPPORTED for API-accepted states; configuration edit is UNSUPPORTED | Disable is SUPPORTED; archive/restore/delete are UNSUPPORTED | Resolution/effective-runtime guarantees are not inferred | Variant, connection, scope, application, tenant and environment where returned | No binding history feed is exposed in this snapshot |

## Audited constraints

- Provider definitions are code-owned. Show only declared metadata; never infer capability from a provider name.
- Credential snapshots contain safe metadata only. Secret values are write-only and never enter Inspector, URL, browser storage, logs or fixtures.
- Catalog sync is explicit. Current sync-run records provide counts/outcomes, not a field-level before/after comparison. “No comparison baseline” is the truthful state.
- No external discovery adapter is registered. Manual import remains structured; raw JSON is expert-only. The local fixture path is the only configured discovery adapter.
- Model lifecycle transitions and binding/scope checks remain API-owned. No schema, authorization or security-boundary change is included.
- Client-side search/filter operates over the bounded snapshot; no generalized server search contract is claimed.

## Owner closeout (2026-10-07)

- Provider Factory, Upstream Catalog and Model Factory: owner manual visual and workflow acceptance PASS. The owner accepted the current implementation and its responsive layout; minor spacing/typography/positioning/micro-motion refinements remain non-blocking cosmetic debt.
- Automated authenticated browser matrix: UNAVAILABLE — accepted tooling limitation. No additional browser profile, authentication-policy change or security weakening was performed.
- Local acceptance fixture residue: PRESERVED — SAFETY FIRST. The API source identifies the fixture provider and catalog as development-only; reviewed fixture families were already marked RETIRED. No data, lifecycle, or audit-history mutation was made; retired records are filtered by default in the Factory.
- Validation and live state: Console typecheck/lint/tests (45/45), API focused snapshot tests (2/2), API typecheck/build, default-heap Console production build, `git diff --check`, secret scan and OIC boundary scan PASS. Console/API remain available; readiness reports database `ok`.
- Next return point: OIC-X1.6 — Cognitive Profiles + Model DNA, NOT STARTED. Respect its prerequisites, including the OIC-7 evaluator contract before scoring UI. OIC-6 remains NOT STARTED.
