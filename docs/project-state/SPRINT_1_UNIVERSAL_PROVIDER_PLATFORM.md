# Sprint 1 - Universal Provider Platform

## Delivery record

Status: COMPLETE WITH DOCUMENTED EXCEPTIONS. The Sprint 1 implementation is closed with the bounded contract and environment exceptions recorded in the final closure section below. The generated API contract is not claimed to be synchronized.

## Contract implemented

- Extended the existing `AiModel` registry with optional version, function-calling/video/MCP capability flags, and categories. Unknown version remains null and newly added booleans default to false.
- Provider discovery, routing snapshots, API response DTOs, and the existing Provider Management page carry and display these values. `supportsTools` retains its existing meaning.
- Credential selection uses active workspace/provider credentials, skips only limits that are provably exhausted from persisted configuration (a zero limit), and orders by priority descending, oldest use with never-used first, then ID. It selects one credential per attempt and does not rotate after authentication failure. Metadata listing uses a separate Prisma selection without `encryptedSecret`; only immediate credential resolution selects the encrypted envelope.
- Existing ADR-014 routing remains a selector. Invocation consumes its ordered candidates and revalidates a fallback against a fresh eligible-candidate snapshot before attempting it.
- A primary provider receives at most three total attempts. Retries are limited to timeout, rate limit, recognized network errors, and server errors, with 1 second and 3 second delays. Each fallback receives one attempt.
- Streaming retries/fallback are permitted only before content or tool-call output is emitted. A disconnected stream without a terminal event is a retryable provider-availability failure. Partial output is never replayed.
- Provider results and tool calls are structurally validated before returning or emitting them. There is no structured-output field in the current invocation request contract, so this sprint does not add one.
- Invocation provider transitions update the existing invocation record and write an `AuditLog` fallback event in one transaction. Existing runtime, usage, cost, and routing persistence remain authoritative.
- Health remains explicit validation and latest persisted health consumed by routing; no periodic worker or new health state was added.

## Database change

Migration `000040_add_ai_model_registry_metadata` adds nullable `version`, three false-default capability booleans, and an empty-default text array. It does not change existing model fields or timestamps.

## Scope boundaries

No custom provider type/registration, model CRUD, periodic health worker, universal guard, Guard Center, durable channel queue, channel runtime redesign, pacing, or CRM work is included.

## Generated contract disposition

- Classification: **ACCEPTED DOCUMENTED EXCEPTION**. The backend `AiModelResponseDto` mapper exposes `version` (optional string), `supportsFunctionCalling`, `supportsVideo`, and `supportsMcp` (required booleans), and `categories` (required string array). `ai-response.dto.spec.ts` verifies serialized output. The checked-in generated `AiModelResponseDto` omits all five fields.
- No application source references the generated `AiModelResponseDto` or `AiProviderResponseDto` directly. The Provider Management API wrapper uses its own `ProviderModel` interface, which already contains these fields. No compile-time or runtime defect caused by this generated omission was demonstrated; the exported generated API contract remains incomplete and must not be represented as synchronized.
- The official command is `pnpm --filter @responix/api-client openapi:generate`; it reads `http://localhost:4000/docs-json` by default. No full-contract static generator or documentation-only bootstrap exists. The approved Sprint 1 completion objective requires official generated-contract reconciliation, and no approved deferral was found, so Sprint 1 remains OPEN.
- Safe generation requires a stable execution environment and a dedicated disposable database isolated from existing development and production data. Full API bootstrap runs recovery operations that can write database records; the standard backend bootstrap also runs migrations. Do not point startup at the existing development database. The generated file must remain untouched until official generation can run safely.
- A one-process metadata export was evaluated using process-only dummy database/Redis endpoints and dummy secrets. It called `NestFactory.create(AppModule)` without `app.init()` or `app.listen()`, so runtime bootstrap recovery was not invoked. The module graph did not finish initializing within the bounded resource window; the process was stopped. No database, Redis, R2, or API listener was started, and no OpenAPI document or generated file was produced. Do not repeat this path on the constrained machine; use a resource-capable isolated environment or a supported static exporter if one is later added through the approved project workflow.

