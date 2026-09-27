# Session Handoff

## Exact Current Resume Point — WhatsApp Connection Management - 2026-08-09

The Dashboard `/channels/whatsapp` page now supports full connection lifecycle management: create channel, create connection, view connected state, edit connection, regenerate verify token, copy callback URL, validate connection, and disconnect. All operations use real Channel Runtime APIs with write-only credentials.

The Callback URL is constructed from `NEXT_PUBLIC_WEBHOOK_BASE_URL` (or falls back to `NEXT_PUBLIC_API_URL`) plus the backend-generated `webhookPathKey`. For local development, a yellow warning banner appears because localhost cannot receive Meta webhooks.

Resume by:
1. Configuring `NEXT_PUBLIC_WEBHOOK_BASE_URL` to a public HTTPS endpoint (or using a tunnel like ngrok for development)
2. Entering authorized Meta Business Account credentials in the WhatsApp page
3. Saving the connection
4. Copying the generated Callback URL into Meta Developers
5. Copying the verify token (shown once after creation or regeneration)
6. Clicking "Validate connection" to confirm Meta responds

Do NOT delete or disconnect an existing working WhatsApp connection merely for testing.

## Exact Current Resume Point - 2026-08-09

## Exact Current Resume Point - 2026-08-09

FM-7's live gate passed with a real DeepSeek response. The Dashboard now exposes `/channels/whatsapp` from revision-5 backend-authoritative navigation. The page can create the workspace channel and submit/validate a manual Meta Cloud connection through real Channel Runtime APIs while keeping all credentials write-only. Resume by entering authorized development Meta Business Account/Phone Number credentials in that page, validate the connection, and configure Meta's webhook with the returned safe callback path; do not build Inbox or another resource UI first.

## Exact Live Resume Point - 2026-08-09

Services are running locally and healthy. Authenticate as the development Administrator, open `/ai/providers`, submit one authorized real provider key through the password/write-only field, validate it, then create/publish and execute one minimal Agent with the configured model. The workspace currently has six available provider definitions, zero configurations, zero credentials, and zero Agents. Do not paste a key into files or terminal output. Do not start another frontend milestone until this gate passes.

## FM-7 Current Handoff - 2026-08-09

Provider discovery and Prompt Library resource management are implemented and validated. Routes are `/ai/providers`, `/ai/prompts`, `/ai/prompts/new`, and `/ai/prompts/[promptId]`; plugins and development-manifest entries use `ai.configure` and `prompt.library.read` respectively. The manifest-only seed succeeded and increments the persisted revision. The local API and Dashboard processes were not running during final live verification, so no new authenticated bootstrap claim is made; the production build enumerates all FM-5/FM-6/FM-7 routes.

FM-7 is complete. Provider Management consumes safe configuration read/upsert and validation APIs; credential input is password-only local form state and is never cached or returned. Backend persistence reuses existing configuration, credential, health, encryption, audit, adapter, and workspace boundaries. The development Administrator received the three narrow provider permissions through the targeted permission seed.

## Dashboard Initialization Recovery - 2026-08-09

The live initialization failure is resolved. Do not restore `layout: "list"` in the development platform manifest: it is a widget kind, not a registered Dashboard Runtime page layout. Team and Agent pages use `grid`; the active manifest is revision 3 and authenticated bootstrap returns all five navigation entries. Targeted permission seeding increments `permissionRevision` so Team permissions are visible without restarting the API.

## FM-5/FM-6 Navigation Discoverability - 2026-08-09

The active development workspace manifest has been refreshed from stale revision 1 to revision 2. Its backend-authoritative sidebar now includes Dashboard (`/`), Company (`/company`), Platform Control (`/platform`), Team (`/company/members`), and Agents (`/ai/agents`). Create Agent remains naturally discoverable from the Agent list and routes to `/ai/agents/new`; Agent cards route to `/ai/agents/[agentId]`.

Do not merge plugin navigation into the sidebar client-side or enable fake feature flags. The sidebar and command palette correctly consume the filtered backend manifest. `Features: 0` means no optional license/override entitlements; FM-5/FM-6 modules use permission-only visibility. Development manifest refreshes now increment the persisted revision so runtime caches cannot retain old navigation.

## Authoritative Current Frontend State - Sprint FM-6 - 2026-08-09

