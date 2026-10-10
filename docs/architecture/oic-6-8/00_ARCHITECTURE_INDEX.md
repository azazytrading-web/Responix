# OIC-6 through OIC-8 master architecture - historical / directional predecessor

> **HISTORICAL / DIRECTIONAL PREDECESSOR - NOT ACTIVE IMPLEMENTATION AUTHORITY.** The owner-approved OIC-6 through OIC-9 v1.0 lock in [the canonical OIC-6 to OIC-9 architecture](../oic-6-9/00_MASTER_ARCHITECTURE_LOCK_MANIFEST.md) supersedes this material for implementation. Retained for historical context; do not use to override the locked package.

**Canonical authority:** The owner-approved [OIC-6 to OIC-9 master architecture v1.0](../oic-6-9/00_MASTER_ARCHITECTURE_LOCK_MANIFEST.md) is the sole active implementation authority. This package is historical/directional predecessor material and remains preserved for context.

**Historical status at creation (2026-10-10):** ARCHITECTURE PROPOSED - OWNER REVIEW PENDING. Superseded by the owner-approved v1.0 architecture lock dated 2026-10-11. OIC-6 through OIC-9 implementation remains NOT STARTED. OIC-X1 remains CLOSED / FROZEN / GO. This package changes no product code, schema, API, or runtime behavior.

Dependency: runtime execution → OIC-6 admission/accounting → OIC-7 reproducible evaluation → OIC-8 controlled proposals → OIC-7 validation → human-authorized promotion. OIC-6 enforces quotas without depending on OIC-7/8. OIC-8 cannot mutate production directly.

| Document | Purpose |
|---|---|
| [01](01_CURRENT_STATE_AND_CONSTRAINTS.md) | Repository source map and gaps |
| [02](02_CROSS_MILESTONE_CONTRACTS.md) | Identities, evidence, revisions, timestamps, integration envelopes |
| [03](03_SHARED_INVARIANTS_AND_TERMINOLOGY.md) | Terms, truth, scope, safety invariants |
| [OIC-6](oic-6/10_OIC6_ACCOUNTING_AND_CONTROL.md) | OIU, usage ledger, pricing, plans, entitlements, quotas, runtime enforcement, API/UI |
| [OIC-7](oic-7/20_OIC7_EVALUATION_AND_EVOLUTION.md) | Evaluation engine, statistics, judges, measured DNA, candidates, promotion |
| [OIC-8](oic-8/30_OIC8_CONTROLLED_LEARNING.md) | Signals, proposals, validation, bounded deployment, rollback |
| [Shared operations](cross-cutting/40_EXECUTION_SECURITY_AND_OPERATIONS.md) | Async work, tenancy, privacy, recovery, scale, migration |
| [Decisions](cross-cutting/46_ARCHITECTURE_DECISION_LOG.md) | Explicit decisions, tradeoffs, business choices, risks |
| [Roadmap and acceptance](cross-cutting/47_ROADMAP_AND_ACCEPTANCE.md) | Bounded implementation packets and acceptance matrix |

These retained documents describe the directional predecessor and may use proposal language reflecting their original review state. They are not the active implementation authority. Table and endpoint names are design names, not existing repository objects; implementation is not started by locking the architecture.
