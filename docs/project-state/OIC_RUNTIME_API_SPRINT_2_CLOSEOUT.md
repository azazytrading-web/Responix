# OIC Runtime & API Platform Sprint 2 Closeout

**Date:** 2026-09-30
**Sprint:** OIC-2 Runtime & API Platform
**Baseline:** `5d38d2db360e16004863ba7bf0c440a9be3ac1a7` (`oic`, matching `origin/oic`)
**Disposition:** OIC-2 ACCEPTANCE PASS; READY FOR OIC-ONLY COMMIT/PUSH

## Delivery and stage status

| Stage | Result | Evidence |
|---|---|---|
| 2A Runtime contract and kernel | PASS | Native provider-neutral request/response/error and raw-usage contracts; bounded policy and safe error behavior |
| 2B Authenticated runtime context | PASS | OIC machine credential, Application and Service Principal identity, active Tenant resolution/grant checks; spoofed identities rejected |
| 2C Native Runtime API | PASS | Invocation and streaming routes; authenticated live requests fail closed with `MODEL_NOT_AVAILABLE` while no production model binding exists |
| 2D Compatibility gateway | PASS | `/v1/models`, Chat Completions and Responses translate into Native Runtime; only Oi model identities are exposed |
| 2E Streaming and idempotency | PASS | Acceptance covers replay/conflict/isolation and stream lifecycle; live no-binding error path returns normalized errors |
| 2F OIC client | PASS | Separate typed package imports OIC contracts without server/database dependencies |
| 2G Runtime/API acceptance | PASS | All bounded validation below passed; no test failures or skips |

No production provider, Oi Model binding, provider credential or fake production inference was added. `MODEL_NOT_AVAILABLE` is the expected behavior until OIC-3 publishes an approved binding.

## Validation evidence

- `pnpm.cmd --version`: PASS (`9.15.4`). Workspace pnpm cache access was recovered through the configured writable user tooling root. No ACL changes, dependency reinstall, or upgrade.
- `pnpm.cmd --filter @oic/contracts typecheck`: PASS.
- `pnpm.cmd --filter @oic/contracts build`: PASS.
- `pnpm.cmd --filter @oic/database db:validate`: PASS.
- `pnpm.cmd --filter @oic/database db:generate`: PASS.
- `pnpm.cmd --filter @oic/database typecheck`: PASS.
- `pnpm.cmd --filter @oic/database build`: PASS.
- Migration status: PASS on `oic_development` and `oic_migration_test`; all four migrations applied and schema up to date, including `20260930200000_oic_runtime_idempotency`.
- `pnpm.cmd --filter @oic/api typecheck`: PASS.
- `pnpm.cmd --filter @oic/api lint`: PASS.
- `pnpm.cmd --filter @oic/api build`: PASS.
- `pnpm.cmd --filter @oic/api test`: PASS, 25 tests, 0 failures, 0 skipped.
- `pnpm.cmd --filter @oic/client typecheck`: PASS.
- `pnpm.cmd --filter @oic/client build`: PASS.
- `pnpm.cmd --filter @oic/client test`: PASS, 6 tests, 0 failures, 0 skipped.
- Built API live health and readiness: PASS, HTTP 200; readiness confirmed database OK.
- Authenticated live smoke with a temporary OIC principal: `/v1/models` returned HTTP 200 with an empty list; Native Runtime, Chat Completions, Responses, and all three supported stream paths returned normalized `MODEL_NOT_AVAILABLE`. The temporary application, tenant, principal, grants, credential, and idempotency records were removed; cleanup was verified.
- Official `@oic/client` OpenAPI generation: PASS. Served document has all five required routes with bearer security; no recovery CLI HTTP route and no credential-like secret values.
- Dependency boundaries: PASS. Client has no database/API-internal import; Native Runtime contracts have no OpenAI DTO dependency; compatibility calls Native Runtime; no Responix coupling or Responix Prisma models found.
- Security review: PASS for the bounded OIC-2 diff. No provider credentials/secrets added; bearer auth and tenant scopes enforced; model/provider leakage absent; test executor remains unregistered in production; no Responix coupling.
- `git diff --check`: PASS.

The live smoke exposed a pre-stream cleanup defect: response cleanup ended the raw HTTP response before the normalized exception filter could handle model-resolution failures. Native and compatibility streaming now end the response only after headers have been sent. The API test suite passes after this fix.

## Architecture locks

The Master Architecture Charter records both approved clarifications:

- OIC and Responix are independent by design, unified by default deployment, and separable when scale requires. Co-hosting does not merge service boundaries, database ownership, security identities, or API/contract communication.
- OIC is an internal Oi platform capability, never a customer-facing product surface under the current lock. Customers use the product-facing Responix edge, never receive OIC credentials, and do not directly call OIC Runtime/Admin APIs. A future customer API offering does not imply direct OIC exposure.

No deployment orchestration was added. No Responix source or database, production/shared/customer database, frontend, or provider credential was changed. `.env.oic.local` remains ignored and unstaged.

## Git disposition

The worktree remains on branch `oic`, with `HEAD == origin/oic == 5d38d2db360e16004863ba7bf0c440a9be3ac1a7` before the OIC-2 commit. This implementation has not yet been staged, committed, or pushed. Stage only the reviewed OIC-2 implementation and approved project-state documentation; commit as `feat(oic): build runtime and API platform`; push only `origin/oic`, then verify the remote hash and worktree.