# Development Log

## WhatsApp Connection Management — Edit, Callback URL, Verify Token - 2026-08-09

- **Backend:** Added `GET /connections/:id`, `PATCH /connections/:id`, and `POST /connections/:id/verify-token/regenerate` endpoints to Channel Runtime with `whatsapp.connection.read`, `whatsapp.connection.write`, and `whatsapp.connection.admin` permissions.
- **Frontend API:** Added `getWhatsAppConnection`, `updateWhatsAppConnection`, and `regenerateVerifyToken` to `whatsapp-api.ts` with canonical `@responix/api-client` transport.
- **Frontend UI:** Rewrote `/channels/whatsapp` page with:
  - `WebhookCallback` component displaying the full Meta Webhook Callback URL constructed from `env.webhookBaseUrl` + `/api/v1/channel-runtime/webhooks/whatsapp/${webhookPathKey}`
  - Localhost warning when `NEXT_PUBLIC_WEBHOOK_BASE_URL` is not configured
  - Copy-to-clipboard for the Callback URL
  - `VerifyTokenDisplay` component showing newly regenerated verify tokens with one-time display and dismiss
  - `EditConnectionForm` for updating business account ID, phone number ID, display number, API version, and optionally rotating access token, verify token, or app secret
  - `ConnectionStatus` with Edit, Validate, Disconnect, and Regenerate Verify Token actions
- **Security:** Credentials remain write-only; no access token, app secret, or verify token is rendered from query data. The verify token is returned only once immediately after regeneration and is dismissed permanently. Blank secret fields in edits preserve existing encrypted credentials.
- **Tests:** 12 tests across 2 files — 3 API contract tests and 9 page behavior tests covering connection creation, credential submission, connected state, callback URL display, copy action, edit form, update submission, verify token regeneration, dismissal, disconnection, permission denial, and error recovery.
- **Validation:** Dashboard typecheck, lint, production build, focused tests, and `git diff --check` all pass.

## WhatsApp Onboarding and Real-Agent Gate - 2026-08-09

## WhatsApp Onboarding and Real-Agent Gate - 2026-08-09

- Added `/channels/whatsapp` as a real, permission-gated plugin and revision-5 development-manifest entry.
- Integrated existing Channel Runtime list/create channel, list/create connection, health validation, and state-transition contracts. Meta credentials remain write-only and never enter query cache or response UI.
- Added loading, disconnected, connected, validation, authorization, error, and success states. The current backend boundary is manual Meta Cloud configuration; OAuth/Embedded Signup is not implemented.
- Real DeepSeek validation and one full published-Agent execution succeeded. The exact model response was `DEEPSEEK_SMOKE_OK`; provider/model/usage and kernel success were persisted without secret exposure.
- Fixed the pinned-DNS Node 22 `all` lookup contract, PostgreSQL advisory-lock result deserialization, and Agent Studio propagation of `providerConfigurationId`.
- Validation: API typecheck/build and focused runtime tests PASS; Dashboard typecheck/lint, 16 focused/regression tests, production build, database typecheck, targeted seeds, authenticated bootstrap/API/route smoke, and diff check PASS.

## FM-7 Live Smoke Attempt - 2026-08-09

- Runtime recovered: API health `ok`, PostgreSQL `up`, Redis `up`, Dashboard HTTP 200.
- Authenticated development workspace bootstrap passed at manifest revision 4 with Providers and Agents visible; 149 permissions resolved, including provider read/write/validate.
- `GET /api/v1/ai/providers` returned six providers/models; all six safe configuration reads succeeded and returned no credential/encrypted-secret fields.
- Workspace state has zero configured providers and zero provider credentials. No supported external provider credential is available in environment configuration.
- Unconfigured validation correctly returned HTTP 409; Agent Studio listing returned 200 with zero Agents.
- Real provider validation and Agent execution were not attempted because fabricating or exposing a credential is prohibited. No next milestone was started.

## FM-7 Provider & Prompt Library Resource Configuration - 2026-08-09

