# OIC Runtime/API Platform Sprint 2 Progress

**Sprint:** OIC-2 Runtime & API Platform
**Baseline:** `5d38d2db360e16004863ba7bf0c440a9be3ac1a7` (`oic` / `origin/oic`)
**Worktree:** dirty with OIC-2 implementation, as expected
**Status:** OIC-2 ACCEPTANCE PASS; READY FOR COMMIT/PUSH

| Stage | Status | Files / API state | Validation evidence | Blocker / next step |
|---|---|---|---|---|
| 2A Runtime Contract & Kernel | IMPLEMENTED; source checks PASS | Native OIC Runtime types, model resolver/executor/policy ports, bounded policy and safe errors | Contracts typecheck; API non-emitting TypeScript check and ESLint pass | Rebuild and permanent API acceptance needed |
| 2B Authenticated Runtime Context | IMPLEMENTED; source checks PASS | Authenticated credential principal, explicit runtime scopes, active Application/Tenant grant and external-reference resolution | Service authorization is checked at HTTP guard and service boundary; acceptance coverage authored | DB-backed acceptance has not run in this session |
| 2C Native Runtime API | ACCEPTED | `/api/v1/runtime/invocations`, `/api/v1/runtime/stream`; request identity, limits, raw usage, idempotency and SSE | Authenticated live invocations/streams fail closed with normalized `MODEL_NOT_AVAILABLE` | None |
| 2D OpenAI Compatibility Gateway | ACCEPTED | `/v1/models`, `/v1/chat/completions`, `/v1/responses`; text-only translation over Native Runtime | Persistent acceptance and authenticated live smoke pass; no provider identity leakage | None |
| 2E Streaming + Runtime Idempotency | ACCEPTED | Native event stream, cancellation, no replay keys for streams, persisted completed results and in-progress claims | API acceptance and authenticated live error-path smoke pass; pre-stream cleanup defect fixed | None |
| 2F OIC Client + Contract Distribution | ACCEPTED | Independent `@oic/client`, generated OpenAPI JSON/path types, invoke/stream client | Typecheck/build pass; 6 persistent tests pass with no skips | None |
| 2G Runtime/API Acceptance | PASS | Full bounded OIC-2 gates completed | API: 25 tests; client: 6 tests; both OIC DBs up to date; package builds and live smoke pass | Ready for final review and OIC-only commit/push |

## Attempted commands and exact outcomes

- `pnpm --filter @oic/contracts typecheck`: PASS.
- `pnpm --filter @oic/api exec tsc -p tsconfig.build.json --noEmit`: PASS.
- `pnpm --filter @oic/client exec tsc -p tsconfig.json --noEmit`: PASS.
- `pnpm --filter @oic/api lint`: PASS after fixing the cancellation test assertion.
- `pnpm --filter @oic/database db:validate` with the ignored OIC development URL loaded into the process: PASS.
- `pnpm --filter @oic/api build`: BLOCKED; Nest compiler cannot unlink existing `apps/oic-api/dist/bootstrap-admin.js` (`EPERM`). Retried; same result. Listener check on port 4117 found none; Windows process enumeration was denied, so no process was terminated.
- `pnpm --filter @oic/database db:generate`: BLOCKED; Prisma cannot unlink its generated client under `node_modules/.pnpm` (`EPERM`).
- `pnpm --filter @oic/client build`: BLOCKED; TypeScript cannot write existing generated `packages/oic-client/dist` files (`EPERM`).
- `pnpm --filter @oic/client test`: NOT RUN because build could not refresh the test bundle.
- `pnpm --filter @oic/api test`: NOT RUN because API build could not refresh the test bundle.
- Prisma `migrate status` against OIC development DB: BLOCKED; Prisma schema engine process spawn denied (`EPERM`). Migration status for both OIC databases is unverified in this continuation.
- `git diff --check`: BLOCKED by a single extra blank line at EOF in `apps/oic-api/src/modules/identity/foundation.service.ts`. A targeted write attempt returned `UnauthorizedAccessException` despite inherited `Modify` ACL and no read-only attribute.
- Live API route/auth/readiness smoke: NOT RUN because a refreshed build could not be produced.