FM-6 is complete in the working tree. Preserve the Agent Studio plugin and physical routes `/ai/agents`, `/ai/agents/new`, and `/ai/agents/[agentId]`. The UI lists and searches workspace agents, creates drafts, reloads persisted configuration, updates draft identity/model/instructions/capabilities, and publishes saved drafts through real APIs.

Provider/model options come exclusively from `GET /api/v1/ai/providers`. System instructions bind an existing Prompt Library item through `promptBindings`; there is no duplicate inline prompt architecture. Memory, retrieval, and tools are Agent-level capability flags only. Workflow and resource-ID assignments are unavailable because the current Agent Studio DTO does not expose those fields.

Validation passed: Dashboard typecheck, Dashboard lint, 20 Dashboard test files with 72/72 tests (including 13 focused FM-6 tests), Dashboard production build with all three Agent routes, and `git diff --check`. Vitest required the approved outside-sandbox runner because sandbox child-process creation returned `EPERM`.

The next exact frontend milestone is provider and Prompt Library resource configuration. Do not rebuild backend execution runtimes or revisit FM-1 through FM-6.

## Authoritative Current Frontend State - Sprint FM-5 - 2026-08-09

FM-5 is complete in the working tree. Preserve Dashboard Home, Workspace Management, Platform Control, and Team Management as the validated baseline. Routes are `/`, `/company`, `/platform`, and `/company/members`; all are registered built-in plugins and consume backend-authoritative platform/workspace state.

Team Management belongs to this slice and is no longer a scaffold. It uses the existing `workspaces/current/members` lifecycle endpoints and `platform/permissions/roles`, gates route visibility on `workspace.members.read`, gates mutations on `workspace.members.manage`, and requires `platform.configure` only for operations that need the role catalog.

Validation passed: Dashboard typecheck, Dashboard lint, 33/33 focused feature tests, 9/9 final Team tests, Dashboard production build, database typecheck, focused workspace DTO test, and `git diff --check`. The initial sandbox `EPERM` and one transient native-memory build failure were environmental; the unchanged source passed outside the sandbox.

The next frontend milestone is Agent creation/configuration. Do not start by rebuilding backend Agent Execution or revisiting FM-1 through FM-5.

## Authoritative Current Frontend State - Sprint FM-4 - 2026-08-02

FM-4 is complete. `@responix/state` owns `platform/current` and `dashboard-runtime/bootstrap` through one workspace-keyed service. The Dashboard composes Theme, Query, Auth, and Platform bootstrap providers. Protected content waits for authentication restoration and platform readiness. Permissions, features, workspace metadata, manifest data, and navigation publish as one snapshot, and production navigation consumes that snapshot. Logout, workspace switching, and authentication loss clear Query and bootstrap caches.

Affected package and full workspace typecheck, lint, tests, and builds pass. Dashboard production build and `git diff --check` pass. FM-5 is not started; do not revisit FM-1 through FM-4 without a demonstrated blocking defect.

## Authoritative Current Repository State — Sprint FM-2 — 2026-08-01

FM-2 is complete. `@responix/api-client` is the canonical frontend communication layer and returns raw NestJS DTOs. It owns query serialization, request metadata, timeout/abort behavior, 204 and empty-body handling, backend error normalization, and replay-capable interceptor context. OpenAPI generation uses the live backend `/docs-json` document and the generated contract is exported by the package. The duplicate `apps/dashboard/src/api` resources and unsupported shared API route catalog were removed.

FM-3 is not started. No authentication lifecycle, provider composition, bootstrap integration, navigation integration, realtime, notification, UI, or feature-module work was added during FM-2.

### FM-2 Validation Handoff

- API client: typecheck, lint, 10 focused tests, and package build pass.
- Dashboard: typecheck, lint, 22 tests, and production build pass.
- Workspace: typecheck, tests, and production build pass; `git diff --check` passes.
- Workspace lint passes all FM-2-owned packages, then reports one unrelated unused constant in `packages/auth/src/refresh/detector.ts`.
- Keep FM-2 closed. FM-3 requires separate approval and must consume the canonical API client.

## Current Repository State - Sprint F2.5 - 2026-08-01

