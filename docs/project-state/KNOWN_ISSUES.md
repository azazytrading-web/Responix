# Known Issues and Constraints

Status meanings: **Resolved** is fixed in the repository; **Pending** requires action before the related capability is complete; **Planned** belongs to a future documented phase.

## Resolved During Sprint 1

| Issue                                          | Resolution                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Git metadata and remote availability           | Confirmed on `feature/sprint-1-foundation`; branch and history checks work normally.      |
| Sprint 1 source audit and workspace validation | Completed with install, typecheck, lint, test, build, and Markdown formatting evidence.   |
| Windows parallel-worker resource exhaustion    | Validation tasks and Next static generation use constrained concurrency.                  |
| Windows standalone symlink creation            | Dashboard emits standalone output on Linux/Docker and standard `.next` output on Windows. |
| Windows Jest worker spawning                   | API Jest runs in-band.                                                                    |

## Environment Issues

| Status  | Issue                                                               | Impact                                                             | Next action                                                                                                                                  |
| ------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Pending | No persistent local `.env` was present during runtime verification. | Root `pnpm dev` API startup rejects required configuration values. | Create an uncommitted local `.env` from `.env.example` with valid local values, or use temporary process variables for limited verification. |

## Windows Issues

| Status  | Issue                                                                          | Impact                                        | Next action                                                                                  |
| ------- | ------------------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Pending | The restricted local shell denies Node child-process creation (`spawn EPERM`). | Next build cannot complete inside that shell. | Run build outside the restricted shell; the unrestricted Windows build passed on 2026-07-24. |

## Linux Differences

| Status  | Difference                                                              | Consequence                                                               |
| ------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Pending | Docker/Linux runtime has not been executed in the recorded environment. | Compose service health still needs verification on a Docker-capable host. |

## Docker Requirements

| Status  | Requirement                                                                    | Consequence                                                                  |
| ------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Pending | Docker must be installed and available on `PATH`.                              | `docker compose up -d` could not run in the recorded environment.            |
| Pending | PostgreSQL and Redis must be running for complete infrastructure verification. | Ports 5432 and 6379 were unavailable locally.                                |
| Pending | API Docker service requires a valid `.env` file.                               | The Compose API service cannot obtain its required configuration without it. |

## Future Improvements

| Status  | Item                                                                             | Notes                                                                                                          |
| ------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Planned | Replace deprecated Turbo `--parallel` development invocation.                    | Turbo emits a deprecation warning and recommends persistent task relationships in `turbo.json`.                |
| Planned | Address NextÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s non-fatal ESLint plugin-detection build warning. | Workspace lint passes; investigate only with relevant Next/ESLint configuration scope.                         |
| Planned | Add feature-specific automated tests.                                            | Current foundation package test commands primarily run TypeScript validation; API Jest reports no tests found. |
| Planned | Use Redis-backed throttler storage before horizontally scaling the API.          | The configured global throttler is process-local; Redis is already available for the future shared store.      |

## Technical Debt

| Status  | Item                                                     | Notes                                                                           |
| ------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Planned | Expand the Prisma schema to documented platform modules. | Only foundation models exist; add modules only in their planned sprint.         |
| Planned | Add production deployment validation.                    | Docker assets exist but have not been verified in a Docker-capable environment. |

## Open Questions

| Status  | Question                                        | Required source                |
| ------- | ----------------------------------------------- | ------------------------------ |
| Pending | Which official documents define Sprint 2 scope? | The approved Sprint 2 request. |

## Current Blockers

| Status  | Blocker                                           | Scope                                      |
| ------- | ------------------------------------------------- | ------------------------------------------ |
| Pending |                                                   | Pending                                    | Docker unavailable locally (`docker` is not on `PATH`). | PostgreSQL, Redis, migration/seed application, API, Dashboard, and Compose runtime verification only. |
| Pending | Valid persistent local configuration unavailable. | Standard root `pnpm dev` API startup only. |

## Sprint 2 Resolution Update

| Status   | Issue                                   | Resolution                                                                                                 |
| -------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Resolved | Complete documented database foundation | Prisma schema, migration, pgvector indexing, and mandatory bootstrap seed data are complete and validated. |

## Current Blocker Update

Docker unavailable locally (`docker` is not on `PATH`) is the only remaining environment blocker. It prevents Compose, PostgreSQL/Redis, and live migration/seed verification; it is not a repository defect.

## Sprint 3 Resolution Update

| Status   | Issue                                               | Resolution                                                                                                                                            |
| -------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolved | Windows Next production-build worker memory failure | Dashboard build now uses `cross-env NODE_OPTIONS=--max-old-space-size=4096`, which propagates the heap limit to Next workers; two full builds passed. |
| Resolved | Authentication foundation                           | JWT, sessions, Argon2id, RBAC, guards, decorators, migration, and auth tests are implemented and validated.                                           |