## EPERM investigation and recovery attempt (2026-09-30)

| Exact path | Classification | Existence / attributes / ACL | Process evidence / recovery |
|---|---|---|---|
| `G:\Trading\OIC\apps\oic-api\dist\bootstrap-admin.js` and `G:\Trading\OIC\apps\oic-api\dist` | A. Generated API build output; `dist` is untracked and `nest-cli.json` sets `deleteOutDir: true` | Exists; Archive file / Directory tree; not read-only; inherited Authenticated Users Modify; owner is workspace user | API build unlink returned EPERM. Port 4117 had no listener. `Get-CimInstance` and `tasklist` process queries returned Access denied; `Get-Process node,prisma,schema-engine-windows` found no visible processes. A bounded rename to `dist.oic2-eprem-backup` was denied with Access denied. No process stopped and no output removed. |
| `G:\Trading\OIC\packages\oic-client\dist\client.js` and `G:\Trading\OIC\packages\oic-client\dist` | A. Generated SDK build output; untracked, TypeScript `outDir: dist` | Exists; Archive file / Directory tree; not read-only; inherited Authenticated Users Modify; owner is workspace user | Client build could not write. No rename attempted after the API output tree rename was denied. |
| `G:\Trading\OIC\node_modules\.pnpm\@prisma+client@6.19.3_prisma@6.19.3_typescript@5.9.3__typescript@5.9.3\node_modules\.prisma\client\index.js` and its containing `client` directory | B. Generated Prisma Client output | Exists; Archive file / Directory tree; not read-only; inherited Authenticated Users Modify; owner is workspace user | Prisma generation unlink returned EPERM. No owning process could be identified or stopped because Windows process metadata is denied. No generated Prisma output removed. |
| `G:\Trading\OIC\apps\oic-api\src\modules\identity\foundation.service.ts` | D. Authored source | Exists; Archive; not read-only; inherited Authenticated Users Modify; owner is workspace user | Bounded write to remove only trailing blank lines returned UnauthorizedAccessException. Process metadata is unavailable, so the file cannot be proven free of a lock. No source workaround/refactor attempted. |
| `G:\Trading\OIC\packages\oic-client\src\generated\oic-openapi.json` and `oic-api.paths.ts` | C. Generated OpenAPI/client contract artifacts (not implicated in prior EPERM) | Present; no failed write recorded | Not edited; regeneration is not required absent source/DTO changes affecting docs. |

No B. identified OIC process could safely be stopped: available process enumeration APIs (`Get-CimInstance`, `tasklist`) both returned Access denied, and no Node/Prisma processes were visible via `Get-Process`. No system ACL changes, recursive deletes, `git clean`, resets or database changes were made. Exact failed conditions remain unrecovered and Sprint 2 must stop for a session with process visibility or an unlocked workspace.

## Boundaries and decisions

- Only the independent OIC workspace `G:\Trading\OIC` was used. No Responix repository or database was opened.
- Production model resolution returns no visible models and production execution fails closed; no provider credential or upstream integration was added.
- Test doubles are only injected directly by acceptance tests, not registered in normal runtime modules.
- Native OIC Runtime is canonical; compatibility routes translate only the documented text subset and reject unsupported options.
- OIC-2 adds only the runtime scopes to the Foundation allowlist. The protected platform-administrator recovery scope set remains unchanged.
- Provider Fabric, Oi Model persistence/revisions/variants, provider credentials and upstream inference remain OIC-3 scope.

## Continuation after workspace recovery (2026-09-30)

