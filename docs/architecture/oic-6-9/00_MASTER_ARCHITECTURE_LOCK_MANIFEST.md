# OIC-6 through OIC-9 master architecture v1.0

**STATUS: ARCHITECTURE LOCKED**<br>
**OWNER APPROVED: YES**<br>
**LOCK VERSION: v1.0**<br>
**CANONICAL ROOT: `docs/architecture/oic-6-9/`**<br>
**IMPLEMENTATION AUTHORITY:** This package is the source of truth for OIC-6 through OIC-9 implementation. Every implementation packet must conform to it.<br>
**MILESTONE STATE:** OIC-6, OIC-7, OIC-8, and OIC-9 are each **ARCHITECTURE LOCKED — IMPLEMENTATION NOT STARTED**.

The owner approved this architecture on 2026-10-11. Locking architecture does not start implementation. OIC-X1 remains CLOSED / FROZEN / GO; OIC-1 through OIC-5 remain complete. No application source, database schema, migration, API, or runtime behavior is changed by this documentation package.

The retained [OIC-6–8 directional predecessor](../oic-6-8/00_ARCHITECTURE_INDEX.md) is historical and is superseded as active implementation authority by this v1.0 package. Its useful historical context is preserved. The current milestone record and first return point are in [OIC-6–9 architecture lock state](../../project-state/OIC_6_9_ARCHITECTURE_LOCK.md).

## Locked interpretation and amendment rule

Implementation may clarify code-level details but may not silently change domain semantics, economic separation, quota/reservation invariants, evaluation comparability, benchmark protocol, holdout firewall, Model DNA provenance, promotion boundaries, learning firewall, or certification semantics. Detailed contracts below are binding together with this manifest; where a baseline conflicts with a precise v1.0 contract, the v1.0 contract governs.

Locked architecture may be amended only when implementation discovers a contradiction, impossible invariant, security defect, integrity defect, unavoidable provider/platform constraint, or materially incorrect repository assumption. Preference, naming, cosmetic UI, convenience, or speculative future features do not justify reopening architecture. Every amendment records the problem, affected contract, decision, compatibility impact, and migration impact. A material amendment requires explicit owner approval and an updated versioned decision record before implementation proceeds.

## Locked cross-milestone contract

1. **OIC-6** records accountable usage, provider economics, entitlements, quota, reservation, and immutable evidence. OIC-6 accounting truth is not rewritten by evaluation. Customer legal invoicing and payment settlement are outside OIC by default.
2. **OIC-7** produces reproducible evaluation, comparability, measurement, contextual Model DNA, and governed evolution evidence. It does not directly self-promote production targets.
3. **OIC-8** turns eligible signals into bounded proposals and immutable candidates. Every candidate returns through OIC-7 evaluation; an authorized promotion decision and verification follow. OIC-8 cannot bypass OIC-7 or directly write production bindings.
4. **OIC-9** supplies production hardening, resilience, certification, and final operational closure. Certification does not fabricate missing evidence or replace OIC-6/7/8 domain gates.

Permanent flow: **OIC-6 evidence → OIC-7 evaluation → OIC-8 proposal/candidate → OIC-7 validation → authorized promotion → verification → OIC-9 certification.** Negative, rejected, failed, partial, and inconclusive evidence remains visible and retained under policy.

## OIC-9 approved scope

The owner-approved OIC-9 scope is **production hardening, resilience, certification, and final operational closure**. Numerical SLO, RPO, RTO, and capacity thresholds are later operational activation decisions; they do not block this architecture lock. No certification or runtime readiness is claimed by locking the design.

## Non-blocking activation decisions and safe defaults

These decisions do not block safe implementation foundations: commercial customer charging, paid overage, exact retention durations, tenant-derived protected benchmark datasets, automatic production promotion, numerical SLO/RPO/RTO targets, and final capacity thresholds.

| Concern | Locked safe default |
|---|---|
| Customer legal invoicing, tax, and payment settlement | Outside OIC |
| Paid overage and external billing | Disabled |
| Automatic production promotion | Disabled; human-authorized OIC-7 gate required |
| Online autonomous learning | Disabled |
| Tenant-derived protected learning | Disabled absent separate rights/owner approval |
| Unknown usage or provider cost | Never zero; preserve unknown/pending liability |
| Unverified external evaluation | Not promotion eligible by default |
| Incomparable results | No winner and no direct ranking |
| Missing certification evidence | Never PASS |

## Locked OIC-6 invariants

- Provider expense, OIU, customer rated charge, quota, and entitlement are distinct concepts and records.
- Historical pricing and OIU policies are revisioned and reproducible; immutable usage/economic evidence is append-only under the journal contract.
- Hard quota admission/reservation is atomic across every matching hard-limit bucket; failure denies dispatch. Unknown provider liability is not zero.
- Free/trial customer charge does not erase raw usage, provider expense, or OIU evidence. Economic summaries are rebuildable from authoritative journals.
- Customer legal invoice/payment settlement remains outside OIC by default.

## Locked OIC-7 invariants

