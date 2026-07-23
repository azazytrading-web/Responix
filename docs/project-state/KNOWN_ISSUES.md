# Known Issues and Constraints

Status meanings: **Resolved** is fixed in the repository; **Pending** requires action before the related capability is complete; **Planned** belongs to a future documented phase.

## Environment Issues

| Status  | Issue                                                               | Impact                                                             | Next action                                                                                                                                  |
| ------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Pending | No persistent local `.env` was present during runtime verification. | Root `pnpm dev` API startup rejects required configuration values. | Create an uncommitted local `.env` from `.env.example` with valid local values, or use temporary process variables for limited verification. |
| Pending | Git tooling reported that the workspace is not a Git repository.    | Branch, status, commit, and history checks cannot be relied upon.  | Verify repository initialization and `.git` metadata before the next implementation sprint.                                                  |

## Windows Issues

| Status   | Issue                                                                                | Impact                                         | Next action                                                                                                          |
| -------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Resolved | Parallel workspace validation and Next worker processes exhausted local resources.   | OOM/process failures during checks and builds. | Root validation tasks and Next build use one worker. Reassess only with evidence from a higher-capacity environment. |
| Resolved | Windows denied symlink creation while Next generated standalone tracing output.      | Local standalone build packaging failed.       | Dashboard emits standalone output on Linux/Docker only; Windows keeps standard `.next` output.                       |
| Resolved | Jest worker processes failed to spawn (`EPERM`) in the recorded Windows environment. | API test process could not start workers.      | API Jest command uses `--runInBand`.                                                                                 |

## Linux Differences

| Status   | Difference                                                              | Consequence                                                                                 |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Resolved | Dashboard standalone output is enabled outside Windows.                 | Docker/Linux builds retain the standalone artifact expected by `apps/dashboard/Dockerfile`. |
| Pending  | Docker/Linux runtime has not been executed in the recorded environment. | Compose service health still needs verification on a Docker-capable host.                   |

## Docker Requirements

| Status  | Requirement                                                                    | Consequence                                                                  |
| ------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Pending | Docker must be installed and available on `PATH`.                              | `docker compose up -d` could not run in the recorded environment.            |
| Pending | PostgreSQL and Redis must be running for complete infrastructure verification. | Ports 5432 and 6379 were unavailable locally.                                |
| Pending | API Docker service requires a valid `.env` file.                               | The Compose API service cannot obtain its required configuration without it. |

## Future Improvements

| Status  | Item                                                            | Notes                                                                                                          |
| ------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Planned | Replace deprecated Turbo `--parallel` development invocation.   | Turbo emits a deprecation warning and recommends persistent task relationships in `turbo.json`.                |
| Planned | Address Next’s non-fatal ESLint plugin-detection build warning. | Workspace lint passes; investigate only with relevant Next/ESLint configuration scope.                         |
| Planned | Add feature-specific automated tests.                           | Current foundation package test commands primarily run TypeScript validation; API Jest reports no tests found. |

## Technical Debt

| Status  | Item                                                     | Notes                                                                           |
| ------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Planned | Expand the Prisma schema to documented platform modules. | Only foundation models exist; add modules only in their planned sprint.         |
| Planned | Add production deployment validation.                    | Docker assets exist but have not been verified in a Docker-capable environment. |

## Open Questions

| Status  | Question                                                 | Required source                                 |
| ------- | -------------------------------------------------------- | ----------------------------------------------- |
| Pending | Which official documents define Sprint 1 scope?          | The approved Sprint 1 request.                  |
| Pending | What Git remote/branch policy applies to this workspace? | Repository metadata or project owner direction. |

## Current Blockers

| Status  | Blocker                                           | Scope                                                     |
| ------- | ------------------------------------------------- | --------------------------------------------------------- |
| Pending | Docker unavailable locally.                       | PostgreSQL, Redis, and Compose runtime verification only. |
| Pending | Valid persistent local configuration unavailable. | Standard root `pnpm dev` API startup only.                |
