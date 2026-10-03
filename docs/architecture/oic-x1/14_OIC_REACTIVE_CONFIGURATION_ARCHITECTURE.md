# OIC Reactive Configuration Architecture

**DECIDED target:** configuration views expose operator inputs and explain downstream effects through linked OIC entities and persisted execution evidence. They do not fabricate predictive telemetry or claim instant runtime reaction unless the API confirms it.

The single mutation contract is [Action / Command / Event](22_OIC_ACTION_COMMAND_EVENT_ARCHITECTURE.md); its reusable [configuration diff](22_OIC_ACTION_COMMAND_EVENT_ARCHITECTURE.md#configuration-diff), [permission](23_OIC_PERMISSION_AWARE_OPERATOR_UX.md), and [failure/recovery](24_OIC_FAILURE_RECOVERY_AND_ROLLBACK.md) semantics apply to every editable workspace. Draft and mutation states are shared, not redefined page by page. API conditional revision enforcement is not universal today; see recovery contract before designing consequential concurrent edits.

## Flow contract

`OPERATOR INPUT → CONFIGURATION CHANGE → RESOLVED EFFECTIVE STATE → RESULTING EXECUTION → TRACE EVIDENCE → OBSERVED OUTCOME`.

For each editable field record owner entity, validation, scope, version/lifecycle effect, downstream resolver and trace fields available for verification. Show current value, draft value, changed fields and server response. Separate persisted change from effective runtime state; include tenant/application/environment and precedence where API resolves it. If no resolving API or trace association exists, state that reaction is **UNKNOWN** and mark instrumentation PLANNED.

Current candidates include intelligence-profile revision controls, model variants/bindings/visibility, provider connection lifecycle/credentials, memory and knowledge lifecycle, retrieval and verification settings. The exact scope/action contract comes from each API DTO and guard. Simulation is optional and only valid when an existing isolated preview endpoint computes it. No synthetic impact previews or fake before/after charts. A “save” cannot imply runtime adoption; verify with a new matching execution and trace when appropriate.

## Configuration state machine

- **CURRENT:** server-confirmed persisted entity/version and latest observed runtime trace; if response omits an effective state, it is unknown.
- **DRAFT:** client-side proposed change, scoped and diffed against CURRENT. Never presented as saved or applied.
- **KNOWN IMPACT:** direct deterministic consequence encoded by a current API/domain contract (e.g. a binding record is now `ACTIVE`, visibility relation exists, or a profile revision stores new bounded policy values). State exact invariant; avoid predicting runtime selection unless resolver returns it.
- **PREDICTED IMPACT:** versioned evaluator or simulator estimates future behavior, with method/cohort/horizon/confidence. OIC-7 required for intelligence-quality predictions. Not authoritative and never silently merged with known impact.
- **UNKNOWN IMPACT:** no source/method resolves the effect; state why and how to observe it.
- **SIMULATION:** only a named isolated API result with inputs/version; simulation does not persist or cause provider calls unless explicitly declared.
- **APPLY:** explicit permission-checked BFF/API action; server returns accepted entity, new version, audit/correlation where available.
- **RESULT:** immediate API outcome (success/rejection/timeout) distinct from downstream runtime response.
- **OBSERVATION:** later read/trace for actual effective behavior; match entity, scope and revision.

## Example flows and evidence status

| Change | CURRENT deterministic impact | Unknown/predicted and required evidence |
|---|---|---|
| Intelligence profile revision | API validates policy ranges and persists immutable revision; revision ID/settings known. | Runtime adoption/quality/cost is unknown until execution resolves that revision; compare traces on matched tasks. Quality/efficiency projection is OIC-7. |
| Runtime binding | API validates relationships/scope and persists draft/active status. | Effective resolver precedence and provider actually selected are known only from resolver/trace result; forecast availability is OIC-7/telemetry, not UI rule. |
| Provider routing/connection | Credential rotation/revocation and connection status changes are persisted/audited; scope is known. | Future call routing, provider success/cost and customer impact need runtime call evidence and billing/telemetry contract; prediction OIC-7 only if evaluator owns it. |
| Memory settings/record | API persists lifecycle, sensitivity, validity, confidence/salience fields. | Selection/utility is observed per execution trace if recorded. Future retrieval benefit is unknown absent matched tests; generalized score requires OIC-7. |
| Knowledge/retrieval | API persists source, dependencies, authority/priority/lifecycle. | Eligible retrieval set can be confirmed by runtime scope/policy; answer quality requires paired evidence/evaluator. Similarity chart cannot predict. |
| Search budget | Profile revision stores bounded query/stage/candidate budgets. | More budget does not imply better answer; resource delta observed in trace; quality prediction OIC-7. |
| Verification budget | Profile revision stores verification/repair bounds and evidence requirement. | Actual rounds/status observed per trace; missed defect/false positive rate needs labeled evaluation cohort OIC-7. |
| Context budget | Revision persists max context tokens; execution records context tokens when available. | Truncation/completeness effects require trace/compiler evidence; quality and latency projection OIC-7. |

For each implementation page, render Current/Draft diff; scope/entity; known impact; predicted panel only when source exists; unknowns; optional simulation if API supports; apply confirmation; request/audit response; later observed trace. A draft discard restores last server value. Concurrent update conflict requires refetch/merge review, never blind overwrite. Do not claim cross-entity rollback where APIs have no atomic transaction.
