# Session Handoff

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
