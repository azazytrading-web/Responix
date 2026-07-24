# Engineering Workflow

> Current project state (2026-07-25): Sprint 4 is complete and Sprint 5 — AI Engine is the active sprint. The workflow below is unchanged.

> Sprint 4 closeout (2026-07-25): the workflow is unchanged. Its full validation sequence passed for the Workspace & Multi-Tenant Core; Docker-based runtime verification remains contingent on Docker being available locally.

This workflow supplements official project documentation. If it conflicts with an approved sprint request or official document, the official source takes precedence.

## Starting a New Session

1. Read `AI_CONTEXT.md`, `SESSION_HANDOFF.md`, `KNOWN_ISSUES.md`, and `ROADMAP_STATUS.md`.
2. Confirm the active sprint, task, and whether approval is required before implementation.
3. Read only official documents explicitly named by that sprint.
4. Inspect repository state and Git metadata if available; do not assume it is usable.
5. Check Docker and local configuration prerequisites before runtime work.

## Reading Latest Commits and Creating a Branch

When Git metadata is available, inspect latest commits and status before creating one focused branch.

| Change type   | Pattern           | Example                  |
| ------------- | ----------------- | ------------------------ |
| Feature       | `feature/<scope>` | `feature/workspace-auth` |
| Bug fix       | `fix/<scope>`     | `fix/api-health-route`   |
| Documentation | `docs/<scope>`    | `docs/project-memory`    |
| Maintenance   | `chore/<scope>`   | `chore/turbo-workflow`   |

Current workspace note: Git metadata and the configured remote were confirmed on `feature/sprint-1-foundation`. Still inspect status and recent history before branch or release work.

## Implementing Work

1. Identify affected applications, packages, infrastructure, tests, and documentation.
2. Follow the approved sprint’s implementation order: structure, interfaces/types, DTOs, entities, repositories, services, controllers, tests, documentation.
3. Preserve strict TypeScript and shared package boundaries.
4. Do not add fake code, placeholder business logic, hard-coded AI providers, or unrelated refactors.
5. Keep secrets only in uncommitted local configuration.
6. Fix root causes; never suppress a rule merely to pass validation.

## Validation Pipeline

Run focused checks while developing. Before review, commit, or sprint handoff, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.

Record failures, fixes, and final exit status in the development log and handoff.

## Runtime Verification

1. When Docker is available, start dependencies with `docker compose up -d` and inspect them with `docker compose ps`.
2. Use an uncommitted `.env` derived from `.env.example`, or temporary environment values only for limited local verification.
3. Start servers with `pnpm dev`.
4. Verify Dashboard, API, service health, relevant endpoints, and hot reload when affected.
5. Distinguish repository defects from unavailable Docker, missing local configuration, and OS/sandbox restrictions.

## Updating Documentation

Before handoff, update as applicable:

- `DEVELOPMENT_LOG.md` for chronological evidence.
- `KNOWN_ISSUES.md` for constraints and their status.
- `ARCHITECTURE_DECISIONS.md` for durable decisions.
- `ROADMAP_STATUS.md` only when actual sprint progress changes.
- `SESSION_HANDOFF.md` for the immediate next engineer.

## Commit, Push, Pull Request, and Merge

When Git metadata and remote configuration are available:

1. Inspect the exact diff and exclude generated files and secrets.
2. Run the validation pipeline.
3. Commit one coherent change.
4. Push the focused branch.
5. Open a pull request with scope, validation, runtime evidence, risks, and follow-up work.
6. Merge only after required review and checks pass.

### Conventional Commit Examples

- `feat(api): add workspace authentication`
- `fix(api): regenerate output after clean Nest build`
- `docs(project-state): record Sprint 0 handoff`
- `chore(workspace): update validation workflow`
- `test(api): cover health endpoint`

## Definition of Done

- Scope matches approved sprint and official documentation.
- Required implementation, tests, documentation, and runtime verification are complete.
- Complete workspace validation passes.
- Environmental blockers are documented separately from repository defects.
- Handoff documentation is current.

## Definition of Ready

Work may begin only when the sprint request is approved, its named official documents have been read, affected modules and validation are known, and required environment prerequisites are either available or explicitly recorded as blockers.

## Validation Recovery

1. Preserve the failing output and identify the root cause.
2. Fix the root cause without disabling rules, tests, or checks.
3. Re-run the failed command, then the full validation pipeline before handoff.
4. Record the failure and resolution in `DEVELOPMENT_LOG.md`, `VALIDATION_HISTORY.md`, and `SESSION_HANDOFF.md` when material.

## Repository Recovery

1. Inspect Git metadata, status, and recent history when available.
2. Preserve user changes; never use destructive reset or checkout commands without explicit authorization.
3. Restore dependencies or generated artifacts only through the documented workspace commands.
4. If repository metadata is missing or invalid, record it in `KNOWN_ISSUES.md` and obtain project-owner direction before branch or release work.

## Release Workflow

1. Confirm the release scope, Definition of Done, and complete validation evidence.
2. Review the exact diff; exclude generated files, local configuration, and secrets.
3. Create a release commit and pull request through the configured Git workflow.
4. Create an annotated Git tag only after merge approval.
5. Publish a GitHub Release only after the tag and release notes are confirmed.

### Git Tag Workflow

Use semantic tags when a release process is approved, for example `v0.1.0`. Verify the target commit, validation evidence, and release notes before creating or pushing a tag.

### GitHub Release Workflow

Use the approved tag as the release target. Include scope, validation commands/results, known limitations, migration notes, and rollback considerations. Do not publish a release from unverified local state.

## Emergency Recovery After an Interrupted AI Session

1. Do not restart completed sprint work.
2. Read `SESSION_HANDOFF.md`, `DEVELOPMENT_LOG.md`, and recent runtime evidence.
3. Inspect only processes and artifacts created by the interrupted session before stopping them.
4. Re-run only the validation or runtime check needed to establish the next safe state.
5. Preserve user changes and avoid destructive Git operations.
6. Record the interruption, root cause, and recovery result in the next handoff.
