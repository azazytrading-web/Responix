# OIC Reactive Configuration System

**Status:** DECIDED interaction contract; only explicitly supported endpoint previews and mutations are current. No universal simulator is implied. Parent: [28](28_OIC_INTERFACE_SYSTEM_ARCHITECTURE.md); draft/state machine: [34](34_OIC_INTERFACE_STATE_PERMISSION_MACHINE.md); command: [30](30_OIC_COMMAND_AND_ACTION_SYSTEM.md).

## Configuration loop

`CURRENT → DRAFT → VALIDATING → PREVIEW → READY_TO_APPLY → APPLYING → APPLIED → VERIFYING → VERIFIED` with invalid, stale, conflict, denied, failed, partial and unknown-result branches. Not every backend has each stage. Omitted stages are explicit; the UI never simulates a server acknowledgement.

Classify every changed effect as one of:

| Class | Meaning |
|---|---|
| `LOCAL_PREVIEW` | Deterministic client-only rendering of the proposed value, labeled PREVIEW. |
| `SERVER_PREVIEW` | A named API preview response, input identity and scope shown with its limitations. |
| `PREDICTED_IMPACT` | Versioned prediction with explicit method, source, confidence and forecast window; PLANNED absent such contract. |
| `KNOWN_EFFECT` | Directly specified domain consequence from an authoritative contract, not an estimate. |
| `UNKNOWN_EFFECT` | Impact cannot be established; say “IMPACT NOT YET MEASURED” / “EFFECT UNKNOWN.” |
| `APPLIED_NOT_VERIFIED` | Mutation accepted; authoritative readback or runtime evidence has not confirmed effect. |
| `VERIFIED_EFFECT` | Readback/evidence confirms the claimed dimension, with source/time/scope. |

Never write invented “+12% intelligence” or other output prediction. Configure capability ceiling ≠ observed use or outcome.

## Draft and diff contract

One typed draft owns current snapshot/version, proposed values, base revision if provided, dirty fields, validation/warnings, selection context, and discard/apply intent. Current versus proposed diff displays semantic label, formatted unit/value, changed/unchanged, source and known unknowns. Parameter, budget, threshold, capability, resource and dependency impact rows appear only when their meaning/data exists. A locally recomputed gauge/rail is explicitly a local visualization preview and cannot alter production telemetry or OIC-7 measurement.

Preset identity is exact-match state over canonical supported fields; any divergence is CUSTOM. Cross-field constraints operate in the local draft before apply; server validation can add authoritative errors/warnings without clearing edits. Draft remains available through failed/denied/network outcomes. Navigation asks before discarding meaningful dirty work. A refreshed entity never silently overwrites the draft.

## Apply and verify

At apply, review target, scope, delta, consequence, known effects and unknowns; recheck permission/capability as far as current server contract permits; send only a fixed, validated, supported BFF action. On response, distinguish transport from domain result and persist result/correlation in the workspace. Re-fetch the specific authoritative state; for runtime configuration, a later matching trace is required before claiming runtime adoption. If readback fails after acknowledged mutation, show **APPLIED / VERIFICATION UNKNOWN**, retain correlation and offer safe reconciliation. Never convert it to failed or rollback automatically.

## Existing support limits

Current API supports provider catalog preview; it does not provide a general before/after impact evaluator. Current create/update/lifecycle endpoints are specific; a universal config draft endpoint, conditional revision/If-Match across mutations, atomic multi-entity transaction, generic undo/rollback and generic safe retry are not established. Existing profile writes create revisions, so compare the latest revision and preserve the local draft; no universal expected-revision enforcement is available. Catalog preview support must not be generalized to other domains.

## Reactive composites

Architecture supports a Profile Tuning Rack, provider setup preview, model binding selector, threshold band editor, resource budget rack, semantic configuration diff, apply+verify workflow and conflict panel. Each composite consumes the individual contracts and existing source; absent evaluator/API fields remain UNKNOWN or UNSUPPORTED. Instrument integration is one-way from valid local preview to preview rendering when a typed mapping is declared; it never feeds fabricated values back into source data or measured DNA.