- Added permission-gated Provider discovery at `/ai/providers`, showing only backend-returned status, configured/enabled state, models, limits, and capabilities. No secret is returned or rendered.
- Added Prompt Library list/create/detail routes with real workspace API integration for search, pagination, draft JSON, variables, metadata, categories/tags, publishing, favorite, archive, and restore.
- Added Providers and Prompt Library to built-in plugins and the backend-authoritative development manifest using registered `grid` layouts; the manifest-only seed completed successfully.
- Agent provider selection now reuses the canonical Provider API implementation; prompt mutations invalidate the workspace prompt query root used by Agent options.
- Validation: Dashboard typecheck and lint PASS; 12 focused/regression files, 30 tests PASS; Dashboard production build PASS; database typecheck and manifest-only seed PASS.
- **Provider blocker closed:** added safe configuration read/upsert and validation endpoints, transactional encrypted credential rotation, omitted-credential preservation, optimistic `updatedAt` checks, safe health history, and secret-free audits. Provider discovery now includes disabled workspace configurations and credential readiness while execution still rejects disabled providers.
- **Status: COMPLETE.** Focused backend tests pass 25/25 and focused Provider/Agent frontend tests pass 14/14; API/Dashboard typecheck, targeted lint, API/Dashboard builds, Prisma validation, database typecheck, targeted permission seed, and diff check pass.

## Dashboard Initialization Recovery - 2026-08-09

- **Root cause:** the revision-2 development manifest used `layout: "list"` for Team and Agents, but Dashboard Runtime accepts only registered renderer layouts. Auth and `platform/current` succeeded; `dashboard-runtime/bootstrap` returned 404 `Unknown dashboard layout 'list'`, causing `PlatformBootstrapProvider` to enter `ERROR`.
- Replaced only those two manifest page layouts with registered `grid` layouts and applied the manifest-only seed. The active manifest is revision 3.
- The targeted development permission seed now increments `workspace.permissionRevision`, preventing cached permission snapshots after role-permission upserts. The development Administrator resolves 146 permissions, including Team read/manage permissions.
- **Live verification:** API health is `ok`; authenticated `platform/current` and `dashboard-runtime/bootstrap` return 200; resolved navigation is Dashboard, Company, Platform, Team, and Agents; all six requested Dashboard URLs return 200.

## FM-5/FM-6 Discoverability Closeout - 2026-08-09

- **Root cause:** the active development workspace still stored revision 1 of the platform manifest, containing only Dashboard, Company, and Platform Control. Team and Agents existed in source, plugin registration, App Router, tests, and builds, but the production sidebar is intentionally sourced only from the backend-resolved persisted manifest.
- Added manifest revision increments to both development manifest upsert paths so updates invalidate Dashboard Runtime cache keys.
- Applied the existing manifest-only seed path to the development workspace. The persisted manifest is now revision 2 and contains Dashboard, Company, Platform Control, Team, and Agents with their existing permission visibility rules.
- Replaced the command palette's obsolete hardcoded links to unfinished screens with the same backend-resolved, permission/feature-filtered manifest navigation used by the sidebar.
- Confirmed `Features: 0` is expected: these core modules are permission-gated and have no optional feature-entitlement requirement. Platform Control now labels feature entitlements and the authorization snapshot more explicitly.
- **Validation:** Dashboard and database typecheck pass; Dashboard lint passes; 9 focused navigation/platform/plugin files pass 19/19 tests; Dashboard production build passes with all FM-5/FM-6 routes; `git diff --check` passes.

## Sprint FM-6 - Agent Creation & Configuration Foundation - 2026-08-09

- **Status:** Complete in the working tree; runtime monitoring, Inbox, WhatsApp UI, Workflow Builder, Prompt Studio, and resource-management screens were not started.
- Added the Agent Studio plugin, manifest navigation, and physical list/create/edit routes.
- Integrated real Agent Studio list, detail, create, update, and publish endpoints through the canonical API client.
- Added workspace-scoped TanStack Query keys, mutation invalidation, persisted-value reopening, draft-only editing, unsaved-change warning, validation, feedback, and permission-aware actions.
- Provider/model selection consumes the authoritative AI provider catalog and capability metadata. Instructions use existing Prompt Library bindings. Memory, Retrieval, Tools, and model capabilities use only supported boolean DTO fields.
- **Validation:** Dashboard typecheck and lint pass; 20 Dashboard test files pass 72/72 tests, including 13 focused FM-6 tests; Dashboard production build and `git diff --check` pass.
- **Environment note:** the first focused Vitest attempt was blocked by sandbox child-process `EPERM`; the approved outside-sandbox runner passed.

## Sprint FM-5 - Core Dashboard Feature Modules - 2026-08-09

