# Precision blueprint — entities, state machines and consequential commands

Normative design, not a migration. All IDs UUID, FK scope checked with `(tenantId, applicationId)` where tenant exists. `A/T` = application and optional tenant; `G` = OIC-global internal admin. `I` = immutable after publish/create; `S` = mutable only through guarded state transition; `P` = rebuildable projection. No hard delete of referenced economic/evaluation/promotion/certification evidence; content may be redacted by governed retention while ID/digest/availability survives. Retention classes: `FIN` economic, `EVID` evaluation, `CTRL` configuration/decision, `OPS` incident/certification; actual durations require owner policy. Every entity has created/recorded timestamps, producer and audit correlation. Indexes below are expected query indexes, not SQL migration instructions.

| Entity | Scope; immutable vs mutable; revision/state; unique/FK | Write authority; deletion/retention; expected indexes |
|---|---|
| ProviderPriceBookRevision + Rate | G or A/T; I rates, currency, units, effective interval, source/digest; draft→published→retired; unique selector+precedence+nonoverlap; FK provider connection/upstream model | Economics admin; no referenced delete/FIN; selector+time, revision ID |
| OiuPolicyRevision | G/A/T; I weights, dimension handling, rounding/digest; numbered published revision unique policy+revision | Economics admin; CTRL/FIN refs; scope+effective time |
| CustomerPriceBookRevision | A/T; I typed strategy/params/currency/digest; draft→published→retired; unique scope+revision and nonoverlap; FK plan/contract if used | Commercial admin; FIN; scope+effective time |
| PlanRevision + Assignment | A/T; I plan rules; S assignment interval/status; unique plan+revision and effective assignment per priority/scope; FK application/tenant | Policy admin; CTRL/FIN; scope+effective time/status |
| QuotaPolicyRevision + BudgetRevision | A/T; I unit/window/limit/max liability and budget amount/deadline; unique policy+revision; FK plan/assignment/campaign | Policy admin; FIN; scope+dimension+effective time |
| Admission + ReservationLeg | A/T; I request hash/pinned revisions/amount/window; S dispatch/settlement/fence; unique scope+operation+key and admission+bucket; FK plan/policy/bucket | Runtime/admission only; FIN; bucket+state+expiry, key unique |
| ProviderAttempt + UsageEvent | A/T; I physical attempt/receipt/digest/raw units; S attempt outcome; unique attempt key and receipt+sequence; FK reservation/execution/provider | Trusted runtime only; FIN; attempt/status/time and source unique |
| UsagePosting + QuotaBalance | A/T; I posting type/amount/source/group; P balance and last sequence; unique source+policy+kind+sequence; FK bucket/attempt/original for adjustment | Accounting transaction only; FIN no delete; bucket+sequence, scope+time |
| CostAssessment + RatedUsageEvent | A/T; I native amount/currency/evidence/policy/rate snapshot and adjustment reference; unique source+revision+kind; FK attempt/usage/price book | Rating/reconciliation only; FIN; source+revision, scope+time |
| BenchmarkRelease + Pack/Dataset/Case/Suite/EnvironmentRevision | G or restricted A/T; I published manifest/content digests/rights/tier; S release status; unique owner+revision/digest; FKs pack→datasets/cases/suite/environment | Registry admin; CTRL/EVID; domain+tier+status, hash |
| EvaluationProtocolManifest | A/T; I canonical payload/digest/target class/harness; unique digest within scope; FKs release/suite/target/revisions | Protocol publisher; EVID; digest, target+release |
| Run + CaseExecution + Attempt | A/T; I plan/case/repetition/target; S run/case/physical attempt status/fence; unique run+case+repetition and physical key; FKs EPM/admission | Scheduler/runner only; EVID/FIN link; status+lease, run+case |
| Metric/JudgeRevision + Measurement | G or A/T definitions; I published methods/score/evidence; unique metric/judge revision and logical case+metric+judge+method; FKs attempt/artifact | Evaluator only; EVID; scope+run+metric, artifact ID |
| Report + Comparison + Verdict | A/T; I inputs/method/digest/availability and decision eligibility; S verdict expiry/invalidation marker via separate supersession; unique run+analysis revision/report and comparison+gate revision; FKs measurements/reports | Report/gate service; EVID/CTRL; target+release, verdict+expiry |
| DNA projection | A/T; I derived trait/context/value/interval/source report digest, supersedesId; unique target+trait+context+source set+method; FK trait/report | Projection worker only, **no edit command**; EVID; target+trait+context+time |
| Candidate + PromotionDecision | A/T; I parent/diff/verdict/expected pointer/prior pointer; S candidate/promotion state; unique parent+diff+policy and scope+idempotency; FK model/profile/binding/report | Candidate service; OIC-7 privileged promotion only; CTRL/EVID; scope+binding+time |
| Signal + Hypothesis + Proposal | A/T; I source IDs/negative evidence/diff/policy; S proposal status; unique signal source+window+policy and proposal parent+digest; FK evidence/candidate | OIC-8 only; EVID/CTRL; scope+state/cohort/time |
| CertificationRequirement/Result/ReleaseCertification | G or release scope; I method/evidence/status/digest; S run until finalized; unique release digest+protocol revision+environment and run+requirement; FK artifacts/incident | OIC-9 certification operator, independent approver; OPS; release+status/time |

