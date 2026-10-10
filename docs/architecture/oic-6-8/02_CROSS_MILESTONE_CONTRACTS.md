# Cross-milestone contracts

> **HISTORICAL / DIRECTIONAL PREDECESSOR - NOT ACTIVE IMPLEMENTATION AUTHORITY.** The owner-approved OIC-6 through OIC-9 v1.0 lock in [the canonical OIC-6 to OIC-9 architecture](../oic-6-9/00_MASTER_ARCHITECTURE_LOCK_MANIFEST.md) supersedes this material for implementation. Retained for historical context; do not use to override the locked package.


## Evidence identity

Every new durable record has a UUID, immutable applicationId, nullable tenantId with application-consistent FK, actor/producer principal or service identity, occurredAt and recordedAt. It references existing UUIDs for provider connection, upstream model, edition/revision/variant/binding, profile revision, execution and trace where applicable. Missing source IDs are explicit `UNRESOLVED`, never replaced by display names. Natural keys are for lookup; historical joins use immutable IDs and revision IDs. A shared `EvidenceRef` value contains `sourceType`, `sourceId`, `sourceRevision`, `producer`, `applicationId`, `tenantId`, `occurredAt`, `recordedAt`, `derivationId`, `policyRevisionId`, `executionId/traceId`, `availability`, and permitted confidence. It is an indexable envelope, not a copy of protected content.

Configuration interpretation pins immutable revisions: OIU conversion, pricing, plan, entitlement, quota policy, evaluation suite/dataset/case/metric/judge, DNA trait, learning policy and promotion policy. Revision payloads are canonical JSON or normalized immutable rows with schema version and SHA-256 digest. A changed rule creates a new revision. Historical posts and measurements retain their revision IDs and input snapshots. Reinterpretation creates a new analytical derivation linked to the original; it never mutates original evidence.

Time fields have distinct meanings: `occurredAt` source event time, `recordedAt` OIC receipt, `processedAt` derivation/worker completion, `reconciledAt` provider settlement, `evaluatedAt` measurement, `promotedAt` binding change. Late events preserve original occurrence and recording times and appear in an adjustment epoch. Display time may localize; storage is UTC.

## Integration envelopes

| Producer → consumer | Contract and failure boundary |
|---|---|
| Runtime → OIC-6 | Before provider call: authenticated scoped `AdmissionRequest` with stable invocation key, selected binding/revisions, maximum permitted units and deadline. OIC-6 returns reservation ID or explicit denial. After each provider attempt: immutable observed usage/receipt with attempt ID, raw units, provenance and completion state. Unknown usage stays pending. Admission and capture are server-only. |
| OIC-6 → OIC-7 | Evaluation run carries OIC-6 reservation/budget ID; each case links its own metering postings. Cost/OIU may be unknown, pending, estimated or reconciled; comparisons cannot silently treat unknown as zero. OIC-7 cannot bypass OIC-6 even for internal evaluation. |
| OIC-7 → OIC-8 | Immutable evaluation report IDs plus suite, dataset, metric/judge revisions, sample/uncertainty, holdout access decision and promotion verdict. OIC-8 sees sealed report/aggregate, never protected answers. |
| OIC-8 → OIC-7 | Proposal creates an immutable candidate target and requests evaluation under explicit budget. OIC-7 evaluates independently. Rejected/insufficient evidence returns a blocking verdict; no promotion side effect. |
| Promotion → Runtime | Authorized command uses candidate ID, approved verdict digest, expected current binding revision, scope and rollout policy. Compare-and-swap changes only the scoped binding pointer; previous pointer is retained for rollback. Runtime resolves committed state at invocation start. |

All APIs authenticate before authorization, enforce application/tenant scope on both write and read, validate payload and revision digest, use distinct idempotency namespaces, and return correlation IDs. A command response is not evidence of provider success; readback confirms committed state. Sensitive content and provider secrets are excluded from generic evidence, audit metadata and Console snapshots.