- **Status:** Complete in the working tree; Agent UI not started.
- Replaced the Dashboard Home placeholder with real workspace, permission, navigation, feature, and runtime-bootstrap state.
- Added Workspace Management at `/company` with permission-aware real current-workspace GET/PATCH integration, changed-field validation, cache synchronization, and bootstrap refresh.
- Added read-only Platform Control at `/platform` for resolved license, features, permissions, manifest, and branding state.
- Completed Team Management at `/company/members` using existing workspace-member and platform-role APIs: listing, pagination, invitations for existing users, role changes, suspend/restore, invitation cancellation, removal, and read/manage permission boundaries.
- Registered all four built-in plugins and synchronized the development manifest and required workspace-member permissions.
- Corrected workspace storage BigInt response serialization and added focused coverage.
- **Validation:** Dashboard typecheck and lint pass; 10 focused feature files pass 33/33 tests; the final Team subset passes 9/9 tests; Dashboard production build passes. Database typecheck, the focused workspace DTO test, and `git diff --check` pass.
- **Environment note:** Initial test/build attempts hit Windows sandbox child-process `EPERM`, and one build retry hit transient native Node memory exhaustion. The unchanged source passed when the focused runners and final Dashboard build were rerun outside the sandbox with the repository's Windows-stable heap setting.

## Sprint FM-4 - Platform Bootstrap and Application Composition - 2026-08-02

- Established the canonical workspace-keyed platform bootstrap service in `@responix/state`.
- Composed Theme, Query, Auth, and Platform providers with deterministic readiness and retry states.
- Replaced production mock-manifest navigation ownership with backend bootstrap navigation.
- Centralized permissions, features, workspace metadata, manifest, and navigation exposure.
- Added bootstrap invalidation for logout, workspace switch, and authentication loss.
- Added focused bootstrap service/provider tests.
- Package and workspace typecheck, lint, tests, builds, Dashboard production build, and `git diff --check` pass.
- FM-4 is complete. FM-5 is not started.

## Sprint FM-2 — API Foundation — 2026-08-01

- **Status:** Complete; FM-3 not started.
- Established `@responix/api-client` as the canonical frontend HTTP transport.
- Adopted raw NestJS DTO responses and removed the unsupported frontend response-envelope assumption.
- Added query serialization, request metadata, timeout/abort handling, 204/205 and empty-body handling, backend-compatible error normalization, and replay-capable interceptor context.
- Corrected the local backend default to port `4000`.
- Integrated OpenAPI generation from `/docs-json`, refreshed the checked-in generated contract, and exported generated `paths`, `components`, and `operations` types.
- Removed the unused Dashboard-local API resource layer and unsupported shared API route catalog, consolidating API ownership.
- Added 10 focused API transport tests.
- Scope audit confirmed no authentication lifecycle, providers, bootstrap, navigation, realtime, notifications, UI, or feature modules were implemented.
- Validation: API client and Dashboard pass typecheck, lint, tests, and build; workspace typecheck, tests, build, and diff check pass. Workspace lint has one unrelated auth-package unused-constant finding.

## Sprint F2.5 - Dashboard Infrastructure Completion - 2026-08-01

- **Status:** Complete; the full repository validation matrix passes.
- **Navigation Engine:** Replaced all hardcoded navigation with a manifest-driven system.
  - `NavigationRegistry` — immutable storage for navigation items with lookup, traversal, and ancestor resolution.
  - `NavigationResolver` — filters items by permission, feature flag, workspace, role, and plan with active route detection.
  - `BreadcrumbGenerator` — generates breadcrumb trails from registry or falls back to path segments.
  - `StaticManifestLoader` / `ApiManifestLoader` — loads navigation from local mock or backend endpoint.
  - React hooks: `useResolvedNavigation`, `useBreadcrumbs`, `useActiveRouteId`, `useNavigationFilterContext`.
  - Sidebar and Topbar updated to consume the navigation engine; no hardcoded menu items remain.
- **Notification Infrastructure:** Built complete abstraction layer.
  - `NotificationProvider` with React context, `useNotifications`, `useNotificationCount` hooks.
  - `NotificationStore` with optimistic updates, unread count, mark-as-read, mark-all, dismiss.
  - `InMemoryNotificationRepository` with filtering by category, severity, read state.
  - `NotificationTransport` interface with `SseNotificationTransport` and `WebSocketNotificationTransport` implementations.
- **Auth Refresh Infrastructure:**
  - `SilentRefreshManager` with refresh queue, refresh lock, and multiple-request protection.
  - `TokenExpirationDetector` with proactive expiry checking.
  - `authRequestInterceptor` and `authResponseInterceptor` for 401 retry pipeline with request replay.
  - Memory-only token updates, automatic logout on refresh failure.
- **Frontend Testing Foundation:**
  - Installed Vitest, React Testing Library, jsdom, MSW.
  - `vitest.config.ts` with React plugin, jsdom environment, path aliases.
  - Testing utilities: render helpers, `MockAuthProvider` (uses real AuthContext), `MockWorkspaceProvider`, `createMockQueryClient`, `mockRouter`.
  - Example tests: `PermissionGuard`, `AnyPermissionGuard`, `AllPermissionsGuard`, `NavigationResolver`, `NavigationRegistry`, `NotificationRepository` — 22 tests, all passing.
