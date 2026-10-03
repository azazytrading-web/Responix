# OIC Live State and Temporal Architecture

**Status:** DECIDED contract; current paths are explicitly marked CURRENT, future acquisition is PLANNED. Read with [telemetry](06_OIC_TELEMETRY_AND_INSTRUMENT_ARCHITECTURE.md), [Flight Deck](07_OIC_FLIGHT_DECK_ARCHITECTURE.md), and [compatibility](26_OIC_VERSIONING_CAPABILITY_AND_COMPATIBILITY.md).

## Temporal terms

| Term | Meaning | Required distinction |
|---|---|---|
| Current snapshot | A bounded response observed at a point in time. | It says what that response contained, not what is happening now. Retain source observation time. |
| Live state | A source observation that satisfies its source-owned freshness policy. | A live label requires an active acquisition path and a freshness decision; page render time is not source time. |
| Stale state | Last known value whose freshness policy has elapsed or whose source has stopped advancing. | Preserve the value and its observed time, but mark it stale. Never style as live. |
| Historical sample | A timestamped observation actually retained by an OIC source. | Repeated snapshots are not history. Missing intervals stay missing. |
| Window aggregate | A calculation over identified samples and a declared interval/cohort. | Show window, aggregation method and denominator when meaningful. A current value is not an aggregate. |
| Evaluation result | A versioned result produced by a named evaluator/method over a known cohort. | It is neither configuration nor a generic runtime metric; include evaluator version, sample and provenance where supplied. |
| Configuration revision | A persisted, versioned desired state. | It is not an observed runtime effect or proof of quality. |

The conceptual data path is `OIC source → snapshot / event / retained history → normalization → scoped client state → metric state → instrument`. Normalization validates identity, scope, units and source time; it does not invent samples or promote a snapshot to history.

## Freshness and acquisition status

Freshness is separate from source health, capability and feature availability. Every observation carries source time and, when defined by the source owner, a freshness policy. Domain/API owners set policy per metric class based on its update cadence and operational meaning; client code must not invent a universal timeout. Until a threshold is defined, show “observed at …” and do not assert FRESH solely because a request just completed.

| Freshness | UI meaning |
|---|---|
| FRESH | Source time meets its declared policy; show observation time and acquisition mode. |
| AGING | Observation remains within policy but is approaching its limit, if the owner defines a warning band. |
| STALE | Last value retained, policy elapsed or source explicitly reports stale. Preserve time and value with a visible stale treatment. |
| UNAVAILABLE | No usable observation exists or source cannot currently provide it. Do not substitute zero. |
| FAULT | Source/invariant error; show safe reason and correlation reference where available. |

Connection status overlays freshness: `LIVE`, `PAUSED`, `OFFLINE`, `RECONNECTING`. “Paused” explains that acquisition intentionally stopped (for example, hidden tab); it does not imply the last value is fresh. Return from hidden state with a bounded refresh/reconcile before restoring live status. Expose status in text and accessible announcement, not color alone.

## Acquisition choices and current truth

| Method | Best use | Cost / complexity | Security | Failure and reconnection | Browser / server impact |
|---|---|---|---|---|---|
| Manual refresh | Low-rate control-plane lists, snapshots, explicit reconciliation. | Lowest; user-driven cadence. | Existing same-origin BFF/session boundary; keep API credential server-side. | Request fails visibly; user may retry reads. | Low background load; stale between refreshes. |
| Polling | Bounded aggregates where a measured cadence is required and no push source exists. | Timer lifecycle, backoff, dedupe and freshness policy. | Authenticated BFF endpoint; validate scope each request. | Backoff with jitter; pause hidden tabs; refresh/reconcile on resume. | One shared page/query cycle, not one timer per widget. Adds request load. |
| Server-sent events | One-way ordered status/event feed where API owns safe event semantics. | Persistent connection, cursor/replay and fan-out design. | Authenticated server boundary, scoped subscription and event filtering. | Heartbeat/timeout, cursor resume when supported; otherwise declare gap and reconcile. | Efficient for many updates; connection and server fan-out costs. |
| WebSocket / bidirectional stream | Only when measured two-way low-latency interaction requires it. | Highest protocol, lifecycle, scaling and operational complexity. | Explicit handshake, origin/session policy, per-message scope and size checks. | Heartbeats, reconnect/backoff, resynchronization protocol. | Persistent socket and server capacity; avoid unless justified. |

**CURRENT OIC:** the Console loads snapshot and related views through same-origin BFF JSON requests with no-store semantics, on initial load, explicit refresh and action readback. There is no Console telemetry/event subscription or general history feed. OIC API exposes SSE for Native runtime response generation (`response.started`, `content.delta`, usage and terminal events); that stream is scoped to the runtime response and is not a Console metrics/event feed. The Console runtime view uses a non-streaming invocation path today. Do not repurpose runtime content streaming as dashboard telemetry.

**PLANNED:** source-owned bounded aggregation/history queries first; choose shared polling or SSE only after event semantics, authorization, resume/reconciliation, server capacity and acceptance are designed. WebSocket is not the default. Never add one endpoint call or polling loop per instrument. Fetch one bounded workspace snapshot/aggregate per refresh cycle, normalize once, fan out local state to instruments, and group requests by source/scope.

## Workspace synchronization

| Workspace | Current synchronization and future contract |
|---|---|
| Overview | Current snapshot plus health/readiness and bounded records, fetched by BFF; refresh is explicit/initial/action-triggered. Counts are not runtime rates. Flight Deck history controls stay disabled/absent until a real query exists. |
| Model detail | Read current scoped model/configuration and revision; after mutation, read back the authoritative entity and dependent summaries. No live change subscription is claimed. |
| Provider detail | Connection/catalog/check values are observations at their response times. A check is an event/result, not continuous availability. Refresh/reconcile after test or sync. |
| Workbench | Current invocation returns bounded response/result; show submitting and confirmed result. A native API stream may carry runtime output, but Console stage/progress streaming needs its own safe event contract. |
| Trace execution | Inspect persisted execution and stage records by supported read path. A trace is historical evidence; do not label it live unless a separate subscribed progress source is active. |

For hidden/background pages, stop or reduce nonessential acquisition, cancel obsolete requests when safe, and do not queue a burst of missed polls. On visibility return, reconcile with one bounded read. Only operationally justified active runtime work may continue, with an explicit lifecycle owner. Bound payload and retained client history; batch by workspace/source and scope.
