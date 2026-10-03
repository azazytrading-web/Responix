# OIC Action, Command and Event Architecture

**Status:** DECIDED interaction contract. Current API/BFF behavior is not a universal command bus. Related: [reactive configuration](14_OIC_REACTIVE_CONFIGURATION_ARCHITECTURE.md), [permissions](23_OIC_PERMISSION_AWARE_OPERATOR_UX.md), [recovery](24_OIC_FAILURE_RECOVERY_AND_ROLLBACK.md).

## Command pipeline

`OPERATOR INTENT → UI COMMAND → LOCAL VALIDATION → SERVER AUTHORIZATION → optional impact preview → mutation → confirmed result → system events (when a safe source exists) → UI reaction/readback`.

Local validation improves clarity only. Console session, same-origin/CSRF protections and BFF allowlists remain in force; the API independently authenticates the server-side machine principal, checks scope and application/tenant boundary, validates domain transitions and records audit where supported. The browser never supplies a machine credential. Preview is advisory and must identify unknown impacts; it does not reserve state or authorize the final command.

Conceptual `OperatorCommand` fields: `commandType`, `targetEntityType`, `targetId`, `applicationScope`, optional `tenantScope`, validated `payload`, optional `expectedRevision`, optional endpoint-supported `idempotencyIntent`, operator/session reference (opaque and safe), and correlation/request id. This is a design model, not a new wire format. Never place passwords, bearer tokens, provider secrets, raw private model prompts or private chain-of-thought in commands, events or logs.

Mutation state is `IDLE → DIRTY → VALIDATING → READY → SUBMITTING → APPLIED | PARTIAL | FAILED`. `APPLIED` means server confirmation; `PARTIAL` means the primary write and a dependent effect/readback have different outcomes. Failure preserves safe draft input where possible. Readback errors are reported separately from mutation result.

## Action vocabulary and supported-domain discipline

Shared action names are semantic labels, not promises that every entity supports every transition.

| Class | Current examples / constraint |
|---|---|
| CREATE | Applications, tenants, principals, connections, profiles, knowledge/memory and model entities where API routes exist. |
| UPDATE | Supported knowledge/configuration fields; a generic conditional update/version contract is not present across entities. |
| ACTIVATE / DEACTIVATE | Only lifecycle endpoints that explicitly define those transitions (for example, model/profile lifecycle). |
| ARCHIVE / RESTORE / RETIRE | Domain-specific lifecycle semantics only; archive, restore and retire are not interchangeable. |
| REVOKE | Credentials, grants or references only through explicit revoke routes; never imply secret recovery. |
| BIND / UNBIND / ASSIGN / UNASSIGN | Scoped binding, visibility or grant routes that exist for that entity. |
| SYNC | Provider catalog sync with preview/result semantics where exposed; never background synchronization by implication. |
| RUN | Workbench/runtime execution; side effects and retry rules depend on endpoint contract. |
| COMPARE | Read-only comparison over compatible, identified inputs. |
| TEST | Provider connection test; result is timestamped evidence, not standing health. |

Current BFF/API routes expose selected create, revoke, lifecycle, binding, visibility, test, sync, profile, knowledge/memory and runtime operations; the action allowlist and API DTO remain authoritative. Unsupported actions are unavailable and must not be synthesized in UI.

## Event semantics

The vocabulary below standardizes operator-facing meaning; it does **not** require a distributed event bus in X1. Persisted `OicAuditEvent`, execution records and stage records are current safe sources for their documented fields. They are not a general change feed, and candidate events without a current producer remain PLANNED. Events are facts, not commands.

Conceptual envelope: `eventType`, `entityType`, `entityId`, application, optional tenant, source timestamp, correlation/request id, source, severity/state, safe summary, affected entity references, optional trace id and event-contract version. Omit fields not provided. Filter by server-authorized scope. No secrets or private reasoning. A client-created notification is not an authoritative system event.

| Family | Example semantics | Status |
|---|---|---|
| SYSTEM | readiness changed, capability degraded | PLANNED except existing health/readiness snapshots, which are not event feeds |
| PROVIDER | `PROVIDER_CONNECTION_TESTED`, `PROVIDER_DEGRADED` | Test result can be read from current check/evidence records; continuous degraded event is PLANNED |
| MODEL | `MODEL_REVISION_CREATED`, `MODEL_BINDING_CHANGED`, `MODEL_ACTIVATED` | Persisted entity/audit facts exist for selected writes; normalized event feed is PLANNED |
| PROFILE | `PROFILE_ASSIGNED` / revision lifecycle | Current records/routes are domain-specific; unified event projection PLANNED |
| MEMORY / KNOWLEDGE | `MEMORY_ARCHIVED`, `KNOWLEDGE_UPDATED` | Current domain records/audit where emitted; safe event projection PLANNED |
| RUNTIME / TRACE | `EXECUTION_STARTED`, `EXECUTION_COMPLETED`, `EXECUTION_FAILED`, `VERIFICATION_COMPLETED`, `BACKTRACK_OCCURRED` | Persisted execution/stage records exist; safe bounded read path current; live stage-event subscription PLANNED |
| SECURITY | credential/grant changes and denials | API auth/audit sources exist for documented operations; a Console event stream is PLANNED |
| FACTORY / LAB | sync, test, experiment and evaluation lifecycle | Selected sync/test/run results exist; generic factory/lab feed and experiment events PLANNED |

## Configuration diff

Reusable diff view: `CURRENT`, `PROPOSED`, `DELTA`, `KNOWN IMPACT`, `PREDICTED IMPACT`, `UNKNOWN IMPACT`. Diff values retain domain semantics and scope. Classify each property as `added`, `removed`, `changed` or `unchanged`; value kinds are number, boolean, enum, set/list, reference/entity and structured object. Show units/bounds for numbers, labels for enums, stable named entries for sets, entity names plus scope for references and field-level meaning for structured policy. Do not reduce normal operator UX to raw JSON. Expert inspection may expose a sanitized technical diff. Unknown/predicted impact is visibly uncertain and never represented as confirmed effect.

Apply this primitive to profiles, model revisions, bindings, provider routing, memory policy, knowledge/retrieval, context budget and verification policy only where both current and proposed values have valid contracts.
