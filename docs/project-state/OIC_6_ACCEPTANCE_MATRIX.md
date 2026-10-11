# OIC-6 acceptance matrix

The locked acceptance contract is in [`54_PACKET_HANDOFF.md`](../architecture/oic-6-9/cross-cutting/54_PACKET_HANDOFF.md) and the canonical OIC-6 documents. This matrix records implementation evidence without expanding that contract.

| Area | Evidence | State |
|---|---|---|
| Raw usage evidence | Secret-safe provider field allowlist, source digest, attempt/receipt scope, immutable replay, unknown usage retained; runtime receipt and evidence inspection paths. | PASS |
| Provider economics and OIU | Revisioned provider rates and OIU policies; exact decimal assessment; source quality, provenance, unknown and partial evidence preserved; reconciliation remains distinct from raw facts. | PASS |
| Plans and entitlements | Immutable plan/policy revisions, effective assignments, application/tenant scope, explicit entitlement resolution and audit. | PASS |
| Admission, quotas and budgets | Atomic reservation and settlement postings, hard denial, soft state, expiry/reconciliation, request idempotency, concurrency, and currency/bucket constraints. | PASS |
| Customer rating | Typed price strategies and revisions; tenant-over-application resolution; admission-pinned plan; native amount; cumulative included OIU; explicit FREE/TRIAL reasons; append-only credit/reversal; FX evidence. No invoice, tax, payment, receivable or external charge path. | PASS |
| Tenant/application isolation | Scoped queries, composite database relations/checks, negative scope tests and authenticated service scopes. | PASS |
| Localization and operations | English/Arabic Console strings, RTL-aware layout, canonical controls, no-store session/BFF reads, origin-checked allowlisted actions. | PASS |
| Security/product boundary | Existing authentication, machine credential, scope, CSRF/origin and tenant boundaries retained; changes limited to OIC API, Console and database. | PASS |
| Production gallery isolation | `/dev/interface-system`, `/dev/instruments`, `/dev/flight-deck` each returned 404 from the production Console. | PASS |
| Final integration and builds | API typecheck/lint/build and 147/147 tests; Console typecheck/lint and 82/82 tests; Prisma validation/client build; both databases current; default-heap Console production build; live Console/API/database smoke. | PASS |

No user-facing commercial charging is activated by this acceptance. Owner activation, external Finance, invoice, tax and payment remain separate decisions/systems.