- **Developer Experience:**
  - `GlobalErrorBoundary` with dev stack traces and reload button.
  - `GlobalLoadingBoundary` with Suspense fallback.
  - `QueryDevtools` (development only).
  - `ErrorToastService` for error logging.
  - `env` validation, `logger` with history, `debugLog`, `assert`, `assertDefined`, `assertNever`.
- **API Integration Preparation:**
  - Typed API clients for Auth, Workspace, Users, Roles, Permissions, Navigation, Notifications, Dashboard Bootstrap.
  - All clients use `@responix/api-client` and `@responix/types` — no duplicated DTOs.
- **Manifest Mock:**
  - `mockManifest` (PlatformManifestDto) with navigation, dashboard pages, themes, features, and plugins.
  - Replaceable later by `GET /dashboard-runtime/bootstrap` without UI changes.
- **Validation:** TypeScript typecheck, ESLint, build, tests pass. No backend code modified.

## Sprint F2 - Dashboard Core Shell & Auth System - 2026-08-01

- **Status:** Complete; the full repository validation matrix passes.
- **Auth System:** Built complete authentication layer with memory-only access tokens, workspace-scoped sessions, and refresh-token-ready architecture.
  - `AuthProvider` enhanced with workspace list fetching, active workspace switching, and session persistence to `responix:session` (never access tokens).
  - New auth hooks: `usePermissions`, `useWorkspace`, `useTenant`, `useFeatures`.
  - New auth guards: `PermissionGuard`, `AnyPermissionGuard`, `AllPermissionsGuard`, `FeatureFlagGuard`, `AuthenticatedGuard`.
  - Auth pages: login (with email/password, remember me, validation), forgot-password (email reset flow), reset-password (token + new password).
- **Navigation & Layout:**
  - `WorkspaceSwitcher` — dropdown with workspace list, active state, and switch handler.
  - `Sidebar` enhanced with mobile drawer (Sheet), workspace switcher integration, permission-gated navigation items, collapse toggle, and responsive breakpoints.
  - `Topbar` enhanced with breadcrumb navigation, global search input, language switcher (EN/AR), theme toggle (light/dark/system), notification bell with dropdown, and profile menu with settings link and logout.
  - `AppShell` integrates command palette, sidebar, topbar, and main content area with proper z-index and backdrop blur.
  - `PageContainer` and `Footer` components for consistent page scaffolding.
  - `CommandPalette` — Cmd+K global search with navigation shortcuts, theme toggle, and language switcher commands.
- **Error Pages:** `Unauthorized` (401) and `Forbidden` (403) pages with appropriate messaging and return links.
- **i18n:** Expanded `en.json` and `ar.json` with auth, navigation, common, notifications, command palette, error page, and form validation strings.
- **Validation:** TypeScript typecheck, ESLint, build, and tests pass across all frontend packages and the Dashboard app. No backend code modified.

## Sprint F1 - Frontend Foundation & Design System - 2026-08-01

- **Status:** Complete; the full repository validation matrix passes.
- **Monorepo:** Established Turborepo frontend workspace with 7 shared packages under `packages/`: `@responix/types`, `@responix/design-system`, `@responix/ui`, `@responix/shared`, `@responix/api-client`, `@responix/auth`, `@responix/state`.
- **Two-TSConfig Pattern:** Each package uses `tsconfig.json` (noEmit, no rootDir) for typecheck and `tsconfig.build.json` (rootDir: "src", outDir: "dist") for build. Workspace packages with cross-dependencies use `paths` overrides in `tsconfig.build.json` pointing to `packages/*/dist/index.d.ts`.
- **Types Package:** Added platform contract DTOs for dashboards, widgets, forms, navigation, themes, white-labeling, permissions, visibility, features, plugins, and OpenAPI metadata. Source files use `.js` extensions on relative imports for Node ESM runtime compatibility.
- **Design System:** Implemented token-driven design system with colors (light/dark), typography, spacing, borders, shadows, radii, motion, z-index, breakpoints, and RTL/LTR direction tokens.
- **UI Primitives:** Built reusable primitives: Button, Input, Select, Card, Dialog/Modal, Toast, Avatar, Badge, and utility `cn()` helper. Empty interface patterns converted to `type` aliases to satisfy `@typescript-eslint/no-empty-object-type`.
- **Dashboard App:** Bootstrapped Next.js 15 app at `apps/dashboard/` with `next-intl` v3.26 for i18n, theme provider, auth foundation, plugin infrastructure, widget SDK foundation, manifest loader, route guards, error boundaries, Suspense, loading states, command palette infrastructure, notification infrastructure, and layout persistence.
- **Dashboard Configuration:** Uses `createNextIntlPlugin("./i18n.ts")` wrapper in `next.config.ts`. Root layout exports `dynamic = "force-dynamic"` for server-rendered i18n without static generation conflicts.
- **Validation:** `pnpm install`, `pnpm -r run typecheck`, `pnpm -r run lint`, `pnpm -r run test`, and `pnpm -r run build` all pass across the entire workspace. Dashboard app builds and boots successfully.

