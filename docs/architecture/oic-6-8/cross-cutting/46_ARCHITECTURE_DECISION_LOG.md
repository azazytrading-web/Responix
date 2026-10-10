# Architecture decisions and review risks

> **HISTORICAL / DIRECTIONAL PREDECESSOR - NOT ACTIVE IMPLEMENTATION AUTHORITY.** The owner-approved OIC-6 through OIC-9 v1.0 lock in [the canonical OIC-6 to OIC-9 architecture](../../oic-6-9/00_MASTER_ARCHITECTURE_LOCK_MANIFEST.md) supersedes this material for implementation. Retained for historical context; do not use to override the locked package.


**v1.0 amendment (2026-10-11):** The [locked v1.0 architecture](../../oic-6-9/00_MASTER_ARCHITECTURE_LOCK_MANIFEST.md) retains decisions 1–30 and adds precise protocols. In particular, decision 2 means a usage/OIU journal distinct from provider cost assessments and customer rated-event journal; decision 3 uses an effective-dated provider book plus pinned rate snapshot; decision 4 requires atomic reservation across *all* applicable hard buckets; decision 11 includes environment/adapter and exact case release; decision 14 uses preregistered paired/slice uncertainty; decision 16 makes DNA contextual with native units, not universal 0–100; decision 19 is OIC-7-owned CAS plus fresh verdict and human approval; decision 23 is new guarded pointer change and readback. Details and red-team findings are in [v1.0 audit](../../oic-6-9/cross-cutting/51_RED_TEAM_AND_LOCK_READINESS.md). Business activation choices remain in the manifest; safe defaults permit internal packets without changing these decisions.

**Final precision decision (2026-10-11):** Owner approved OIC-9 scope as production hardening, resilience, certification and final operational closure. Numerical targets remain later activation decisions. OIC-7 now requires an immutable Evaluation Protocol Manifest with target class and first-class harness digest; comparability/eligibility is a machine-readable decision, not a chart inference. Verification tier distinguishes OIC-executed from external/self-reported. DNA is a derived projection, never an editable measured score. The protected-answer firewall excludes candidate generation, OIC-8, Memory/Knowledge, ordinary runtime, browser and logs. OIC-9 PASS requires actual pinned evidence; missing evidence is NOT_EVALUATED and critical controls cannot be waived. See [formal evaluation protocol](../../oic-6-9/oic-7/26_EVALUATION_PROTOCOL_AND_COMPARABILITY.md) and [certification contract](../../oic-6-9/oic-9/40_RELIABILITY_DR_AND_CERTIFICATION.md).

Historical review status at creation: proposed, owner review pending. The decision list below records the predecessor review state; the owner-approved OIC-6 to OIC-9 v1.0 lock is now the active authority. No code or schema is implied by architecture approval. The common options were mutable counters/config, implicit defaults and client enforcement. They were rejected because retries, concurrent writes and historical reinterpretation would be unsafe. Complexity is limited to correctness-critical revisions, postings, work leases and evidence references.

| # | Decision and rationale | Tradeoff / failure control / extension |
|---|---|---|
| 1 | OIU is a versioned fixed-point internal consumption unit, separate from money and raw tokens. | Policy maintenance; pin inputs/revision and allow analytical re-derivation. |
| 2 | Usage ledger is append-only; balance is a rebuildable transactional projection. | More rows; unique keys and reconciliation detect drift. |
| 3 | Immutable effective-dated pricing revision plus per-assessment rate snapshot. | Duplicated rate evidence; explains historical selection and invoice corrections. |
| 4 | Hard quota uses PostgreSQL row locks/serializable transaction. | DB contention; partition by scope/window and fail closed. |
| 5 | Reserve worst permitted use before dispatch. | Idle holds; fenced expiry and safe release. |
| 6 | Unknown provider usage remains pending liability, never zero. | Reduced capacity until reconciliation; explicit operator path. |
| 7 | Entitlement precedence: deny, explicit grant, narrowest hard limit, audited scoped override. | More policy resolution work; deterministic trace and no implicit allow. |
| 8 | Plans are immutable revisions with effective-dated assignments. | More records; history and in-flight policy remain explainable. |
| 9 | OIC-7/8 use DB-backed durable work/outbox initially. | Less throughput than specialized queue; avoids new dependency and survives crash. |
| 10 | Dataset/case/suite revisions are immutable content-addressed manifests. | Storage cost; dedup and retention policy. |
| 11 | Fingerprint hashes full resolved target, evaluation revisions, parameters and code version. | Strict cache hits; prevents invalid comparison. |
| 12 | Metrics are typed by method, polarity, unit, availability and revision. | Composite score complexity; no unsupported universal rank. |
| 13 | Judges are revisioned blind human/model instruments with calibration. | Operational cost; drift and bias remain visible. |
| 14 | Paired differences, uncertainty intervals, sample policy and multiplicity guard promotion. | Slower decisions; inconclusive blocks unsafe claims. |
| 15 | Protected holdout is sealed from candidates/OIC-8; only evaluator sees answers. | Restricted debugging; exposure invalidates cohort. |
| 16 | DNA belongs to evaluated target plus task/cohort/context, not model name alone. | More contextual UI; avoids fake global trait. |
| 17 | DNA registry has immutable trait definitions and evidence thresholds. | Traits roll out gradually; missing remains unmeasured. |
| 18 | Candidate is immutable revision with parent lineage and scoped target. | Storage; rollback retains prior pointer. |
| 19 | Promotion consumes immutable OIC-7 verdict and compare-and-swaps binding. | More coordination; stale verdict/pointer blocks. |
| 20 | Champion/challenger is per scope/environment. | No global winner; reflects actual runtime routing. |
| 21 | OIC-8 initially proposes profile, instructions, binding and reviewed retrieval/verification policy changes only. | Narrow reach; new targets need separate review. |
| 22 | Human approval is default for all production promotion. | Slower learning; prevents opaque self-modification. |
| 23 | Rollback is new authorized pointer change, not history rewrite. | Requires retained prior revision and post-change verification. |
| 24 | Post-promotion verification is mandatory with predeclared guardrails; missing data is unverified. | Observation delay; no false success. |
| 25 | Content retention is governed by versioned policy; immutable non-content evidence survives permitted redaction. | Legal/business periods need owner choice. |
| 26 | Command audit and domain evidence are separate but cross-referenced. | More storage; preserves action/observation distinction. |
| 27 | OIC-6 feeds OIC-7 budget/cost evidence; OIC-7 cannot bypass admission. | Evaluation may block under quota; correct accountability. |
| 28 | OIC-7 reports and verdicts feed OIC-8, never raw sealed answers. | Less generator context; holdout integrity. |
| 29 | OIC-8 candidates loop through OIC-7 before any promotion. | Longer cycle; no direct production write. |
| 30 | Sequence OIC-6 shadow→gate, OIC-7 deterministic→judged→DNA→promotion, OIC-8 review→canary. | Sequential dependency; bounded vertical packets avoid re-architecture. |

