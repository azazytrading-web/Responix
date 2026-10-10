# Terminology and permanent invariants

> **HISTORICAL / DIRECTIONAL PREDECESSOR - NOT ACTIVE IMPLEMENTATION AUTHORITY.** The owner-approved OIC-6 through OIC-9 v1.0 lock in [the canonical OIC-6 to OIC-9 architecture](../oic-6-9/00_MASTER_ARCHITECTURE_LOCK_MANIFEST.md) supersedes this material for implementation. Retained for historical context; do not use to override the locked package.


| Term | Exact meaning |
|---|---|
| Raw usage / provider usage | OIC-observed resource dimensions / provider-reported dimensions; retain both with source and missingness. |
| OIU | Internal normalized intelligence consumption unit, derived from raw dimensions by a versioned policy; neither currency, price, token nor request. |
| Cost / price / value | Provider expense evidence / customer-facing charge schedule if ever approved / business utility estimate; distinct from OIU. |
| Entitlement / allowance / quota / limit | Permission to consume / granted quantity / scoped windowed accounting rule / threshold applied to that rule. |
| Reservation / consumption / adjustment / reconciliation | Pre-call hold / observed usage posting / explicit correction posting / comparison and settlement against external evidence. |
| Plan / policy / override | Revisioned bundle of entitlements / deterministic rule set / scoped, expiring, audited exception. |
| Evaluation / run / case / suite / dataset / benchmark | Measurement process / one execution instance / one immutable input and rubric / revisioned case selection and metrics / immutable case collection / governed reusable comparison set. |
| Metric / score / measurement / judge / evidence | Versioned calculation / reported metric result / result with context and provenance / human or model evaluator / immutable observations supporting it. |
| Baseline / candidate / champion | Pinned comparator / proposed immutable configuration / currently promoted binding for a scope. No universal winner. |
| Model DNA / trait / confidence / provenance | Contextual profile of measured traits / versioned measured dimension / statistical or evidence quality statement / traceable source and derivation. |
| Learning signal / hypothesis / proposal / experiment | Observed pattern / falsifiable explanation / reviewed candidate change / bounded evaluation and rollout plan. |
| Promotion / rollback | Authorized compare-and-swap of scoped production pointer / new authorized pointer change back to a known prior revision. |

**Invariants:** Unknown is not zero. Configured is not measured. Provider cost is not customer price or OIU. Cached/estimated/actual usage remains labeled. A stale, missing or incompatible evaluation cannot yield a passing promotion verdict. Every execution, accounting post, score and proposal has application/tenant scope and immutable source/revision references. An OIC-8 proposal cannot read protected holdout answers, grant permissions, write credentials, rewrite contrary evidence, change production directly, or silently self-write Memory/Knowledge. Human approval is the default for promotion. Audit events record commands; domain evidence records observations, each with independent retention and access controls. No hidden chain-of-thought storage/exposure. No cross-product database or implementation.