## Foundation Verification - 2026-08-01

- **Status:** PASSED — Foundation is production-ready for Sprint F2.
- **MVP HTML Comparison:** Dashboard shell (sidebar, topbar, app-shell layout) matches the MVP HTML visual language — brand icon, navigation sections, collapse toggle, user card, workspace badge, search, theme toggle, language switcher, breadcrumbs, and notification bell are all present.
- **Blueprint Compliance:** Next.js 15.5.21, React 19, TypeScript 5.7.3, next-intl 3.26, next-themes, Tailwind CSS 3.4.17, TanStack Query 5.64.2 are in place. Two-TSConfig pattern, workspace packages, plugin infrastructure, widget SDK, route guards, error boundaries, Suspense, and layout persistence all match the architecture blueprint.
- **Public API Verification:** All 7 shared packages export clean public APIs with no leaked internals. `@responix/auth` exports `AuthProvider`, `useAuth`, `usePermissions`, `useWorkspace`, `useTenant`, `PermissionGuard`, `WorkspaceGuard`, `getAccessToken`, `setAccessToken`. `@responix/ui` exports all primitives, composites, and `cn()`. `@responix/state` exports `queryClient` and websocket transport. `@responix/api-client` exports `client`, `errors`, and `resources`. `@responix/design-system` exports all tokens and themes. `@responix/shared` exports constants and helpers. `@responix/types` exports platform and API types.
- **Security Fix:** Auth provider no longer stores access tokens in localStorage. Tokens are held in module-level memory only. Session metadata (user, workspace, permissions, features) is persisted to `responix:session` storage key. Refresh token will be managed by backend via httpOnly cookie.
- **Cleanup:** Removed 5 temporary Python scripts (`fix_imports.py`, `fix_js_extensions.py`, `fix_nodenext.py`, `fix_types_extensions.py`, `update_tsconfigs.py`). Removed 4 unnecessary dashboard dependencies (`class-variance-authority`, `clsx`, `tailwind-merge`, `zustand`) that were transitively provided by workspace packages. Fixed placeholder text in login page and company page.
- **No Refactoring Risk:** The foundation architecture will not force refactoring during later sprints. Plugin-based module system, two-TSConfig pattern, workspace dependency graph, and design token architecture are stable.

## Sprint 6E.14 - Multi-Channel Foundation Runtime - 2026-07-31

- **Foundation:** Generalized Channel Runtime contracts for providers, credentials, transport, webhooks, media, identities, presence, capabilities, health, retry/rate-limit policies, and batching.
- **Registry:** Added normalized installed-adapter resolution, duplicate rejection, capability lookup/refresh, and workspace-scoped connection resolution.
- **Compatibility:** Refactored Meta WhatsApp Cloud into the generic contracts while retaining the Sprint 6E.13 public routes and persistence compatibility.
- **Security:** Credential references remain encrypted and excluded from snapshots; webhook verification, replay/idempotency protection, checksums, optimistic locking, permissions, and transactional audits remain enforced.
- **Persistence:** Added migration `000037_multi_channel_foundation` without modifying historical migrations.

## Sprint 6E.13 - WhatsApp Business Channel Runtime - 2026-07-31

- **Status:** Complete; the full repository validation matrix passes and is recorded in Validation History.
- **Foundation:** Added generic workspace-isolated Channel Runtime entities, immutable snapshots/configuration revisions, optimistic state transitions, delivery history, diagnostics, metrics, and append-only transactional audits.
- **WhatsApp:** Added a native Meta WhatsApp Cloud adapter for configuration/capabilities, secure health and send operations, inbound/outbound normalization, media upload/download, and provider delivery/account callbacks.
- **Security:** Added encrypted access/verification/app secrets, raw-body HMAC verification, constant-time token verification, timestamp windows, replay receipts, idempotency, checksums, MIME/size/integrity enforcement, workspace boundaries, and persisted rate limits.
- **Integration:** Incoming messages create Conversation Runtime packages and delegate configured work to existing Workflow Runtime or Agent Execution, inheriting Execution Kernel, Prompt, Memory, Retrieval, Tool, Optimization, Provider, and Streaming behavior without duplication.
- **Persistence:** Added migration `000036_whatsapp_business_channel_runtime` and six channel/WhatsApp permissions without modifying historical migrations.

