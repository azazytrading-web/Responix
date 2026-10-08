# OIC X1.7 Memory and Knowledge Capability Matrix

**Status:** **GO / CLOSED** after Owner Visual Acceptance PASS and Owner Workflow Acceptance PASS (2026-10-08). Both studios are accepted; semantic, provenance, security and canonical-component boundaries remain locked. No automated authenticated browser matrix or screen-reader audit is claimed.

This matrix records the current API and persistence contract at baseline `80ba17e`. “Supported” describes an operation that exists in the current API; it does not imply that every Console principal has permission. API scope and application/tenant checks remain authoritative. Owner acceptance does not expand those contracts.

## Memory records — `OicIntelligenceMemory`

| Capability | Current state | Evidence and UI treatment |
|---|---|---|
| LIST | SUPPORTED | Admin list, bounded to 200; current application and authorized tenant scope; SESSION-kind records are excluded. Display returned count as a bounded sample, not a global total. |
| READ | SUPPORTED | Scoped detail endpoint. Sensitive/restricted content is redacted by API. |
| CREATE | SUPPORTED | Manual EPISODIC, SEMANTIC, PROCEDURAL, APPLICATION records. SESSION is runtime-owned and not an admin-create option. |
| UPDATE | SUPPORTED | Lifecycle, sensitivity, and `validUntil` are mutable. Content, kind, scope, provenance and confidence/salience are not general update fields. |
| ARCHIVE | SUPPORTED | Lifecycle transition to ARCHIVED; API owns transition validation and audit emission. |
| RESTORE | UNSUPPORTED | API rejects restoration from ARCHIVED. |
| DELETE | UNSUPPORTED | No hard-delete admin operation. |
| SEARCH | SUPPORTED | Bounded server text query matches title, source type and source reference. It is not semantic search and does not search content. |
| FILTER | SUPPORTED | Tenant, kind, lifecycle and query filters. Tenant access is still enforced by API. |
| SYNC | UNSUPPORTED | No memory synchronization operation. |
| INGEST | UNSUPPORTED | No memory import/ingestion workflow. Manual record creation is not labeled ingestion. |
| RETRY | UNSUPPORTED | No retry operation. |
| HISTORY | UNAVAILABLE | No memory history/version read endpoint. Audit events are emitted for supported writes, but a memory-scoped audit history query is not exposed. |
| PROVENANCE | SUPPORTED | `sourceType`, optional `sourceRef`, created/updated timestamps, optional last-confirmed and originating execution fields. Do not infer provenance beyond stored values. |
| RELATIONSHIPS | SUPPORTED | Application and optional tenant scope; optional actor principal; originating execution when available; exact memory IDs and usage decisions in bounded execution summaries. No profile ownership relation. |
| AUDIT | READ_ONLY | Writes emit audit events; no memory-targeted audit list endpoint is exposed to this Console view. Do not present a fabricated activity timeline. |
| RUNTIME USAGE | SUPPORTED | Execution summaries can identify selected/used/discarded memory IDs and usage signals. Runtime retrieval eligibility is separately governed by scope, profile policy, lifecycle, sensitivity and expiry. |
| EXPIRY | SUPPORTED | `validUntil` is stored and enforced in runtime retrieval. Admin create/update can set or clear it after the X1.7 BFF contract correction. |
| RETENTION | UNAVAILABLE | No retention policy or purge endpoint. Age is not expiry. |

## Knowledge records — `OicIntelligenceKnowledge`

