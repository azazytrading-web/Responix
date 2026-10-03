# Memory and Knowledge Intelligence Studio

**CURRENT Memory model:** OIC-owned `OicIntelligenceMemory` is scoped by application and optional tenant, with optional actor/session, kind, lifecycle, sensitivity, content, embedding metadata, entity/source references, confidence/salience, validity/confirmation dates and originating execution. Runtime scope rules are enforced by API; do not infer that operator-wide read access means cross-tenant access is permitted.

**CURRENT Knowledge model:** `OicIntelligenceKnowledge` is scoped by application and optional tenant and records source key/reference, title/content, dependency references, embedding metadata, authority/source priority, lifecycle and publication/update timestamps. It is not a general document-management or external vector service contract.

**PLANNED X1-5 workspace:** separate Memory and Knowledge scopes, inspect an entity before editing, filter by lifecycle/type/source, show provenance, dependencies, freshness, sensitivity and linked execution where present. Lifecycle/archive operations must show scope and effects. Preserve empty vs filtered-empty vs API-unavailable. Search inputs are sanitized and bounded; pickers avoid routine UUID entry.

**DECIDED evidence discipline:** display stored confidence/authority as source-owned fields with labels; never market them as calibrated truth. Retrieval outcome, memory utility and evidence support require a trace or evaluator record. “Useful memory” is not implied by salience. Unknown dependencies and stale dates remain visible. No cross-application/tenant graph joins. OIC-7 quality metrics remain PLANNED; no synthetic relevance charts.

## Memory workspace contract

**CURRENT source:** `apps/oic-api/src/modules/intelligence/intelligence.controller.ts`, `intelligence-data.service.ts`, `memory.repository.ts`, plus `OicIntelligenceMemory` schema. Read APIs accept scope/query/kind/lifecycle; mutations create or patch only fields allowed by strict DTOs. Memory entity fields include application, optional tenant/actor/session, kind, lifecycle, sensitivity, title/content, embedding metadata, entity/source refs, confidence/salience, validity/confirmation, originating execution and timestamps.

**PLANNED local surfaces:** Inventory; Composer; Inspector; Usage; Selection History. Inventory filters by real API query dimensions. Composer uses application/tenant structured picker, kind selector, sensitivity selector, entity/source picker and labeled confidence/salience sliders. Do not make raw tenant UUID, actor ID or session ID the default. Inspector separates human content (permission/sensitivity gated) from metadata, provenance and technical IDs. Usage and selection history show only linked persisted traces; if no relationship/query exists, mark unavailable/not instrumented rather than infer from salience.

Control mapping: confidence and salience are integer source settings 0–100 (CURRENT fields; slider display does not validate quality); scope is app+optional tenant via structured selector; sensitivity is PUBLIC/INTERNAL/SENSITIVE/RESTRICTED segmented/select; kind is EPISODIC/SEMANTIC/PROCEDURAL/SESSION/APPLICATION; identity/source IDs are picker first, technical inspector fallback. Freshness derives from stored `validUntil`, `lastConfirmedAt`, `updatedAt`; do not calculate semantic freshness unless policy exists. Lifecycle action choices come from API DTO (ACTIVE/STALE/SUPERSEDED/CONFLICTED/UNVERIFIED/ARCHIVED); confirm destructive transition and refresh.

## Knowledge workspace contract

**CURRENT source:** same intelligence controller/data service and `OicIntelligenceKnowledge`; source identity is app/tenant + sourceKey/sourceRef, with title/content/dependencies, embedding metadata, authority/sourcePriority, lifecycle, publish/update times. Dependencies are a bounded list of source references, not guaranteed foreign-key graph nodes. API supports list/inspect/create/update under scopes.

**PLANNED local surfaces:** Inventory; Source Editor; Evidence Editor; Dependency Canvas (list-first, graph later); Inspector; Conflicts (only persisted/runtime-produced contradiction evidence). Dependency picker searches authorized knowledge/evidence refs and stores stable sourceKey/sourceRef. Missing dependency is `UNKNOWN/MISSING REFERENCE`, not silently deleted. Cycle validation should be an explicit server/API contract before UI blocks cycles. Future contradiction visualization needs explicit evidence pair, relationship, resolver status and provenance; no inferred conflict from textual similarity.

Keep fields distinct: **dependency** means one source explicitly references another; **authority** is stored source-owned rank, not trust calibration; **priority** is source preference for retrieval, not importance/quality; **freshness** is timestamps/validity policy, not source accuracy; **retrieval eligibility** is actual runtime scope/lifecycle/policy result, not merely active status. These distinctions appear in labels/tooltips and technical inspector.

## Shared workspace states and boundaries

Empty successful inventory, no search matches, missing detail, unauthorized scope, API unavailable and stale entity are separate states. Saving returns confirmed server fields and audit/correlation where supplied. Archive is not deletion. Filters persist within local workspace, not globally across tenants unless explicitly shown. APIs remain the scope authority. Future OIC-7 may consume labeled memory/knowledge evaluation evidence; it cannot mutate the meaning of stored confidence, salience, authority or priority.
