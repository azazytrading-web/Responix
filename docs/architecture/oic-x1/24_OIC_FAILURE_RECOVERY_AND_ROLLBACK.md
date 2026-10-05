# OIC Failure, Recovery and Rollback Architecture

**Status:** DECIDED recovery contract. API/domain behavior remains the source of truth; this document does not add transactions, undo endpoints or retries. Related: [commands](22_OIC_ACTION_COMMAND_EVENT_ARCHITECTURE.md), [drafts](14_OIC_REACTIVE_CONFIGURATION_ARCHITECTURE.md), [acceptance](20_OIC_ACCEPTANCE_ARCHITECTURE.md).

## Failure classes and operator surfaces

| Class | Meaning | Default surface / next step |
|---|---|---|
| VALIDATION FAILURE | Request or domain values violate constraints. | Inline field errors and safe summary; preserve draft for correction. |
| AUTHORIZATION FAILURE | Session, origin or API scope rejects action. | Action feedback with safe access explanation; do not present as empty or retry. |
| CONFLICT | Expected revision/state no longer matches or unique/domain constraint conflicts. | Blocking conflict panel; reload/compare before a new explicit submit. |
| NETWORK FAILURE | No trustworthy response reached client. | Mark outcome unknown for mutations; reconcile from authoritative read before retry. |
| TIMEOUT | Client stopped waiting; server may still have applied mutation. | Outcome unknown; reconcile first. Never infer failure or success solely from timeout. |
| PARTIAL SUCCESS | Primary mutation succeeded but one or more dependent actions/refreshes failed. | Preserve separate outcomes and affected counts; offer safe inspect/retry only for failed supported steps. |
| DEPENDENCY FAILURE | Required provider/database/service unavailable. | Contextual warning or incident with source and safe correlation; retry only after recovery condition. |
| SERVER FAILURE | API/BFF unexpected failure. | Action feedback; retain safe draft; include request/correlation id. |
| STALE DATA | Input/source changed or freshness policy elapsed. | Mark observation/draft stale; refresh or compare before consequential submission. |
| UNAVAILABLE SOURCE | No source response/value can be produced. | Feature/data unavailable state; distinguish from zero and not-authorized. |

Use inline errors for field-level repair, action status for one operation, blocking dialog only when continuing could cause harm, contextual warning for non-blocking degradation, and system incident for a broad source failure. “Inspect details” exposes sanitized error/correlation data, never secrets or private reasoning.

## Outcome, retry and reconciliation

Mutation and follow-up refresh are separate outcomes. Example: `CHANGE APPLIED — dependent refresh PARTIAL; 2 targets confirmed, 1 target could not be read. [Inspect] [Retry read]`. A refresh retry is not a mutation retry. If a downstream propagation is a distinct supported operation, identify its targets and retry only failed targets after authorization and state reconciliation.

`RETRY` repeats an operation only when its endpoint contract makes that safe; `RECONCILE` performs an authoritative read to learn current persisted state; `RESTORE PREVIOUS CONFIGURATION` is a new explicit, authorized write based on a saved revision; `MANUAL RECOVERY` is an operator-guided action outside automatic assumptions. `ROLLBACK` means backend-supported atomic reversal of the original operation. Never use “rollback” for a compensating write or imply it exists without a documented API transaction/undo contract.

If a mutation times out or loses its response, show `outcome unknown`, retain the command correlation id, and reconcile with a read. Retry only if the specific endpoint supports idempotency with the same key and request semantics. Idempotency exists for selected runtime invocation behavior; streaming replay is explicitly unsupported, and this must not be generalized to Console admin mutations. Do not auto-retry RUN, SYNC, credential actions, or broad-scope changes.

## Draft, confirmation and concurrent editors

Editing states: `SAVED`, `DIRTY`, `INVALID`, `VALIDATING`, `READY`, `SUBMITTING`, `APPLIED`, `FAILED`. Dirty edits remain local until explicit save. Navigation warns before discarding; “discard” resets to the last loaded/saved revision. Failed validation retains repairable draft. Sensitive/high-impact writes show server-confirmed result; do not optimistically present persisted state.

On revision conflict or stale editor input, preserve the local draft, fetch the current server revision, and show a semantic configuration diff so the operator can compare, discard, or deliberately rebase/re-enter. Do not silently overwrite or merge unknown structured policy. Two tabs are independent editors; there is no collaborative live editing contract. Current model revisions are append-only and unique, but OIC does not expose a generic expected-revision/ETag/If-Match guard across mutations. Consequential mutable edits need an API-owned conditional version contract before implementation; where absent, disclose the limitation and avoid presenting stale-state safety as guaranteed.

Optimistic concurrency UI is therefore only a future interaction shape until the endpoint carries and enforces the expected version. For a detected conflict, no blind resubmit. A prior configuration may be restored only as a new versioned write when the domain supports it and the operator confirms scope and impact.

The shared draft/command state machines, timeout classification, retained work and reconcile presentation are contracted in [34](34_OIC_INTERFACE_STATE_PERMISSION_MACHINE.md) and [32](32_OIC_REACTIVE_CONFIGURATION_SYSTEM.md). These contracts preserve the limits above; X1.3A creates no endpoint, generic rollback, conditional-write guarantee or safe retry assumption.