## Sprint 6E.12 - Advanced Prompt Cache & Runtime Optimization - 2026-07-31

- **Status:** Implementation complete; final validation evidence is recorded in Validation History.
- **Layers:** Extended the existing Runtime Optimization authority for compiled prompts, rendered static prompts, provider prompts, conversation prefixes, studio configurations, retrieval preparation, memory packages, tool definitions, workflow packages, runtime contexts, and execution plans.
- **Integrity:** Added immutable scope/revision/publisher metadata, SHA-256 validation, checksum verification, reference validation, automatic hash invalidation, retained rollback history, partial active-key uniqueness, transactional advisory locking, and optimistic invalidation.
- **Providers:** Added truthful native-cache negotiation for OpenAI/Azure OpenAI, DeepSeek, Claude, OpenRouter, and Gemini. Claude marks only the stable system prefix using explicit `cache_control`; automatic providers rely on native usage reporting. Unsupported adapters retain internal-cache fallback.
- **Integration:** Agent synchronous and streaming paths reuse one provider-prompt package; dynamic tool outputs are excluded from static rendering. Tool Runtime caches verified definitions, Workflow Runtime reuses compiled graphs/plans, and existing Retrieval/Memory preparation caches remain authoritative.
- **Observability:** Added provider hit/miss outcomes, TTL/provider-cache identifiers, cached tokens, compile time, saved-cost/latency fields, reuse metrics, pagination/filtering, permissions, immutable audits, and explicit invalidation reasons.
- **Persistence:** Migration `000035_advanced_prompt_cache` extends Runtime Optimization without changing historical migrations.

## Sprint 6E.11 - Tool Calling Engine - 2026-07-31

- **Status:** Implementation complete; final validation is recorded in Validation History.
- **Registry:** Published Tool Registry versions now persist deterministic snapshot hashes, checksums, and runtime compatibility versions while retaining draft/publish/rollback semantics and strict workspace ownership.
- **Runtime:** Added immutable Tool Runtime execution, attempt, state, event, diagnostic, metric, history, cancellation, timeout, retry, rate-policy, and transactional audit persistence for internal, HTTP/REST/webhook, database, file, storage, workflow, agent, and composite tools.
- **Security:** HTTP tools reuse the hardened destination-policy transport with method, destination, header, MIME, response-size, execution-time, and cancellation enforcement. Internal behavior requires an explicitly registered production executor.
- **Integration:** Agents support chained explicit tool calls and provider-neutral definitions; Workflow TOOL nodes delegate to Tool Runtime; parent-child Execution Kernel tracing, Retrieval packages, Optimization metadata, deferred Memory writes, prompt variables, and Streaming Runtime-compatible events are reused.
- **Providers:** OpenAI, Azure OpenAI, OpenRouter, DeepSeek, Claude, and Gemini adapters translate neutral definitions and normalize tool calls without placing vendor logic in Tool Runtime.
- **Persistence:** Migration `000034_tool_calling_engine` adds immutable Tool Runtime models and hash metadata without modifying historical migrations.

## Sprint 6E.10 - Workflow Execution Engine - 2026-07-31

- **Status:** Completed in the working tree; the full validation matrix passes.
- **Runtime:** Added a workspace-isolated orchestration layer for hash-verified immutable
  workflow versions with sequential, parallel, conditional, merge, delay, approval,
  variable, Agent, and subworkflow nodes.
- **Lifecycle:** Added optimistic execution states, immutable node/state history, durable
  timeout recovery, cancellation, bounded retries/depth/node counts, compensation, and
  deferred Memory Runtime writes committed only after successful graph completion.
- **Integration:** Workflow Agent nodes delegate to existing Agent Execution, preserving
  Prompt, Memory, Retrieval, Runtime Optimization, Provider, Streaming, and Execution
  Kernel boundaries; parent/child kernel runs preserve trace hierarchy.
- **Persistence:** Migration `000033_workflow_execution_engine` adds immutable execution,
  node, state, diagnostic, metric, hash/checksum, and audit-backed runtime persistence.
- **Validation:** Prisma validate/generate, typecheck, lint, API 126 suites and 820 tests,
  build, and `git diff --check` passed.

## Sprint 6E.9 - Retrieval Execution Engine - 2026-07-31

- **Status:** Completed in the working tree; the full validation matrix passes.
- **Execution:** Converts published Retrieval Runtime snapshots into immutable,
  provider-neutral knowledge packages using normalized queries, workspace-scoped
  dependencies, deterministic filtering and keyword ranking, token budgets, and citations.
