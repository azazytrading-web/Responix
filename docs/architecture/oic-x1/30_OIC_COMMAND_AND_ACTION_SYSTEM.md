# OIC Command and Action System

**Status:** DECIDED X1.3B contract, not implemented here. Source command semantics remain endpoint-specific. Parent: [28](28_OIC_INTERFACE_SYSTEM_ARCHITECTURE.md); shared states/security: [34](34_OIC_INTERFACE_STATE_PERMISSION_MACHINE.md); API event truth: [22](22_OIC_ACTION_COMMAND_EVENT_ARCHITECTURE.md).

## Action vocabulary and consequence

| Action class | Presentation / behavior |
|---|---|
| Primary / Apply / Run / Sync | One clear next command in its local context; named for domain outcome; pending, blocked and result are visible. |
| Secondary / Quiet / Ghost / Inline / Icon | Lower emphasis; icon-only requires accessible name and tooltip as supplemental help. Inline is not a substitute for an entity link. |
| Split action / Action menu / Context group / Command bar | One primary intent plus explicit alternatives; menu items are scope-filtered, keyboard-accessible and close before navigation. |
| Sticky action bar / Batch action bar | Summarizes dirty state, count, scope and available bulk action; batch endpoints and atomicity must exist before “apply all.” |
| Save Draft / Reset / Revert Draft | Client draft management only unless named server endpoint persists a draft. Reset is not server rollback. |
| Retry / Cancel / Abort | Retry only under documented idempotency/safety; cancel/abort only while a backend operation supports it. Never fabricate cancellation. |
| Danger / destructive / arm / hold | Consequence-aware explicit target, scope and impact. Hold-to-confirm or typed confirmation only for exceptional irreversible/high-security actions, not routine archive. |
| Keyboard command / palette command | Search/navigation may jump directly; mutations dispatch an intent to the same confirmation and permission flow as their page. |

Command appearance is not authorization. Consequence classes are LOW (direct local action), MATERIAL REVERSIBLE (clear Apply/review), HIGH (confirmation with target/scope/consequence), IRREVERSIBLE OR SECURITY-SENSITIVE (strong confirmation/arm, explicit target and reason only if required by API). Existing examples: credential issue/revoke, principal scope/grant changes, connection credential/lifecycle, model lifecycle/visibility, knowledge/memory update/archive, runtime invocation, catalog sync. Do not use a generic DELETE label where the domain uses archive, retire, disable, suspend or revoke.

## Canonical command lifecycle

`IDLE → READY → [ARMED] → EXECUTING → SUCCEEDED | FAILED | PARTIAL | CANCELLED | BLOCKED | DENIED | CONFLICT | UNKNOWN_RESULT`.

`SUCCEEDED` requires a valid domain-success response, not merely HTTP transport success. `PARTIAL` means an explicit endpoint/result proves some suboperations succeeded. `CANCELLED` requires acknowledged cancellation or a command known not to have been sent. `UNKNOWN_RESULT` covers lost/ambiguous response and requires reconciliation, not a false failure or duplicate action. `CONFLICT` retains the draft and requires refetch/compare. `DENIED` reflects server/API authorization outcome. `BLOCKED` names a known precondition or unsupported capability.

Every command has a typed client intent with action kind, entity reference, explicit scope, validated payload, consequence class, optional expected revision only where endpoint supports it, and correlation id. This is a UI contract, not a new universal wire format or event bus. The BFF’s fixed action allowlist and per-action validation remain; API scopes and tenant/application checks remain authoritative. Never put secrets or private prompts in command/event/audit metadata.

## Button contract

Primary, secondary, quiet, ghost, inline, icon, split, danger, warning, success, command, arm, hold, retry, cancel, apply, save-draft, reset, revert, inspect and open-workspace are semantic variants, not arbitrary colors. Each has compact/standard/large sizing, stable icon-label spacing, visible focus, disabled/read-only distinction, minimum practical touch target, keyboard activation via Enter/Space, busy state with retained accessible name, and non-color state text. Busy commands prevent accidental duplicate submission unless the endpoint explicitly permits concurrency.

## Feedback and long-running actions

Acknowledgement is immediate (pressed/selected/dirty/submitting), but persistence waits for a domain response. Show local inline validation first; keep consequential success/failure and request/trace correlation in a persistent local result panel. Toasts supplement, never replace, errors or important result. Long jobs may show queued/executing/waiting only if returned by the backend; show percentage only with measured progress. No infinite spinner: timeout becomes UNKNOWN_RESULT where outcome is ambiguous, followed by authoritative reconciliation.

## Palette, keyboard and menus

The current Ctrl/Cmd+K palette is retained. X1.3B may add scoped entity jump, recent resources and contextual actions behind the same picker/permission/confirmation contracts. Navigation may execute from a result; dangerous mutation may only open its normal review/confirmation path. Tab/Shift+Tab, Enter, Space, Escape and arrow keys follow established semantics; menus/popovers close on Escape and before route change, with focus restored to their invoker.

## Source support boundary

Current API supports specific create/update/lifecycle/test/sync/run operations and selected audit/correlation fields. There is no universal command endpoint, command queue, progress stream, undo, generic cancel, generic idempotent admin mutation, or universal partial-result envelope. The action BFF sends correlation and an idempotency header, but that does not establish server idempotency for every action. Keep outcomes endpoint-specific; see [22](22_OIC_ACTION_COMMAND_EVENT_ARCHITECTURE.md), [24](24_OIC_FAILURE_RECOVERY_AND_ROLLBACK.md), and [36](36_OIC_INTERFACE_ACCEPTANCE_GOVERNANCE.md).