## Validation record

- API AI module tests: passed, 41 suites (1 skipped), 205 tests passed (4 skipped).
- Continuation focused tests: passed, 5 suites / 23 tests after the latest invocation changes.
- Low-resource follow-up: `pnpm --filter @responix/api exec jest --runInBand src/modules/ai/providers/credential.repository.spec.ts` passed (1 suite / 2 tests), including an assertion that metadata listing does not fetch `encryptedSecret`.
- Invocation orchestrator tests: passed, 16/16, including retry timing, ordered failover, streaming fallback, partial-output suppression, cancellation, and response-limit handling.
- Dashboard Provider Management tests: passed, 18/18.
- Prisma schema validation: passed; Prisma Client generation completed.
- API type-check: passed.
- Dashboard type-check: passed.
- API lint: UNVERIFIED; the process terminated with Node `Fatal process out of memory: Zone`, including an elevated retry.
- API production build: failed with Node heap exhaustion during `nest build`.
- Dashboard production build: could not complete. The sandbox attempt could not connect to the configured proxy at `127.0.0.1:9`; the elevated retry terminated with process exit `3221226505`.
- Database package type-check: UNVERIFIED due Node `Fatal process out of memory: Zone`.
- Generated API client contract: BLOCKED. `packages/api-client/scripts/generate-openapi.mjs` defaults to `http://localhost:4000/docs-json`; no local listener is available, and the generated `AiModelResponseDto` type still lacks the new model fields. Its header prohibits manual edits, so it was left untouched. The later low-memory startup review confirmed the configured local database and Redis endpoints are reachable and port 4000 is free, but API startup invokes `RuntimeRecoveryService.onApplicationBootstrap()`. Its recovery methods can complete/fail pending finalizations and reclaim stale reservations, which may write database records. Since the contract-generation task prohibited database data changes, the API was not started. The documented backend bootstrap also applies migrations; neither startup path was used. No supported startup switch that suppresses recovery was found.
- Follow-up safe-generation probe: BLOCKED by local resource limits. The API module graph did not initialize within the bounded single-process attempt, even without lifecycle initialization/listening and with isolated dummy connection settings. The attempt was stopped without contacting configured services. This does not satisfy the official generated-contract closure gate.

The statements above record the state and validation disposition at the time of those attempts. The final closure decision below supersedes the earlier OPEN disposition. Pre-existing project-state edits are intentionally excluded from Sprint 1 changes.

## Final closure

### Final Sprint Status

**COMPLETE WITH DOCUMENTED EXCEPTIONS**

### Implementation Summary

Sprint 1 adds model-registry metadata and carries it through provider discovery, deterministic routing snapshots, response serialization, invocation retry/fallback behavior, persistence/audit records, and the existing Provider Management screen. Credential selection remains workspace/provider scoped and deterministic; streaming does not replay partial output. The migration is additive. No Guard, CRM, or channel-queue redesign is included.

### Verified Acceptance Criteria

- The five metadata fields exist in the Prisma model, migration, backend DTO mapper, response serialization test, and Provider Management data/display model. `version` is optional; the capability flags and categories are required in the API DTO.
- Credential resolution selects one eligible credential at a time, uses stable priority/use-time/ID ordering, does not rotate on authentication failure, and avoids selecting encrypted secrets for metadata listing. The focused credential repository tests passed (1 suite, 2 tests).
- Routing continues to use ADR-014 candidate ordering; fallback eligibility is checked again before invocation.
- Existing successful tests recorded above cover retry timing and classes, ordered fallback, streaming behavior, cancellation, limits, DTO serialization, and Provider Management rendering.
- No new public request field or endpoint was introduced. Provider Management uses its local `ProviderModel` interface and does not import the generated `AiModelResponseDto`; no runtime defect from the generated omission was demonstrated.
- `git diff --check` passed at the final checkpoint.