## Blocking business decisions

No business choice blocks the **safe architecture or first internal implementation packets**: no external billing is assumed, hard limits deny by default, tenant data is excluded from protected shared holdouts by default, and auto-promotion is disabled. Before enabling customer billing, overage, tenant-derived protected datasets or auto-promotion, the owner must make explicit separate product/legal/security decisions. Exact retention durations and commercial price policy also require owner decision before those features are activated.

## Ranked architectural risks

| Severity | Risk | Mitigation; residual uncertainty |
|---|---|---|
| CRITICAL | Concurrent hard-quota overspend | DB atomic reserve, bounded provider output, serializable retries; ambiguous provider charging remains reconciled liability. |
| CRITICAL | Evaluation holdout leakage into learning | Sealed ACL, aggregate-only report, access audit/rotation; external provider memorization may be unknowable. |
| CRITICAL | Promotion bypass or stale verdict | OIC-7-only guarded command, report digest and CAS; operator privilege remains high value. |
| HIGH | Duplicate physical provider calls on timeout | Attempt IDs, metering per attempt, no exactly-once claim; provider idempotency varies. |
| HIGH | Missing usage/cost mistaken for zero | Typed availability and pending liability; provider invoice lag remains. |
| HIGH | Invalid comparison from changed dataset/judge/model | Full fingerprint, pinned revisions, comparability verdict; nondeterminism remains. |
| HIGH | Cross-tenant evidence exposure | Composite scope FK, server filters, ACL tests; operational export controls need review. |
| HIGH | Judge bias and metric gaming | Blind randomized order, calibration, protected slices, human review; no perfect judge. |
| MEDIUM | DB-backed work/ledger contention | Scope partitions, short transactions, index and queue telemetry; actual scale must be measured. |
| MEDIUM | Retention versus audit reproducibility | Separate content/evidence retention and redaction state; legal schedule awaits owner. |

**Complexity removed:** no new Redis authority, no general billing engine, no global intelligence score, no autonomous weight training, no universal champion, no cross-product platform integration, no speculative simulation engine. Existing OIC runtime idempotency, audit writer, revisioned model/profile lineage, PostgreSQL and canonical UI are reused where their contracts fit.


## Final architecture lock decision (2026-10-11)

The owner approved and locked OIC-6, OIC-7, OIC-8, and OIC-9 architecture as v1.0. [`docs/architecture/oic-6-9/`](../../oic-6-9/00_MASTER_ARCHITECTURE_LOCK_MANIFEST.md) is the canonical implementation authority; this OIC-6 through OIC-8 package is retained as historical/directional predecessor material and is superseded for implementation. OIC-9 scope is production hardening, resilience, certification, and final operational closure. Commercial charging/overage, retention durations, tenant-derived protected datasets, automatic promotion, numerical SLO/RPO/RTO targets, and capacity thresholds are non-blocking activation decisions with safe defaults in the canonical manifest. All four milestones remain ARCHITECTURE LOCKED - IMPLEMENTATION NOT STARTED. The next implementation return point is OIC-6.1, Raw evidence.

Locked architecture may be amended only for a discovered contradiction, impossible invariant, security or integrity defect, unavoidable provider/platform constraint, or materially incorrect repository assumption. An amendment records the problem, affected contract, decision, compatibility impact, and migration impact; material changes require explicit owner approval and a versioned decision record. Preference, naming, cosmetic UI, convenience, and speculative future features do not reopen the lock.