Sprint F2.5 is complete. All Dashboard infrastructure foundations are in place before Sprint F3 begins. Hardcoded navigation has been fully replaced with a manifest-driven navigation engine. The notification system has a complete abstraction layer. Auth refresh infrastructure handles 401 retry with request replay. Frontend testing runs on Vitest with 22 passing tests. Developer experience includes global error/loading boundaries, query devtools, environment validation, logger, and runtime assertions. Typed API clients are prepared for all domains. The platform manifest mock matches backend contracts and is replaceable by the bootstrap endpoint.

## Completed Sprint F2.5 Scope

- **Navigation Engine:** Manifest-driven navigation with `NavigationRegistry`, `NavigationResolver`, `BreadcrumbGenerator`, `StaticManifestLoader`, `ApiManifestLoader`. React hooks: `useResolvedNavigation`, `useBreadcrumbs`, `useActiveRouteId`. Sidebar and Topbar consume the engine; no hardcoded items remain.
- **Notification Infrastructure:** `NotificationProvider`, `NotificationStore` with optimistic updates, `InMemoryNotificationRepository`, `SseNotificationTransport`, `WebSocketNotificationTransport`. Hooks: `useNotifications`, `useNotificationCount`.
- **Auth Refresh Infrastructure:** `SilentRefreshManager` (queue, lock, multiple-request protection), `TokenExpirationDetector`, `authRequestInterceptor`, `authResponseInterceptor` (401 retry + replay). Memory-only tokens, auto-logout on failure.
- **Testing Foundation:** Vitest, React Testing Library, jsdom, MSW. `vitest.config.ts` with React plugin. Mock providers using real `AuthContext`. 22 tests passing.
- **Developer Experience:** `GlobalErrorBoundary`, `GlobalLoadingBoundary`, `QueryDevtools`, `ErrorToastService`, `env` validation, `logger`, `debugLog`, `assert`, `assertDefined`, `assertNever`.
- **API Integration:** Typed clients for Auth, Workspace, Users, Roles, Permissions, Navigation, Notifications, Dashboard Bootstrap. All consume `@responix/types`.
- **Manifest Mock:** `mockManifest` (`PlatformManifestDto`) simulating navigation, widgets, permissions, feature flags, workspace, theme, and dashboard sections. Replaceable by `GET /dashboard-runtime/bootstrap`.

## Previous State - Sprint F2 - 2026-08-01

Sprint F2 is complete. The Dashboard has a fully functional authentication layer, workspace-aware navigation, responsive layout shell, command palette, and error pages. All frontend packages and the Dashboard app pass typecheck, lint, build, and tests. The auth provider stores access tokens in memory only; session metadata is persisted to `responix:session`. The sidebar, topbar, app-shell, and command palette are all integrated and responsive.

## Current Repository State - Sprint 6E.14 - 2026-07-31

Channel Runtime now provides the reusable multi-channel boundary for future Telegram, Slack, Discord, Teams, email, SMS, web chat, custom REST, and connector adapters. Providers implement generic normalization, webhook, signature, transport, media, capability, and health contracts and are discovered through the adapter registry. Runtime orchestration remains provider agnostic and continues delegating normalized messages to Conversation Runtime and configured Workflow or Agent execution.

Meta WhatsApp Cloud is the first adapter and retains backward-compatible routes. Generic encrypted credential references, immutable provider configuration, health history, capability persistence, connection lifecycle validation, rate/retry policy records, presence, and queue-ready message batches are added by migration `000037_multi_channel_foundation`.

The full validation matrix passes: Prisma validation/generation, workspace typecheck/lint, 141 passing API suites with 889 passing tests, production build, and `git diff --check`.

## Known External Blocker

Docker is unavailable locally (`docker` is not on `PATH`). Compose verification for PostgreSQL, Redis, API, Dashboard, and health endpoints remains pending on a Docker-capable host. This is not a repository defect.

## Recommended Next Action

Sprint F2.5 is complete. The frontend is fully prepared for Sprint F3 — Dashboard Feature Modules (AI Providers, Prompt Studio, Agent Studio, Workflow Studio, Tool Registry, Knowledge Base, Memory, Retrieval, Conversations, Channels, Runtime Monitoring, Analytics, Billing, Team Management, Roles & Permissions, Audit Logs, Settings). Preserve all completed backend boundaries; do not modify backend code.