| Capability | Current state | Evidence and UI treatment |
|---|---|---|
| LIST | SUPPORTED | Admin list, bounded to 200, scoped to application and authorized tenant. Counts are explicitly for the returned sample. |
| READ | SUPPORTED | Scoped detail read returns record content and metadata. |
| CREATE | SUPPORTED | Creates one curated evidence record with source key/reference, title/content, optional tenant, authority/source-priority metadata and dependency references. This is not document ingestion. |
| UPDATE | SUPPORTED | Title, lifecycle, authority, source priority and dependency references. Title update re-embeds existing content. |
| ARCHIVE | SUPPORTED | Lifecycle transition to ARCHIVED. |
| RESTORE | UNSUPPORTED | Archived records cannot be restored. |
| DELETE | UNSUPPORTED | No hard-delete route. |
| SEARCH | SUPPORTED | Bounded server text query matches title, source key and source reference. It does not search content or perform semantic search. |
| FILTER | SUPPORTED | Tenant, lifecycle and query filters. |
| SYNC | UNSUPPORTED | No source sync/connector contract. |
| INGEST | UNSUPPORTED | No source importer, ingestion job or retry state. Record creation must not be represented as ingestion. |
| RETRY | UNSUPPORTED | No retry endpoint. |
| HISTORY | UNAVAILABLE | No version/history read endpoint. Audit writes are emitted for mutations but no Knowledge-scoped audit listing is exposed here. |
| PROVENANCE | SUPPORTED | Source key/reference, title, created/updated/published timestamps and application/tenant scope. Source key is not a connector type. |
| RELATIONSHIPS | SUPPORTED | Application/tenant scope; `dependsOn` contains source-key/reference pairs without foreign-key validation. Bounded execution evidence graphs may reference retrieved knowledge evidence. No profile ownership relation. |
| AUDIT | READ_ONLY | Writes emit audit events; no Knowledge-targeted audit list endpoint is exposed to this workspace. |
| RUNTIME USAGE | SUPPORTED | Bounded execution evidence graphs can show returned evidence references. A returned candidate/reference does not prove that content entered provider context. |
| EXPIRY | UNAVAILABLE | Knowledge has no expiry field. |
| RETENTION | UNAVAILABLE | No retention policy or purge endpoint. |

## Context evidence and shared limits

| Area | Current state | Contract boundary |
|---|---|---|
| Memory vs Knowledge | SUPPORTED | Separate persistence models, policies and workspaces. Do not merge their labels or lifecycle semantics. |
| Memory context usage | SUPPORTED | `memoryUtility` and memory selection metadata may identify exact memory IDs and bounded decisions/signals. No private reasoning text is needed or shown. |
| Knowledge evidence | SUPPORTED | Execution evidence graph carries safe source/provenance metadata and references. Do not expose raw evidence content through trace summaries or claim every reference was used. |
| Context budgets | SUPPORTED | Profile revision contains configured ceilings; execution has measured `contextTokens`. These are distinct values and must be labeled separately. |
| Profile relationship | SUPPORTED | Profile retrieval intensity/max retrieval queries and memory policy govern runtime selection. There is no record-to-profile ownership field. |
| Application/Tenant relationship | SUPPORTED | Application is fixed by the authenticated machine principal; optional tenant scope is validated by API grants. |
| Hidden reasoning / prompts | UNSUPPORTED | No private chain-of-thought, raw full prompt or hidden working-memory view may be added. |
| Source history, document/chunk model | UNSUPPORTED | No Knowledge source connector, document, chunk, ingestion-job, sync-run or processing-history entities exist in the current schema. |

## Audit references

- `apps/oic-api/src/modules/intelligence/intelligence.controller.ts`
- `apps/oic-api/src/modules/intelligence/intelligence-data.service.ts`
- `apps/oic-api/src/modules/intelligence/memory.repository.ts`
- `packages/oic-database/prisma/schema.prisma`
- `apps/oic-console/app/api/console/route.ts`
- `apps/oic-console/app/api/action/route.ts`
- `apps/oic-api/src/modules/intelligence/intelligence-profile.service.ts`
- `apps/oic-api/src/modules/intelligence/engines/evidence-graph.ts`

No database changes are part of X1.7. Any backend change is limited to an existing BFF mapping correction for already-supported Memory fields.

## X1.7 closeout record

- Memory Studio: PASS. Knowledge Studio: PASS. Separate workspace identity, source-backed summaries, filter rails, capability-aware empty states, selected-record composition, provenance, context eligibility/evidence, archive behavior, structured create sidecars and canonical controls accepted.
- Truthfulness/security: stored is distinct from retrieved and runtime inclusion; metadata search is not semantic search; expiry and sensitivity are not scores; Knowledge source references remain provenance metadata; no fake history, scoring, ingestion pipeline, hidden reasoning or prompt viewer. Existing authentication, session, origin, CSRF, machine credential and scope authorization boundaries remain unchanged; DB schema unchanged.
- Validation: Console typecheck/lint PASS; all Console tests 59/59; focused X1.7 tests 7/7; default-heap build PASS; production development routes 404; API/database readiness PASS; diff, secret-pattern and OIC boundary scans PASS.
- Locale/accessibility evidence: Owner accepted EN/AR and LTR/RTL direction, including responsive direction. Native Arabic/RTL source tests pass. No screen-reader audit or dedicated X1.7 keyboard audit is claimed; keyboard evidence is limited to canonical shared controls and focused tests.
- Accepted non-blocking polish: duplicate title hierarchy, summary micro-polish, sidecar wizard visual polish, minor spacing/alignment, typography, command positioning, density and micro-motion. These items do not reopen X1.7.
