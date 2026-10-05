# OIC Interface State and Permission Machine

**Status:** DECIDED shared X1.3B contract. Parent: [28](28_OIC_INTERFACE_SYSTEM_ARCHITECTURE.md); command result details: [30](30_OIC_COMMAND_AND_ACTION_SYSTEM.md); recovery: [24](24_OIC_FAILURE_RECOVERY_AND_ROLLBACK.md).

## Orthogonal state axes

Do not compress lifecycle, availability, freshness, permission, validation, draft and command outcomes into one status string/color.

| Axis | Canonical values |
|---|---|
| Data availability | `LOADING`, `REFRESHING`, `EMPTY`, `NO_RESULTS`, `AVAILABLE`, `PARTIAL`, `FAILED`, `UNAVAILABLE` |
| Freshness | `LIVE`, `CURRENT_SNAPSHOT`, `STALE`, `HISTORICAL`, `UNKNOWN_FRESHNESS` |
| Measurement | `MEASURED`, `UNMEASURED`, `INSUFFICIENT_DATA`, `NO_SOURCE`, `NO_HISTORY` |
| Configuration capability | `AVAILABLE`, `READ_ONLY`, `DENIED`, `UNAVAILABLE`, `NOT_CONFIGURED`, `UNSUPPORTED` |
| Draft | `CLEAN`, `DIRTY`, `VALIDATING`, `VALID`, `INVALID`, `STALE`, `CONFLICTED` |
| Command | `IDLE`, `READY`, `ARMED`, `EXECUTING`, `SUCCEEDED`, `FAILED`, `PARTIAL`, `CANCELLED`, `BLOCKED`, `DENIED`, `CONFLICT`, `UNKNOWN_RESULT` |
| Entity lifecycle | Domain-owned states such as ACTIVE/SUSPENDED/ARCHIVED, DRAFT/PRODUCTION/RETIRED; never substitute a shared UI lifecycle. |
| Search | `IDLE`, `SEARCHING`, `RESULTS`, `EXACT_MATCH`, `NO_RESULTS`, `ERROR`, optionally source-backed `RECENT`, with inactive/archived labels. |

Unavailable is not empty; unmeasured is not zero; stale is not fault; disabled is not denied. Preserve instrument semantic vocabulary from the frozen [Instrument Design System](../../project-state/OIC_INSTRUMENT_DESIGN_SYSTEM.md).

## Draft and command transition invariants

`CLEAN → DIRTY → VALIDATING → VALID | INVALID`; a source refresh while DIRTY marks `STALE` and preserves edits; server revision mismatch becomes `CONFLICTED`, fetches the new version and offers compare/discard/rebase only where domain-safe. Applying a DIRTY valid draft enters the command lifecycle; it is not itself proof of persisted state. On failed validation, denied or network error, retain repairable edits. On ambiguous mutation timeout use `UNKNOWN_RESULT` plus read reconciliation. See [32 reactive configuration](32_OIC_REACTIVE_CONFIGURATION_SYSTEM.md).

The command transitions and result meanings live in [30](30_OIC_COMMAND_AND_ACTION_SYSTEM.md). Components receive state from the workspace owner and render it; they do not own duplicated per-component mutation state machines. Use TypeScript discriminated unions for semantic state and typed detail/reason, not stringly state soup.

## Permission and capability model

The OIC human Console session is checked by the server BFF. A separately held server-side OIC machine principal is checked by API authentication, scope guards and application/tenant grants. The browser is not a human-role capability authority, and signed-in status alone does not imply a write grant. The current API does not establish a universal per-human capability-discovery feed.

Show read-only/denied only when derived from a known endpoint/action contract or explicit server result. `READ_ONLY` permits viewing but no known action; `DENIED` gives a safe reason and preserves selection/draft; `UNAVAILABLE` means a dependency/system is unreachable; `NOT_CONFIGURED` means required domain config is absent; `UNSUPPORTED` means no implementation/API contract; `DISABLED` is an intentional UI setting, never a proxy for permission. Do not leak existence of out-of-scope entities in error details or pickers. Server denial remains final.

Capability explanations distinguish provider/model support, missing runtime binding, application scope, tenant grant, missing config, missing future engine and unavailable service. Each explanation names its source/known limitation and next safe path; unknown capability is not unsupported or false.

## Failure, rollback and notifications

Validation errors stay beside fields and in an accessible summary; warnings are not red blocking errors. Critical action results stay visible in a persistent workspace result area; a toast is supplemental. Retry is shown only if endpoint behavior is safe; refresh/reconcile is separate. “Revert Draft” resets client work to last fetched state; “Restore Revision” is a new supported write. “Rollback” only exists for a real atomic reverse endpoint. Never fabricate audit entries, percent progress, or cancellation.

## Temporal state and resume

Snapshot timestamp and source/freshness travel with data where available. Refresh never overwrites a meaningful draft; operator compares new server revision first. Tab/panel local state may be restored; selected entity/tab/filter/inspector can be URL-backed per [31](31_OIC_SELECTION_AND_PICKER_SYSTEM.md). No secret, private prompt, credential, sensitive draft or permission token is URL state. Local action lists are not audit history.
