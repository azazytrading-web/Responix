# Oi Intelligence Core — Approved Direction

**Status:** Owner-approved product direction; conceptual only. This is not the OIC Master Architecture Charter and does not authorize OIC implementation in MOD-2 Sprint A.

Oi Intelligence Core (OIC) is a product/system independent from Responix, initially developed in the same monorepo. Responix is its first consumer; future Oi systems consume the same OIC API. Upstream providers and provider connections are managed behind OIC and hidden from Responix workspaces/customers. Future Provider Connections include Bring Your Own Service (BYOS). OIC accepts intelligence requests and returns unified intelligence results. Its native API remains distinct from its required OpenAI Compatibility Gateway foundation.

An upstream provider model and an Oi Model are separate identities. Future Oi Models have families/products, specialized editions, revisions and implementation variants. Oi 1, Oi 1.2, Oi 1.7 and future Finance/Sales specializations illustrate product identities, not upstream model names.

Core OIC pillars include Model Factory; Model Evolution Lab; evaluation and domain scores, including OMI/OES-style quality and efficiency evaluation; a cache-first, context-efficient architecture; Context Compiler; and the OIC Efficiency & Cache Engine. Its primary optimization objective is maximum required quality with minimum upstream provider consumption.

Oi Units (OIU) are internal intelligence-consumption units. Metering, quota, entitlement, plans and economics are separate concepts. Oi Model pricing metadata is not by itself connection billing/usage truth or customer economics.

Channel Protection Guard remains inside Responix, not OIC. Responix also owns channel queues, typing/read behavior, humanization, rate/burst protection, serialization and channel delivery.

## Compatibility with MOD-2 Sprint A

The MOD-2 catalog records upstream `AiModel` identity; it does not define future Oi Model product identities. Model capability evidence describes upstream catalog claims and restrictions. The API labels its result `catalogState`; it does not certify final runtime capability. Future OIC capability decisions must combine model evidence with transport/auth-profile capability, provider-connection entitlement and application/workspace restrictions.

No connection-scoped availability table is introduced in MOD-2. Workspace model snapshots remain scoped catalog records; future connection availability can be represented by OIC without changing the meaning of Oi Model product identity.

MOD-2 pricing records are upstream model-price metadata with explicit `KNOWN`/`UNKNOWN` state. They do not establish connection billing/usage profiles, OIU metering or customer economics. Unknown remains distinct from a known zero price.

Workspace Custom Models remain outside Sprint A production Agent selection and routing. Existing built-in execution remains a compatibility path. Future OIC/Oi Model selection and connection resolution require their own architecture and integration decisions.

This direction introduces no OIC database, runtime, Provider Connection, OAuth, gateway, billing, model product/family/edition/revision, Model Factory, evaluation engine or Responix UI implementation details. Those belong in a separately reviewed OIC Master Architecture Charter after Sprint A closes.