- An immutable Evaluation Protocol Manifest (EPM) and target class are required; harness identity is first-class comparability evidence. Incompatible target classes or harnesses are not directly comparable.
- Infrastructure retry is not stochastic repetition. Logical cases, repetitions, and physical attempts remain distinct and cost-accounted.
- Protected holdout firewall and canonical Benchmark Pack extension contracts are required.
- DNA is a contextual, derived evidence projection. Configured/declared values are not measured DNA; profile-conditioned results do not populate universal base-model DNA unless the trait definition explicitly permits it.
- Incomparable results produce no winner. Target execution cost is distinct from total evaluation/judge/simulator cost. Environment failure is not automatically model failure.
- A measurement is not automatically decision eligible. Leaderboards require domain/target/protocol eligibility. There is no universal single intelligence score as source of truth.

## Locked OIC-8 invariants

The flow is **signal → proposal → immutable candidate → OIC-7 evaluation → authorized decision → controlled promotion → verification**. There is no proposal-to-production shortcut. OIC-8 cannot read protected holdout answers and has no direct production-binding write authority outside the locked promotion command path. Negative evidence is retained.

## Locked OIC-9 certification invariants

Missing evidence is not PASS; existence of a restore is not restore certification; a backup is insufficient without tested restoration. Waivers carry explicit actor, reason, scope, and review/expiry semantics; critical controls are non-waivable. Release certification is evidence-backed, and failed or partial certification remains visible.

## Canonical document map

| Contract | Source |
|---|---|
| Current repository source map and shared baseline contracts | [Historical source map](../oic-6-8/01_CURRENT_STATE_AND_CONSTRAINTS.md), [cross-milestone contracts](../oic-6-8/02_CROSS_MILESTONE_CONTRACTS.md), and [shared invariants](../oic-6-8/03_SHARED_INVARIANTS_AND_TERMINOLOGY.md), read with this lock |
| OIC-6 accounting, economics, and quota | [OIC-6 baseline](../oic-6-8/oic-6/10_OIC6_ACCOUNTING_AND_CONTROL.md), [economic layers and rating](oic-6/11_ECONOMIC_LAYERS_AND_RATING.md), [admission ledger and reconciliation](oic-6/12_ADMISSION_LEDGER_AND_RECONCILIATION.md) |
| OIC-7 domains, execution, evidence, DNA, and comparability | [OIC-7 baseline](../oic-6-8/oic-7/20_OIC7_EVALUATION_AND_EVOLUTION.md), [domain registry](oic-7/21_DOMAIN_REGISTRY_AND_BENCHMARKS.md), [environments and oracles](oic-7/22_EXECUTION_ENVIRONMENTS_AND_ORACLES.md), [scheduler and evidence](oic-7/23_SCHEDULER_EVIDENCE_AND_BUDGETS.md), [metrics and judges](oic-7/24_METRICS_JUDGES_AND_STATISTICS.md), [DNA and promotion](oic-7/25_DNA_EVOLUTION_AND_PROMOTION.md), [EPM and comparability](oic-7/26_EVALUATION_PROTOCOL_AND_COMPARABILITY.md), [packs and holdout firewall](oic-7/27_PACKS_DOMAINS_AND_HOLDOUT_FIREWALL.md) |
| OIC-8 proposal and learning firewall | [OIC-8 baseline](../oic-6-8/oic-8/30_OIC8_CONTROLLED_LEARNING.md), [proposal factory and firewall](oic-8/31_PROPOSAL_FACTORY_AND_FIREWALL.md) |
| OIC-9 hardening, resilience, and certification | [OIC-9 reliability and certification](oic-9/40_RELIABILITY_DR_AND_CERTIFICATION.md) |
| Entity, command, state, packet, acceptance, and red-team detail | [Entity/job blueprints](cross-cutting/50_ENTITY_COMMAND_AND_JOB_BLUEPRINTS.md), [lock audit](cross-cutting/51_RED_TEAM_AND_LOCK_READINESS.md), [packet acceptance](cross-cutting/52_IMPLEMENTATION_PACKETS_AND_ACCEPTANCE.md), [precise entity/state contracts](cross-cutting/53_PRECISE_ENTITIES_STATES_COMMANDS.md), [ordered handoff](cross-cutting/54_PACKET_HANDOFF.md) |
| Decision and amendment history | [Architecture decision log](../oic-6-8/cross-cutting/46_ARCHITECTURE_DECISION_LOG.md) |

## Frozen implementation order and return point

The default owner execution order is exactly: **OIC-6 6.1 → 6.2 → 6.3 → 6.4; then OIC-7 7.1 → 7.2 → 7.3 → 7.4 → 7.5 → 7.6 → 7.7; then OIC-8 8.1 → 8.2 → 8.3; then OIC-9 9.1 → 9.2 → 9.3.** Packet names, dependencies, prerequisites, scope, and acceptance gates are frozen in the [ordered handoff](cross-cutting/54_PACKET_HANDOFF.md).

**NEXT IMPLEMENTATION RETURN POINT: OIC-6.1 — Raw evidence.** This is a documentation handoff only; OIC-6.1 is not started or implemented by this lock.
