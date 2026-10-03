# OIC Versioning, Capability and Compatibility

**Status:** DECIDED contract principles; capability discovery additions remain PLANNED unless an existing endpoint is cited. Related: [telemetry](06_OIC_TELEMETRY_AND_INSTRUMENT_ARCHITECTURE.md), [availability](21_OIC_LIVE_STATE_AND_TEMPORAL_ARCHITECTURE.md), [permission UX](23_OIC_PERMISSION_AWARE_OPERATOR_UX.md).

## Versioned contracts

| Contract | Versioned meaning |
|---|---|
| Metric Definition | Key, unit, type, aggregation/threshold meaning, owner, maturity and history semantics. Key/unit/meaning break requires a new major version or metric key. |
| Instrument Contract | Renderer hint, accepted value/state shape, accessible fallback, density and direction behavior. Unknown hint cannot change metric semantics. |
| Model DNA Definition | Dimension key, evaluator/method, direction, range, population/cohort and provenance. Additive dimension is compatible if consumers preserve unknown dimensions; changed meaning requires a new version. |
| Capability Descriptor | API contract version, schema compatibility, supported endpoint features, optional fields and feature-state by scope. This discovery shape is PLANNED; do not infer a global descriptor from unrelated endpoints. |
| Reactive Impact Contract | Current/proposed configuration and known/predicted/unknown affected entities, confidence/source and evaluation version. PLANNED unless a specific preview route exists. |
| Event Contract | Envelope and versioned event type/payload semantics; cursor/order/replay guarantees stated by producer. Unified feed is PLANNED. |

Prefer additive optional fields and explicit enums. Breaking changes require versioned route/schema or coordinated migration with a compatibility window documented by API owner. Consumers ignore unknown optional fields but must validate required fields, type, scope and version. Unknown enum values become explicit unsupported/degraded state, never default to an unsafe action. Never silently reinterpret absent as false, zero or healthy.

## Capability and feature availability

A future `CapabilityDescriptor` must be scoped by API/server version and caller-visible application/tenant, expose only safe metadata, and separate endpoint support, configuration readiness, data sufficiency, authorization and service health. It must not disclose secret material or protected entity existence. Until implemented, each UI surface uses known endpoint contracts and authoritative responses; do not claim a generic live capabilities handshake exists.

| Availability | Meaning | UI semantics |
|---|---|---|
| AVAILABLE | Supported, configured and usable in this scope. | Enable supported path, subject to final authorization and source state. |
| PARTIAL | Some requested scope/window/entities are available. | Identify returned/missing subset and allow inspect/retry when safe. |
| UNAVAILABLE | Feature/source not implemented or cannot serve request. | Explain source/feature gap; no fake substitute. |
| NOT_CONFIGURED | Feature exists but required configuration is absent. | Name safe prerequisite; link to permitted setup if available. |
| INSUFFICIENT_DATA | Source/evaluator exists but cohort/sample or evidence does not meet defined criteria. | Show sample/criteria if supplied; do not score or impute. |
| NOT_AUTHORIZED | Caller cannot access the operation/data. | Access state, distinct from absent/unavailable; obey disclosure policy. |
| DEGRADED | Feature responds partially or with a known service/data-quality limitation. | Retain valid observations with warning, time and safe reason. |

These states are not interchangeable with temporal freshness (`FRESH`, `AGING`, `STALE`, `UNAVAILABLE`, `FAULT`) or lifecycle status. Example: a configured provider can be `AVAILABLE` but its last observation `STALE`; an evaluator can exist but be `INSUFFICIENT_DATA`.

## Forward-compatible rendering

- Unknown future metric: accept only after a validated definition/schema and scope; show generic numeric/text form only when value type, unit and meaning are explicit. Otherwise show labeled unsupported metric with source/version metadata; never guess a unit or trend.
- Unknown optional field: ignore for behavior while preserving forward compatibility; expert diagnostic may show safe field name/value if serializer permits.
- Unsupported visualization hint: use a semantically valid accessible generic representation (numeric/table) or explicit `Unsupported Instrument`; do not map to a visually convenient but misleading chart.
- Temporarily unavailable metric: preserve last observation with stale state/time if present, otherwise unavailable; no zero or animated placeholder.
- New DNA dimension: render in a versioned table/list with label, method, range/direction and measurement state. Comparison/radar visualization is allowed only when compared definitions, cohort and evaluator semantics are compatible. Unknown dimension is retained, not discarded.
- New provider capability: expose only after API contract/version and configuration/auth state are defined. Unknown capability remains unsupported, never actionable by inference.

Compatibility tests should include additive fields, unknown metric/hint/dimension, missing optional values, unsupported major version, partial capability and malformed units/scope. A safe degraded state is preferable to a crash or semantic misrepresentation.