- **Integration:** Executes after Runtime Optimization and Memory Runtime and before prompt
  loading/invocation in synchronous and streaming Agent Execution paths, with Execution
  Kernel request/run validation and Provider Runtime compatibility hooks.
- **Persistence:** Added execution snapshots, SHA-256 integrity metadata, cache/hash reuse,
  diagnostics, phase timings, metrics, terminal failures/cancellations, and transactional audits.
- **Scope:** Semantic, hybrid, and connector contracts are preparation boundaries only;
  vector databases and embedding providers remain outside this execution coordinator.
- **Validation:** Prisma validate/generate, typecheck, lint, API 121 suites and 803 tests,
  build, and `git diff --check` passed.

## Sprint 6E.7 - Unified Streaming Execution Engine - 2026-07-30

- **Status:** Completed; the full validation matrix passes.
- **Lifecycle:** Connected provider streaming, invocation accounting, Streaming Runtime,
  Agent Execution, Execution Kernel, cancellation, timeout, disconnect, and SSE lifecycles.
- **Persistence:** Added ordered immutable chunks, final response content, exact-or-UNKNOWN
  usage, cost and pricing metadata, diagnostics, metrics, timestamps, and completion audits.
- **Safety:** Added optimistic terminal transitions, duplicate-completion protection,
  workspace-scoped reads/writes, transactional audits, and immutable request snapshots.
- **Validation:** Prisma validate/generate, typecheck, lint, API 784 tests, build, and
  `git diff --check` passed.

## Sprint 06 Phase 1 - Platform Contracts Foundation - 2026-07-27

- **Status:** Implemented; Prisma validation/generation, typecheck, tests, and build passed. Full lint stalled locally without diagnostics and remains unverified.
- **Contracts:** Added versioned renderer-neutral dashboard, widget, form, navigation, theme, white-label, visibility, feature, plugin, and future OpenAPI DTO contracts to `@responix/types`.
- **Extensibility:** Added duplicate-safe, schema-version-compatible widget and field extension registration with manifest validation and detached JSON serialization.
- **Scope control:** No React, HTML, CSS, dashboard engine, public endpoint, Prisma schema, business logic, or authorization behavior was added.

## Sprint 5B Package 5 - Final Validation and Production Hardening - 2026-07-26

- **Status:** Completed; Sprint 5B implementation is finalized.
- **Integration:** Added a Nest HTTP integration suite across provider discovery/registry/factory, routing, credential callback execution, invocation lifecycle, normalization, persistence, DTO serialization, and HTTP error handling.
- **Security:** Verified forged tenant identifiers cannot execute, authenticated workspace context remains authoritative, and encrypted/plaintext credentials and provider payloads do not enter responses, persistence calls, or structured error logs.
- **Failure handling:** Verified normalized provider failures, timeout responses, pending lifecycle failure closure, and existing transaction rollback behavior.
- **HTTP hardening:** Verified authentication, request-ID propagation, Swagger paths/security, and corrected POST routing/invocation responses to the documented HTTP 200 status.
- **Runtime:** Added the Docker-capable production verification checklist without adding runtime dependencies or real provider credentials.
- **Scope control:** No feature, API, routing, provider, schema, migration, dashboard, streaming, memory, RAG, tool, cache, job, or scheduler behavior was added.

## Sprint 5B Package 4 - HTTP/API Boundary - 2026-07-26

