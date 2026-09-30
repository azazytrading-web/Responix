# OIC Provider & Oi Model Sprint 3 Progress

**Date:** 2026-10-01
**Sprint:** OIC-3 Provider & Oi Model Fabric
**Baseline:** `ba06bdc0a92128672c99f95d1138d406944250b2` (`oic`, matching `origin/oic` before OIC-3)
**Status:** OIC-3 implementation and acceptance gates complete. Feature commit `163fdf4bd989ade70cccc21b6c017ae57963e6e9` and acceptance/closeout commit `6a98b768751900038f96432fd800979f151cb703` are pushed to `origin/oic`; final verification found the worktree clean and local/remote HEAD equal.

## Authority and boundaries

- OIC owns provider definitions/connections, encrypted provider credentials, upstream catalog, Oi Model Fabric, migrations, APIs, runtime execution, and audit evidence.
- Responix remains a separate service and data owner. No Responix source, database, production/shared/customer database, or production provider was accessed or modified.
- OIC is internal to Oi under the current architecture lock. Customers use the product-facing Responix edge and receive neither OIC credentials nor direct OIC Runtime/Admin access.
- Provider HTTP fixtures and network injection are acceptance-only. `forTest` entry points require Node's test context; production modules register no fixture provider or local-network path.
- OIU, billing/quota plans, model evaluation/factory, Memory, Knowledge/RAG, Tool Fabric, internal models, automated provider discovery, and OIC-4 integration/deployment remain out of scope.

## Stage and gate status

| Stage | Status | Evidence |
|---|---|---|
| 3A Provider Fabric | PASS | Static transport registry; platform/application/tenant connection ownership and lifecycle; AES-256-GCM encrypted credentials with connection/version-bound AAD; credential rotation/revocation; health checks, activation gates, safe audit evidence. |
| 3B Upstream Catalog | PASS | Exact opaque upstream IDs; manual sync and read APIs; capability `SUPPORTED`/`UNSUPPORTED`/`UNKNOWN`; pricing `UNKNOWN` versus evidenced known zero, currency/source/effective date; append-only evidence and sync runs. |
| 3C Oi Model Fabric | PASS | Families, editions, revisions, variants, visibility, lifecycle transitions, runtime bindings, audit; database triggers reject revision mutation and invalid owner/provider/health relationships. |
| 3D Resolver and visibility | PASS | Deterministic tenant/application/platform precedence; active production binding, healthy validated connection, active credential and application visibility required; `/v1/models` exposes only Oi IDs. |
| 3E Provider transports | PASS | Bounded Chat Completions and OpenAI Responses provider adapters; fixture acceptance covers request/response mapping, stream, status normalization, cancellation, timeout, content-type/body bounds, malformed/truncated/error events, and redirect rejection. |
| 3F Native Runtime integration | PASS | Real database resolver and binding graph connect to provider executor and local HTTP fixture. Streaming, raw usage evidence, and actual upstream fixture call-count idempotency are verified. |
| 3G Compatibility and boundaries | PASS | Chat Completions and consumer Responses adapters execute through Native Runtime in provider-backed acceptance; customer identity spoofing, unauthorized OIC admin scopes, and application/tenant boundaries are rejected. |
| 3H API, migration, security and closeout | PASS | Built API live smoke, official OIC OpenAPI generation, both database migration statuses, clean-schema migration deploy, package checks, security/dependency review, `git diff --check`; both OIC-3 commits pushed and final worktree verified clean. |

## Implementation and validation log

- Added five additive OIC migrations: provider/model fabric, upstream connections/catalog evidence, health validation, chat-only registration hardening, and OpenAI Responses transport registration. Nine migrations are applied/up to date on `oic_development` and `oic_migration_test`.
- Clean migration validation deployed all nine migrations into a uniquely named empty schema in the dedicated local OIC migration-test database, verified that schema up to date, and dropped only that temporary schema. The existing test schema was not reset.
- Provider credentials use AES-256-GCM with 12-byte random nonces, authentication tags, key version, and AAD bound to connection ID and credential version. Plaintext is only added to a provider Authorization header; control APIs, audit data, fixture results, and runtime results do not disclose it.
- Production endpoint validation accepts HTTPS only, rejects URL credentials/query/fragment and non-public DNS answers, and pins the resolved public address while retaining hostname TLS verification. Redirects are never followed. Body limits are 2 MiB total, 256 KiB per SSE event, and 64 KiB for provider errors/connection-test data; provider error bodies are not surfaced.
- Chat Completions provider transport translates OIC text roles/messages, model ID and output limit. The provider-side OpenAI Responses adapter is separately implemented inside the provider executor and maps OIC messages to Responses input, output/usage back to OIC, and Responses SSE completion events to OIC chunks. Provider DTOs do not enter `@oic/contracts` or Native Runtime.
- Consumer `POST /v1/responses` remains an OIC compatibility route over Native Runtime. Acceptance covers both compatibility stream protocols and verifies provider identity non-disclosure.
- `pnpm.cmd --filter @oic/api test`: PASS, 57 tests, 0 failures, 0 skipped on the dedicated OIC migration-test database. Includes catalog evidence/history and audit assertions, provider-scope isolation, connection testing, provider transport fixture, database-backed runtime execution/idempotency, customer boundaries, immutable revisions, and append-only audit trigger coverage.
- `pnpm.cmd --filter @oic/client test`: PASS, 6 tests, 0 failures, 0 skipped.
- API `typecheck`, `lint`, and `build`; contracts `typecheck` and `build`; database Prisma `validate`, `generate`, `typecheck`, and `build`; and client `typecheck` and `build` all PASS.
- Official `pnpm.cmd --filter @oic/client openapi:generate` ran against the built OIC API `/docs-json`, refreshing only OIC client generated document/path types. OIC API source generates and serves its OpenAPI document through Nest Swagger at runtime.
- Built API on isolated local port 4193: `/api/v1/health/live` PASS, `/api/v1/health/ready` PASS with database `ok`, `/docs-json` PASS with 38 paths and all 10 expected OIC admin/runtime/compatibility paths, unauthenticated provider admin request returned 401. The process was stopped after verification.
- Dependency review found no Responix imports in OIC contracts/client/runtime/control-plane boundaries and no OpenAI compatibility DTOs in `@oic/contracts`. `git diff --check` PASS.

## Completion

OIC-3 is complete, committed and pushed. The follow-up commit includes `customer-boundary.acceptance.test.ts`, which is referenced by the serialized API acceptance script. Final `HEAD` and `origin/oic` matched, and the worktree was clean. Do not begin OIC-4.
