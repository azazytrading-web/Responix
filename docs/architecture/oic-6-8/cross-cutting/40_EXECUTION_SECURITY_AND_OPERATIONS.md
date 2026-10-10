# Shared execution, security, retention and recovery

> **HISTORICAL / DIRECTIONAL PREDECESSOR - NOT ACTIVE IMPLEMENTATION AUTHORITY.** The owner-approved OIC-6 through OIC-9 v1.0 lock in [the canonical OIC-6 to OIC-9 architecture](../../oic-6-9/00_MASTER_ARCHITECTURE_LOCK_MANIFEST.md) supersedes this material for implementation. Retained for historical context; do not use to override the locked package.


## Durable work

Current OIC has PostgreSQL/Prisma transactions and runtime idempotency but no identified OIC queue/Redis worker. Begin with an OIC-owned PostgreSQL work table plus outbox, unique logical work key, `QUEUED|LEASED|SUCCEEDED|FAILED|CANCELLED`, lease generation/fencing token, bounded retries and dead-letter review. Workers claim with `FOR UPDATE SKIP LOCKED`; lease expiry allows a new worker but stale workers cannot finalize. Work records contain references and minimal payload, not secrets or holdout answers. A committed state transition and outbox row share a transaction; delivery is at-least-once, consumers idempotent. Redis may later accelerate dispatch but never own quota, evaluation result or promotion truth. Backpressure limits app/tenant/provider concurrency and OIC-6 budget. Provider calls remain physically at-least-once under ambiguous failures; preserve attempt IDs and account for duplicates rather than promising impossible exactly-once delivery.

## Security and provenance

All records carry applicationId and nullable tenantId consistent with the application; privileged global records use explicit scope. API queries filter before pagination/aggregation and reauthorize linked evidence. Principal grants remain server-authoritative. Separate permissions for plan/policy publication, reconciliation, evaluation dataset/judge administration, protected holdout access, candidate approval, promotion and rollback. Two-person approval is required for sensitive override/promotion policy changes; no self-approval. BFF keeps session/origin/CSRF and server machine credential boundaries. Provider credentials stay encrypted server-side. Logs/audit use allowlisted IDs/status/digests; no raw prompts, response content, secrets, hidden chain-of-thought or protected holdout answers in generic telemetry.

Raw execution/evaluation content has purpose-specific encrypted artifact storage with scope ACL, retention class, legal-hold path and deletion/tombstone workflow. Ledger postings, aggregate results and audit references retain immutable non-content provenance for their governed retention period. Deletion of source content changes report availability to `SOURCE_REDACTED`; it never forges a zero or rewrites economic postings. Retention periods are policy revisions, not hardcoded here because legal/business schedules are not present in OIC repository truth. Exports enforce tenant scope and reasoned authorization.

## Failure matrix and operations

| Failure | Required behavior |
|---|---|
| Retry or duplicate callback | Same logical key replays committed result; different payload conflicts; physical attempts separately evidenced. |
| Worker crash/lease timeout | Fenced reclaim from DB; read prior durable state; reconcile ambiguous provider attempt before release. |
| Provider timeout/error | Record outcome and unknown usage liability; retry only within budget and provider safety contract. |
| DB transaction outage | Hard quota and promotion fail closed; worker waits; no uncommitted success shown. |
| Redis/cache loss | DB authority continues; slower dispatch permitted; no quota correctness change. |
| Stale configuration/concurrent mutation | Pin revisions; compare-and-swap rejects stale pointer and requires reevaluation if target changes. |
| Authorization failure | Reject before work dispatch; audit denial without sensitive payload. |
| Quota/budget exhausted | No provider call; explicit blocked status, not failed measurement/zero usage. |
| Missing/contaminated evidence | Inconclusive result; no DNA measurement or promotion. |

Readback checks compare ledger projection to append-only posts, work table to outbox, case attempts to OIC-6 postings, verdict to immutable report, and promotion decision to runtime binding pointer. Alert on drift; repair via explicit adjustment/reconciliation command and audit. Scale by indexed scope/time partitions and bounded page queries; retain raw per-attempt evidence, build disposable read projections, batch noncritical aggregation, avoid scanning full traces in request paths. Rate-limit evaluation providers and enforce tenant fairness. Capacity planning uses measured throughput and storage, never fake historical dashboards.

Migration order is additive and backward compatible: introduce tables and read-only/shadow instrumentation; observe old runtime semantics; enable OIC-6 gate per scoped canary; only then OIC-7 workers and reports; only after accepted OIC-7 gate enable OIC-8 proposals. Feature gates default off. Rollback disables new admission/evaluation/proposal dispatch while preserving postings and evidence; hard quota cannot be silently bypassed after enforcement activation. API evolution uses versioned DTOs and explicit compatibility windows. UI consumes existing canonical X1 Interface/Instrumentation systems.