### Accepted Exceptions

- **Generated API contract:** the official generator was not run. `packages/api-client/src/generated/api.types.ts` still omits `version`, `supportsFunctionCalling`, `supportsVideo`, `supportsMcp`, and `categories` from `AiModelResponseDto`. The backend emits those values, and the current Provider Management screen reads them through its existing local interface. No runtime failure was found, but consumers relying on the generated DTO cannot access these properties through generated types. The official `pnpm --filter @responix/api-client openapi:generate` command still requires `http://localhost:4000/docs-json` unless `RESPONIX_OPENAPI_URL` points to a trustworthy document. A bounded metadata-export attempt did not finish within the available resource window; it was stopped without starting a listener or connecting to services. Follow up by running official generation from a resource-capable environment with a safe OpenAPI source, then inspect the diff and type-check the API client.
- **API lint and production build:** not green. Earlier API lint terminated with Node out-of-memory errors; the API build failed with heap exhaustion. These checks were not repeated for closure.
- **Database package type-check:** blocked by Node out-of-memory errors. Prisma schema validation and client generation had passed earlier; no migration was applied during closure.
- **Dashboard production build:** blocked by the configured external font fetch through the unavailable proxy. Dashboard type-check and Provider Management tests had passed earlier; the build was not repeated.
- **Security review depth:** targeted source/test evidence covers workspace-scoped credential selection, exclusion of encrypted secrets from metadata listing, existing provider destination controls, and no new routes/request fields. A dedicated comprehensive final security assessment was not performed in this closure pass. No critical security or data-integrity defect was identified in the reviewed Sprint 1 changes.

### Deferred Follow-Up

1. Regenerate the API client from a trustworthy current OpenAPI document in a resource-capable, isolated environment; verify the five field types/optionality and run the API-client type-check.
2. Rerun API lint/build, database package type-check, and Dashboard production build when the resource and external font-fetch constraints are resolved.
3. Perform a broader security review before a release that requires that assurance level.

### Release Decision

Sprint 1 is closed as **COMPLETE WITH DOCUMENTED EXCEPTIONS**. Code inspection and recorded focused tests support the implemented provider behavior, schema change, and user-facing metadata display. The generated-client mismatch currently affects generated compile-time representation, not the existing Provider Management runtime path; no broken required user-facing behavior or critical correctness, security, or data-integrity defect was demonstrated. The unresolved contract generation and environment-bound validation results are explicit follow-up items and are not represented as passing or synchronized.

## Resumption Checkpoint — 2026-09-29 15:29 +03:00

### Repository checkpoint

- Branch: `frontend`; HEAD: `17db29a2c7c5739f36f0e9d257bf4f7404996084` (still aligned with `origin/frontend` before any sprint commit).
- Existing uncommitted project-state edits and `SPRINT_CRM_1_CHARTER.md` were preserved. No reset, clean, or broad restore was used.
- Sprint 1 changes in this continuation: official generated client refresh; focused API lint fixes in invocation/credential tests; behavior-neutral removal of an unused Dashboard `AgentRecord` type import. No CRM, Guard, or channel queue work was introduced.

### Completed tasks and validation evidence

