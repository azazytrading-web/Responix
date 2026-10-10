# Bounded roadmap and acceptance

> **HISTORICAL / DIRECTIONAL PREDECESSOR - NOT ACTIVE IMPLEMENTATION AUTHORITY.** The owner-approved OIC-6 through OIC-9 v1.0 lock in [the canonical OIC-6 to OIC-9 architecture](../../oic-6-9/00_MASTER_ARCHITECTURE_LOCK_MANIFEST.md) supersedes this material for implementation. Retained for historical context; do not use to override the locked package.


Each packet is a coherent vertical slice. Future implementers read this package, then inspect only named source and migration targets. No packet is authorized by this architecture review. Owner checkpoint follows each packet; a failed gate leaves subsequent packets unstarted.

| Packet | Goal and dependencies | Backend / DB / API / frontend / tests / migration / acceptance |
|---|---|---|
| 6.1 Evidence foundation | Existing OIC runtime/trace | Add scoped event/attempt and immutable policy revision schema; capture raw usage and availability server-side; read-only API and canonical UI; migration additive; tests for source, scope, missingness and no secrets. Owner confirms shadow evidence. Risk: high. |
| 6.2 Accounting economics | 6.1 | Append-only postings, OIU policy, pricing revision/snapshot, cost evidence, reconciliation projection; read APIs/UI; backfill only `HISTORICAL_UNVERIFIED`; test replay, rounding, adjustments and invoice mismatch. Owner approves economic semantics. Risk: high. |
| 6.3 Entitlement enforcement | 6.2 | Plan/assignment/quota revisions, atomic admission/reservation/release, runtime hook, errors and operator UI; canary migration; concurrency/timeout/crash/DB outage tests. Owner approves hard quota gate. Risk: critical. |
| 7.1 Evaluation foundation | Accepted OIC-6 gate | Immutable case/dataset/suite revisions, durable work, per-case admission, deterministic metric, run/report APIs/UI; no production promotion; crash/retry/fingerprint tests. Owner accepts reproducible baseline. Risk: high. |
| 7.2 Comparison integrity | 7.1 | Judge/human review contracts, protected holdout, slices, uncertainty and comparability; restricted artifacts and report UI; bias/leakage/statistical tests. Owner approves evaluation integrity. Risk: critical. |
| 7.3 DNA and candidate gate | 7.2 | Trait registry/measurements, candidate lineage, verdict and manual CAS promotion/rollback; canonical DNA UI; missingness, stale verdict, rollback tests. Owner approves measured traits and gated evolution. Risk: critical. |
| 8.1 Review-only learning | Accepted OIC-7 | Scoped signals/hypotheses/proposals and counterevidence, budget/reviewer policy, review UI; no production write; provenance/access tests. Owner approves target classes. Risk: high. |
| 8.2 Controlled experiment | 8.1 | Candidate generation within allowlist, OIC-6 budget, OIC-7 evaluation, proposal lineage and sealed-holdout boundary; failure/contamination tests. Owner approves bounded experiments. Risk: high. |
| 8.3 Canary control | 8.2 | Human approval, OIC-7 promotion command, scoped canary, post-promotion guardrails and rollback drill; audit/readback/authorization tests. Owner decides rollout. Risk: critical. |

## Architecture acceptance matrix

| Gate | Required proof before implementation acceptance |
|---|---|
| OIC-6 | Raw/provider usage provenance, OIU derivation/revision, cost evidence levels and pricing history, append-only ledger, plan/entitlement precedence, atomic quota/reservation under concurrency, idempotency, unknown usage/reconciliation, app/tenant security, API/UI and rollout. |
| OIC-7 | Immutable case/dataset/suite and target fingerprint, durable bounded engine, per-attempt OIC-6 metering, typed metrics/judges/human review, aggregate uncertainty and slices, holdout isolation, comparability, measured DNA provenance/freshness, candidate lineage, verdict/CAS/manual promotion/rollback, API/UI and rollout. |
| OIC-8 | Scoped signal/hypothesis/proposal lineage, allowed targets and forbidden security/Memory/Knowledge writes, budgeted OIC-7 validation, holdout separation, approval, blast radius, promotion/readback, post-promotion verification and rollback, audit/API/UI and rollout. |
| Cross-milestone | OIC-6 enforcement remains independent; OIC-7 uses OIC-6 budget; OIC-8 uses OIC-7 verdict and cannot write production; existing X1 DNA shows no fake measurement; Runtime/Trace links retain scope and provenance. |

## Later test strategy

Use focused unit tests for policy arithmetic and metric definitions; transaction tests for quota race, ledger replay and promotion CAS; API tests for grants, scope and idempotency; property tests for fixed-point rounding and invariant preservation; statistical fixtures for paired intervals/multiple comparisons/missing data; blinded judge calibration and holdout leakage tests; chaos tests for worker crash, provider timeout, DB failure, duplicate callback, queue/cache loss and interrupted promotion. Run migration compatibility and backfill labeling checks. No test or migration is executed in this architecture pass.

## Final design review

OIC-6 review: concurrent calls cannot exceed a hard admitted ceiling because reserve and projection commit together; actual provider overrun remains recorded as debt, not hidden. Retry keys cannot double-post logical consumption, while ambiguous physical calls are distinct attempts. Pricing changes cannot rewrite old assessments. Unknown usage/cost cannot render as zero. Client requests cannot bypass server-side admission. A dispatched but failed call remains a pending liability until reconciled.

OIC-7 review: every measurement traces to case attempt, target fingerprint, metric/judge revision and source artifact availability. A legitimate comparison requires aligned cohort/revisions and explicit declared treatment; drift or contamination invalidates gate, never retroactively rewrites history. Protected holdout answers never enter candidate generation. Missing evidence cannot become a zero trait or passing score. Weak samples and missing slices block promotion. OIC-6 caps evaluation spend; retry attempts are separately metered. Operator explanation is report plus verdict plus binding audit.

OIC-8 review: proposal service cannot write active binding, credentials, permissions, Memory or Knowledge. It sees sealed evaluation verdicts, not holdout answers; contrary evidence stays immutable. Multi-objective guardrails constrain quality, cost, latency and safety. Promotion requires fresh OIC-7 verdict, human approval, scoped CAS and readback; rollback retains a known prior revision. Missing post-promotion data yields `UNVERIFIED` and freezes expansion.

Complexity review: DB-backed work/outbox, append-only postings and immutable revisions are needed for correctness. External queue authority, automated model training, cross-product billing, general prediction/simulation and auto-promotion remain deferred. The architecture does not require repeated broad repository discovery for a packet.