- **Status:** Completed; Sprint 5 remains current.
- **HTTP surface:** Added guarded API v1 endpoints for provider discovery, routing resolution, and synchronous invocation only.
- **Runtime contracts:** Added class-validator request DTOs and explicit response DTO mappings for provider, routing, usage, cost, and invocation output.
- **Authorization:** Reused the global JWT, tenant, membership, and permission guards with existing `ai.configure` and `ai.invoke` permissions.
- **Security:** Request workspace and membership identifiers are not accepted; request IDs come from the existing Pino flow; provider configuration, payloads, credentials, secrets, Prisma entities, and internal exception metadata are not serialized.
- **Documentation:** Added Swagger summaries, descriptions, request and response schemas, authorization, request-ID headers, and stable error responses.
- **Testing:** Added four API-boundary suites covering thin delegation, request-ID propagation, runtime validation, serialization allowlists, and safe error mapping. The API suite passes 30 suites and 69 tests.
- **Validation:** Prisma validate/generate, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` passed.
- **Scope control:** No dashboard, prompt, memory, RAG, streaming, caching, tools, jobs, schedulers, schema, migration, provider logic, routing behavior, or repository behavior was added.

## Sprint 5B Package 2 - Routing Foundation - 2026-07-25

- **Status:** Completed; Sprint 5 remains current.
- **Persistence boundary:** Added workspace-scoped candidate and routing-metadata reads covering provider configuration, models, active credential presence, and latest provider health.
- **Decision pipeline:** Added capability, health, eligibility, priority, and fallback components with stable identifier tie-breaking.
- **Routing:** Added a provider-neutral routing service that returns the selected provider/model, decision factors, candidate ranks, and ordered fallbacks.
- **Isolation:** Configuration, credentials, health, and routing metadata are filtered by workspace; eligibility rejects candidates outside the requested workspace.
- **Scope control:** No provider invocation, prompt construction, memory, RAG, tools, streaming, controller, DTO, Swagger, dashboard, or HTTP behavior was added.
- **Testing:** Added six routing suites covering capabilities, health, eligibility, priority, fallbacks, workspace isolation, and deterministic decisions. The API suite passes 18 suites and 44 tests.
- **Validation:** Prisma validate/generate, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` passed.
- **Runtime limitation:** Docker remains unavailable locally; Package 2 introduced no endpoint or database migration.

## Sprint 5B Package 1 - Provider Foundation - 2026-07-25

- **Status:** Completed; Sprint 5 remains current.
- **Provider boundary:** Added typed Nest injection tokens, provider adapter contract, OpenAI adapter skeleton, registry, and workspace-aware factory.
- **Persistence boundary:** Added workspace-scoped provider, credential, and provider-configuration repositories that map Prisma results to internal domain types.
- **Credential security:** Added metadata-only credential retrieval and callback-scoped decryption immediately before provider use; encrypted and plaintext secrets are not returned by discovery APIs.
- **Discovery:** Added workspace-aware provider/model discovery with tenant configuration filtering.
- **Scope control:** No routing, prompts, memory, knowledge injection, invocation, streaming, tools, usage, cost, health evaluation, controller, DTO, Swagger, dashboard, or HTTP behavior was added.
- **Testing:** Added six AI suites covering repositories, registry, factory, and the credential decryption boundary. The API suite now passes 12 suites and 31 tests.
- **Validation:** `pnpm install --no-offline`, Prisma validate/generate, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` passed.
- **Runtime limitation:** Docker remains unavailable locally; no new runtime endpoint or database migration was introduced by Package 1.

## Sprint 4 — Workspace & Multi-Tenant Core — 2026-07-25

- **Status:** Completed; Sprint 5 — AI Engine is current.
- **Tenant context:** Added authoritative `WorkspaceMembership` resolution, current workspace/membership request context, tenant and membership guards, and JWT/RBAC membership integration.
- **Workspace architecture:** Completed workspace creation, default provisioning, settings, lifecycle controls, soft-delete handling, and workspace-scoped repositories.
- **Membership lifecycle:** Completed explicit invite, accept, reject, remove, suspend, restore, and role-update operations with validated state transitions and last-active-owner protection.
- **Invitation system:** Added secure persisted invitation tokens, expiry, revocation, duplicate/target/role/quota validation, and atomic acceptance handling.
- **Authorization and hardening:** Added membership-derived permissions, domain errors, DTO validation, transaction boundaries, audit records, session revocation for removed or suspended members, and tenant-isolation safeguards.
- **Testing:** Added tenant-context, guard, workspace, membership/invitation, owner-invariant, session-revocation, and authentication-membership validation coverage. The API Jest suite passed with five suites and sixteen tests.
- **Validation:** `pnpm install`, `pnpm prisma validate`, `pnpm prisma generate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` passed.
- **Runtime limitation:** `docker compose up --build` could not run because Docker is unavailable locally. Compose, PostgreSQL, Redis, API, Dashboard, and health verification remain external-environment work only.

## Historical Sprint Summary

| Sprint   | Status    | Outcome                                                                                                                               |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 0 | Completed | Monorepo, API, Dashboard, shared packages, baseline validation, and local development foundation established.                         |
| Sprint 1 | Completed | Docker/Compose, configuration, operational tooling, security, logging, CI, and production-readiness foundation finalized.             |
| Sprint 2 | Completed | Documented Prisma schema, migrations, pgvector, indexes, constraints, and mandatory bootstrap data implemented.                       |
| Sprint 3 | Completed | JWT authentication, Argon2id, refresh sessions, RBAC, permissions, and authentication tests implemented.                              |
| Sprint 4 | Completed | Workspace/membership domain, tenant isolation, invitation lifecycle, lifecycle controls, auditability, and API hardening implemented. |