## Durable state tables

| Object / state | Entered by | Allowed next | Terminal? | Retryable? / recovery |
|---|---|---|---|---|
| Reservation `HELD` | atomic Admit | `DISPATCHED|RELEASED` | no | Safe release only with proof no attempt; fenced lease. |
| Reservation `DISPATCHED` | persist attempt pre-network | `SETTLING|UNCERTAIN` | no | Crash becomes uncertain; no timeout-only release. |
| Reservation `UNCERTAIN` | ambiguous dispatch/usage | `SETTLING|RELEASED` | no | Reconcile external evidence; write-off requires approval. |
| Reservation `SETTLING` | receipt accepted | `SETTLED|UNCERTAIN` | no | Idempotent posting replay by receipt key. |
| Reservation `SETTLED|RELEASED` | posting/proof | none | yes | Reopen only via new adjustment case, not state overwrite. |
| Case `QUEUED|RESERVED|RUNNING` | scheduler/admission/runner | `RUNNING|CAPTURED|UNCERTAIN|CANCEL_PENDING|BUDGET_BLOCKED` as applicable | no | Fenced lease; physical retry distinct from repetition. |
| Case `CAPTURED|SCORED` | artifact/oracle | `SCORED|COMPLETE|INCONCLUSIVE` | no | Digest/readback; scoring replay logical-key idempotent. |
| Case `COMPLETE|INCONCLUSIVE|CANCELLED|BUDGET_BLOCKED` | report/cancel/budget | none | yes | New run/regrade for new interpretation. |
| Candidate `DRAFT|EVALUATING|REVIEWABLE|APPROVED` | author/evaluator/gate/human | next sequential or `REJECTED|EXPIRED|QUARANTINED` | no | Stale source forces new evaluation, not bypass. |
| Candidate `PROMOTING|PROMOTED|MONITORING` | OIC-7 CAS/readback | `PROMOTED|MONITORING|VERIFIED|UNVERIFIED|ROLLED_BACK` | no | Ack loss reads pointer/decision; rollback new CAS. |
| Certification `OPEN|EVALUATING` | OIC-9 operator | `EVALUATING|FINALIZED` | no | Resume requirements; no optimistic PASS. |
| Certification `FINALIZED` | independent approval | none | yes | New run supersedes; failed evidence revokes scope. |

## High-consequence command contracts

| Command | Permission, idempotency, preconditions and transaction | Audit/result/readback/errors |
|---|---|---|
| `Admit` | Trusted runtime; unique scope+operation+key and payload hash; pinned plan/binding, bounded size; serializable lock *all* hard buckets; reserve+posting+outbox atomically | Audit policy decision; read reservation/balances; `NOT_ENTITLED|EXHAUSTED|UNKNOWN_BOUND|CONFLICT|BUSY`. |
| `RecordReceipt/Settle` | Trusted attempt producer/fence, unique receipt digest; usage event, consume/release and projection one transaction | Audit source/conflict; read posting group and liability; `RECEIPT_CONFLICT|UNCERTAIN|STALE_FENCE`. |
| `Reconcile/Adjust` | Economics role and second approval above policy threshold; same-scope original/source; append adjustment+projection transaction | Audit reason/evidence; rebuild/read chain; `SOURCE_MISSING|ALREADY_APPLIED|SCOPE_DENIED`. |
| `PublishPack/EPM` | Registry role, idempotency digest; rights/holdout/oracle/harness validation; publish immutable revision+audit in transaction | Read release/manifest hash; `RIGHTS_DENIED|ORACLE_INVALID|DUPLICATE|EXPOSURE`. |
| `StartRun` | Evaluation role, exact EPM/release and OIC-6 budget; create run/case work/outbox one transaction | Read planned denominator/job IDs; `BUDGET_BLOCKED|RELEASE_INVALID|TARGET_UNSUPPORTED`. |
| `Score/Compare/Verdict` | Fenced evaluator/gate service; complete artifact, pinned revisions and comparable method; immutable result write | Read graph/eligibility/reasons; `INCOMPLETE|NOT_COMPARABLE|HOLDOUT_COMPROMISED`. |
| `Promote/Rollback` | Privileged human distinct from evaluator editor, idempotency key; PASS fresh verdict or documented emergency rollback, expected binding version; decision+CAS+audit transaction | Read binding/prior pointer; `STALE_BINDING|VERDICT_EXPIRED|SCOPE_DENIED|READBACK_MISMATCH`. |
| `CertifyRelease` | OIC-9 independent approver; exact release/protocol digest, all blocking evidence; finalize immutable artifact in transaction | Read signed matrix; `MISSING_EVIDENCE|BLOCKING_FAIL|INVALID_WAIVER|RESTORE_UNVERIFIED`. |

All command responses include ID, committed revision, correlation and retry semantics. A failed DB transaction has no success response; retries inspect committed idempotency record before repeating external work. Queries and jobs follow the [catalog](50_ENTITY_COMMAND_AND_JOB_BLUEPRINTS.md).
