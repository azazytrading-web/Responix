# Adversarial review and lock-readiness audit

**Review date:** 2026-10-11. This records the owner-approved OIC-6 through OIC-9 v1.0 architecture lock; a locked architecture does not mean implementation or certification has started. OIC-9 scope is owner-approved. Attacks below are against the design, not performed on live services. Findings produced explicit protocol requirements in the deep documents.

| Domain | Attack / false conclusion | Required prevention or safe outcome |
|---|---|---|
| OIC-6 | Concurrent reservations overspend a hot bucket | Lock all applicable bucket rows in deterministic order and commit holds atomically; bounded serialization retry, then deny busy. |
| OIC-6 | Duplicate provider callback/retry double consumes | Unique attempt+receipt sequence and digest; same replay returns result, conflicting replay quarantines; physical retry charged separately. |
| OIC-6 | Process dies after provider dispatch but before accounting | Persist attempt before call; retain uncertain liability and reconcile, never release on timeout alone. |
| OIC-6 | Price/plan changes mid-request | Pin effective revisions at admission and rate event time; old assessment retains rate snapshot. |
| OIC-6 | Missing FX/usage or free allowance appears as zero | Availability states and separate native currency; no commercial rating/remaining quota assumption. |
| OIC-6 | Tenant override or ledger reversal bypasses safety | Publication conflict validation, authorization, correction chain and projection rebuild; override cannot grant security scope. |
| OIC-6 | Negative/overflow/rounding drift or high-volume hot row | Fixed decimal, one defined rounding boundary, reject invalid, property tests; throttle/partition only with equivalent semantics. |
| OIC-7 | Easy-case selection, missing hard cases, lucky run | Preregister case manifest/trials/slices, report all planned/attempted/missing, minimum n, no post hoc exclusions. |
| OIC-7 | Candidate saw public/holdout answers or generated oracle | Tiered ACL, generator firewall, independent oracle, exposure invalidates release; public practice cannot certify promotion. |
| OIC-7 | Verbose answer wins biased judge or changed judge | Blind randomized order, verbosity calibration, anchor drift checks and pinned judge revision. |
| OIC-7 | Old model score compared with changed benchmark | Comparable-result contract rejects release/metric/cohort mismatch unless validated bridge. |
| OIC-7 | Aggregate win hides safety/Arabic regression | Critical slice gates independent of aggregate; wide interval or insufficient slice blocks promotion. |
| OIC-7 | Coding model edits tests, stubs output or uses network | Sealed evaluator tests outside writable sandbox, allowed-diff check, egress deny and oracle integrity hash. |
| OIC-7 | Sales simulator rewards pressure, unauthorized discount or false claims | Separate customer fit, policy, truth, consent and outcome; critical policy failure overrides deal-state reward. |
| OIC-7 | Stale/configured/tiny-sample DNA shown as measured | Trait definition revision, context/interval/freshness/availability required; radar only comparable measured points. |
| OIC-7 | Retry double-counts score or hides cost | One logical trial result with separate physical attempts; all provider costs retained, ambiguous result inconclusive. |
| OIC-8 | Optimizer learns holdout answers or ignores negative results | Only aggregate sealed verdict; source ACL/firewall; immutable contrary evidence and attempt limits. |
| OIC-8 | Proposal grants access, edits Memory/Knowledge or promotes itself | Target allowlist and no production write credential; OIC-7 guarded command plus human approval. |
| OIC-8 | Unlimited candidate spend or one-metric gaming | Finite candidate count/OIC-6 budget; preregistered multi-objective critical guardrails. |
| OIC-8 | Promotion succeeds but verification fails | State becomes `UNVERIFIED`, freeze expansion and review rollback; no success claim. |
| OIC-9 | Backup DB and async state diverge | DB/outbox authority, fenced replay, no blind provider re-call, ledger/artifact/audit integrity scan before open. |
| OIC-9 | Partial migration deployed or worker runs twice | Expand/backfill/verify/cutover/contract gates, idempotent job keys and fencing; fail closed where required. |
| OIC-9 | Quota service overload or protected answer leaks through logs | Fair limits/backpressure and audit capacity; content-free generic logs, protected artifact ACL/scan. |
| OIC-7 | Base model appears below an agent system on a universal leaderboard | EPM target class and harness digest partition families; `TARGET_CLASS_MISMATCH` forbids ranking. |
| OIC-7 | Same model with changed agent loop falsely appears improved | Harness/scaffold revision is EPM field; changed revision is descriptive unless validated bridge. |
| OIC-7 | Imported self-reported benchmark appears OIC-verified | Verification tier is mandatory; imported/self-reported never default promotion eligible. |
| OIC-7 | Target cost looks low because judge/sandbox work is omitted | Passport separates target execution cost from total evaluation infrastructure cost, with coverage. |
| OIC-9 | Missing test artifact marked PASS or waived indefinitely | Requirement evidence digest/freshness enforced; missing is NOT_EVALUATED, waiver scoped/expiring and blocking controls nonwaivable. |

## Reinterpretation and simplicity review

Critical choices have one reading: OIU six-decimal half-even once after exact dimension sum; each matching hard quota leg reserves in one DB transaction; customer rating is a separate immutable calculation, not invoice; comparison requires pinned release/cohort/method and preregistered uncertainty; judge scores retain revision/calibration; DNA is contextual measured evidence with availability; promotion is OIC-7-owned CAS with fresh PASS and human approval; rollback is a new guarded pointer change. A different business price or SLO target is an activation decision, not a chance to change these semantics.

Removed/deferred: no giant universal ledger or score, no separate Scenario table in V1, no general billing/tax engine, no Redis quota authority, no broad OIC-9 topology rewrite. V1 required advanced concepts are sealed holdout, evidence graph, pairwise uncertainty where comparison is claimed, physical-attempt accounting and fenced work. IRT, Elo/Bradley-Terry, adaptive evaluation, auto-generated cases in production, auto-promotion, online learning and complex commercial contracts are future extensions, each behind a revisioned method or activation gate.

## Lock readiness matrix

| Milestone | Candidate status | Remaining activation decision, not design ambiguity |
|---|---|---|
| OIC-6 | ARCHITECTURE LOCKED - IMPLEMENTATION NOT STARTED | External charging/overage, legal invoice/tax integration and retention schedule need owner decision before activation. |
| OIC-7 | ARCHITECTURE LOCKED - IMPLEMENTATION NOT STARTED | Tenant-derived sealed datasets need rights approval; benchmark quality and promotion require measured acceptance evidence during implementation. |
| OIC-8 | ARCHITECTURE LOCKED - IMPLEMENTATION NOT STARTED | Any automatic promotion or online learning needs separate owner/security decision; default disabled. |
| OIC-9 | ARCHITECTURE LOCKED - IMPLEMENTATION NOT STARTED; approved hardening/resilience/certification scope | SLO/RPO/RTO numerical targets require later activation decision; no certification claim yet. |

**Luna handoff:** YES for the bounded packets in [exact handoff](54_PACKET_HANDOFF.md) under the owner-approved architecture lock. Each packet has entities/migration/services/commands/queries/endpoints/jobs/UI/tests/rollout/owner gate and points to the exact domain contract. Sol-level rearchitecture is not required for the safe foundation packets; advanced methods and business activation remain explicit future decisions. This matrix does not declare OIC-6–9 implementation started or GO.