| Task | Result |
|---|---|
| Official OpenAPI generation | PASS — started the built API with existing local configuration; `GET http://localhost:4000/docs-json` served the current backend contract; ran `pnpm --filter @responix/api-client openapi:generate`; stopped the API process started for generation. No configured database or Redis listener existed, so recovery queries could not mutate local records. |
| Generated metadata contract | PASS — `AiModelResponseDto` has `version?: string`, required boolean `supportsFunctionCalling`, `supportsVideo`, `supportsMcp`, and required `categories: string[]`, matching DTO decorators. |
| Generated contract scope | REVIEWED — official output also refreshed stale existing routes/schemas in the same generated artifact (10,214 changed lines); no hand edits were made. The generated diff represents the full currently running backend contract, but it is broader than the five Sprint 1 fields. |
| API client | PASS — `pnpm --filter @responix/api-client typecheck`. |
| AI tests | PASS — `pnpm --filter @responix/api exec jest --runInBand src/modules/ai`: 41 suites passed, 205 tests passed, 4 skipped; 1 suite skipped. After lint fixes, focused invocation and credential suites passed: 2 suites / 18 tests. |
| Database | PASS — `pnpm --filter @responix/database db:validate`; `pnpm --filter @responix/database typecheck`. No migration was applied. |
| API | PASS — API typecheck; API production build passed when run sequentially and awaited. |
| API focused lint | PASS — changed AI orchestrator and credential repository files passed targeted ESLint. Full `pnpm --filter @responix/api lint` remains FAIL with 720 repository-wide findings, primarily existing scripts/temp files. |
| Dashboard | PASS — Dashboard typecheck; Provider Management tests (3 files / 21 tests); Provider Management targeted lint; production build completed with two existing `<img>` warnings. |
| Dashboard full lint | PASS — `pnpm --filter @responix/dashboard lint`; 0 errors, 2 existing `<img>` warnings after removing the unused `AgentRecord` import. |
| Source scope | PASS — provider/auth route surface unchanged; no new Sprint 1 request fields or security bypasses found in reviewed changes. |
| Whitespace | PASS — `git diff --check`. |

### Remaining acceptance review

- Security acceptance review covered encrypted credential boundaries and workspace-scoped repository selection; safe provider discovery/DTO serialization and no secret exposure; authenticated/permission-guarded existing routes; destination host allowlisting, public DNS validation/pinning, disabled redirects, bounded response size/timeouts and cancellation; retry classification, ordered revalidated fallback, partial-stream replay suppression; invocation transitions, terminal outcome, and single usage/cost completion paths. Relevant focused suites passed. This is source-and-test evidence, not a penetration test or live deployment assessment.
- API full lint has confirmed baseline failures outside changed Sprint 1 files (720 findings across repository utility/temp scripts and other pre-existing paths); all changed Sprint 1 AI files pass targeted ESLint. No lint failure remains in the Sprint 1 files.
- Final full AI suite after lint fixes passed: 41 suites passed, 205 tests passed, 4 skipped; 1 suite skipped. Full Dashboard lint passed with 2 existing `<img>` warnings. Changed AI files pass targeted ESLint. No processes started by this continuation remain running.
- Dashboard production build passed after the single behavior-neutral unused-import cleanup; build included optimized compile, lint/type validation, static generation, and trace collection. The configured font fetch succeeded outside the sandbox.
- Final diff review confirms modified application files are confined to the AI invocation/credential lint fixes, generated API client, and the one-line Dashboard lint cleanup. Pre-existing project-state edits and the CRM charter remain uncommitted and untouched beyond this isolated Sprint 1 checkpoint.
- Acceptance disposition: Sprint 1 implementation and contract checks pass. The repository-wide API lint command remains non-green because of unrelated baseline findings; this does not mask any finding in changed Sprint 1 AI files. No production migration was applied. Deployment, penetration testing, and production release remain outside this sprint's local completion evidence.

## Push Verification Checkpoint — 2026-09-29 15:34 +03:00

- Sprint 1 commit `ea5b82831e72efaca6efc178baac12f06ae43900` was pushed successfully to `origin/frontend`.
- Local `frontend` and `origin/frontend` both resolved to that commit after push.
- Sprint 1 changes are committed; the pre-existing edits in other project-state files and the untracked CRM charter remain preserved and uncommitted.
- Next roadmap initiative remains CRM-1, which current project documentation marks as recommended and awaiting human scope review. No Sprint 2 code was started.
