# OIC-4 Responix Integration — Progress and Evidence

**Date:** 2026-10-01
**Branch:** `oic`
**Disposition:** GO under the non-Docker acceptance contract. Docker runtime validation is unavailable on this machine. See `OIC_RESPONIX_INTEGRATION_SPRINT_4_CLOSEOUT.md` for the final matrix.

## Work completed

- Responix integrates with internal OIC through `@oic/client` for runtime invocation and the OIC Foundation HTTP API for workspace tenancy.
- OIC application `RESPONIX` and separate `responix-runtime` and `responix-provisioner` principals were reconciled without duplicates. Runtime receives only invocation and model discovery scopes. Provisioner receives application lookup plus tenant read/manage scopes required by the current provisioning contract. Runtime and provisioning credentials remain separate and stored in ignored local configuration.
- Workspace provisioning resolves `Responix Workspace UUID ? RESPONIX external reference ? OIC Tenant`, creates the runtime tenant grant idempotently, and returns safe errors. A real local workspace resolved and repeated through the Responix service over OIC HTTP. A mismatched tenant was denied.
- OIC-mode Agent execution was exercised through the live Responix API and OIC Native Runtime. No local Oi Model binding exists, so `MODEL_NOT_AVAILABLE` was the expected production-style result. No fallback to LEGACY occurred. Tests cover LEGACY behavior, capability rejection, usage mapping, and Guard ordering.
- The initial live tenant-provisioning probe exposed two issues: Foundation tenant-management operations incorrectly required an existing grant to the tenant, and the connector did not unwrap the idempotent Foundation create response. Management was made application-scoped while tenant reads/runtime remain tenant-scoped; provisioning now unwraps the response and grants the tenant to the runtime principal. The Foundation acceptance suite covers the management/read isolation.
- Added `OIC_RUNTIME_PRINCIPAL_ID` to Responix configuration so provisioning can grant runtime access without giving the runtime principal provisioning scopes.
- `pnpm platform:dev` built and started OIC API, Responix API, and Dashboard in sequence. All three health routes passed on loopback. The local unified run used a non-persisted random encryption key because the ignored `.env` contains an invalid placeholder value.
- OIC `/docs` provides the current internal operator surface over scope-guarded APIs for Foundation identities, providers/connections, models/catalog, health, and audit. No OIC-9 control center was added.
- Compose formatting was corrected. Static YAML parsing passed; runtime Compose validation remains unavailable because Docker is not installed/running.

## Database state

Responix migration status reports 45 migrations current. The human-verified schema/data checks remain valid: 27 existing Agents remain LEGACY, model/provider values remain populated, nullable OIC runtime fields and constraints are in place, and catalog/capability/price counts match the verified state. The pre-OIC-4 backup was retained.

OIC migration status reports all 9 migrations current. No migration was deployed during this acceptance.

`000045_oic_agent_runtime_decoupling` had one initial local deploy failure caused by a UTF-8 BOM in `migration.sql`. It had no side effects; the failed attempt was marked rolled back with `prisma migrate resolve`, the BOM was removed, and the migration was reapplied successfully. Final schema and data verification passed. The historical rolled-back row was preserved.

## Validation summary

- OIC API: 57 tests passed; production build and typecheck passed.
- Responix affected tests: 86 passed; production build passed.
- Responix typecheck: only pre-existing errors remain in untouched catalog/runtime-protection integration specs.
- Dashboard: 215 tests passed; typecheck and production build passed earlier in this worktree.
- OIC client: 6 tests passed; generated API clients and contracts/client typechecks passed earlier in this worktree.
- Changed-scope lint, formatting, and `git diff --check`: final review evidence is recorded in the closeout/commit review.
- Prisma clients remain isolated; no OIC-to-Responix database imports, direct reads/writes, or cross-database foreign keys were added.
- No customer conversation was sent to or introduced in OIC persistence. The live acceptance request used synthetic text and produced no usage because model resolution returned `MODEL_NOT_AVAILABLE`.

## Security and deployment boundaries

- `.env` and `.env.oic.local` are ignored. No credential, selector, password, provider secret, or captured recovery output is documented or staged.
- OIC listens on loopback in local acceptance and is not host-published in Compose. Responix owns customer-facing requests, Guard, channel serialization, and outbound delivery.
- Docker runtime remains BLOCKED by unavailable infrastructure; it is not required for the non-Docker GO decision.