The prior filesystem write blocker was resolved by operating Codex from the correct OIC Git-worktree workspace, `G:\Trading\OIC`. A targeted create/read/delete probe there returned PASS for all three operations. This was a workspace-selection recovery; there is no evidence of filesystem ACL corruption. The known extra EOF blank line in `apps/oic-api/src/modules/identity/foundation.service.ts` was removed, and `git diff --check` passed.

The approved deployment clarification is recorded in the Master Architecture Charter: OIC and Responix remain independent by design, may be co-hosted in one Oi platform deployment by default, and may be separated as scale requires. No orchestration implementation is added to OIC-2.

Validation resume attempt: `pnpm.cmd --filter @oic/database db:validate` could not start because pnpm received EPERM reading `C:\Users\Compu Europe\AppData\Local\pnpm\config\rc` and creating the versioned pnpm tool cache under that same user-level directory. Redirecting APPDATA/LOCALAPPDATA and pnpm cache variables to workspace-local directories did not redirect this tool-manager cache. An elevated execution request did not proceed. No Prisma, build, acceptance, migration, or live API gate is claimed as run in this continuation. No generated output was deleted, no database was accessed, and no commit or push was made.

**Current disposition: OIC-2 NOT ACCEPTED; NO COMMIT/PUSH.** Resume the remaining gates from the exact prior sequence once pnpm can run with its required cache, preserving this dirty worktree. Then complete both OIC database migration checks, generation/builds, persistent API/client acceptance, live smoke, OpenAPI and boundary/security review before acceptance and push.

## Final continuation validation (2026-09-30)

Environment recovery is PASS. Workspace `G:\Trading\OIC`, branch `oic`; `HEAD` and `origin/oic` remain at baseline `5d38d2db360e16004863ba7bf0c440a9be3ac1a7` pending this OIC-2 commit. `pnpm.cmd --version` returned `9.15.4`; its configured user cache is writable. No ACL changes or dependency reinstall/upgrade occurred.

The prior workspace write blocker was resolved by operating in the correct OIC Git worktree. The create/read/delete probe passed; this was workspace selection, not filesystem ACL corruption. The targeted EOF whitespace cleanup passes `git diff --check`.

Validation performed:

- PASS: `pnpm.cmd --filter @oic/contracts typecheck`, `build`.
- PASS: `pnpm.cmd --filter @oic/database db:validate`, `db:generate`, `typecheck`, `build`.
- PASS: migration status on `oic_development` and `oic_migration_test`; all four migrations applied, schema up to date, including `20260930200000_oic_runtime_idempotency`.
- PASS: `pnpm.cmd --filter @oic/api typecheck`, `lint`, `build`, `test`; 25 tests passed, 0 failed, 0 skipped.
- PASS: `pnpm.cmd --filter @oic/client typecheck`, `build`, `test`; 6 tests passed, 0 failed, 0 skipped.
- PASS: built API live health/readiness; authenticated temporary OIC principal tested `/v1/models`, Native Runtime, Chat Completions, Responses, and Native/chat/Responses streams. Model listing is empty; calls/streams return normalized `MODEL_NOT_AVAILABLE` because no production binding exists. Temporary application, tenant, principal, grants and credential were deleted and cleanup verified.
- PASS: official OpenAPI generation and served-document checks: five required paths, bearer security, no recovery HTTP route, no secret values.
- PASS: client/API/database boundaries and `git diff --check`.

Live smoke found that pre-stream failures ended the raw response before the normalized exception filter could reply. Native and compatibility stream cleanup now ends responses only after headers have been sent. The regression is covered by the API acceptance suite, which remains green.

Architecture locks are recorded in the Master Architecture Charter: unified-by-default co-host deployment and the internal-only OIC customer exposure boundary. OIC and Responix remain independent service/data owners; customers use only product-facing Responix APIs and never receive OIC credentials or direct OIC access.

No Responix source/database, production/shared/customer database, provider credential, or frontend was touched. No commit or push has yet occurred; proceed to final staged review and commit/push only `origin/oic`.