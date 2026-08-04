# Responix Frontend Architecture Proposal

> **Status:** Architecture Review Complete — Proposal Pending Approval  
> **Version:** 1.0  
> **Date:** 2026-07-31  
> **Scope:** Two independent frontend applications (Dashboard + Client) consuming the complete NestJS backend

---

## Table of Contents

1. [Backend Architecture Understanding](#1-backend-architecture-understanding)
2. [Monorepo Frontend Layout](#2-monorepo-frontend-layout)
3. [Shared Packages Architecture](#3-shared-packages-architecture)
4. [Application 1: Responix Dashboard](#4-application-1-responix-dashboard)
5. [Application 2: Responix Client](#5-application-2-responix-client)
6. [Cross-Cutting Concerns](#6-cross-cutting-concerns)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. Backend Architecture Understanding

### 1.1 API Contract

| Aspect | Detail |
|--------|--------|
| Base URL | `http://localhost:3001/api/v1` (configurable) |
| Versioning | URI-based (`/api/v1/...`) |
| Auth | Bearer JWT (access token 15min, refresh token 30d) |
| Content | JSON request/response, whitelist validation |
| Headers | `x-request-id` propagated for tracing |
| Docs | Swagger at `/docs` |

### 1.2 Module Boundaries (Relevant to Frontend)

```
Auth              → POST /auth/login, /auth/refresh, /auth/logout
Workspace         → CRUD workspaces, members, invitations, lifecycle
Platform Control  → permissions, roles, features, branding, manifest
Dashboard Runtime → bootstrap manifest (renderer-neutral)
AI                → providers, routing, invocations, usage
Agent Studio      → agent CRUD, versions, prompt bindings
Agent Runtime     → runtime preparation, snapshots, conversations
Prompt Library    → prompt items, categories, tags, versions
Prompt Compiler   → compiled prompts, rendering
Prompt Execution  → execution payloads, diagnostics
Workflow Engine   → workflow CRUD, nodes, edges, conditions
Workflow Runtime  → execution, state machines, metrics
Execution Kernel  → execution runs, steps, events, logs
Execution Pipeline→ pipeline definitions, nodes, validations
Knowledge Base    → bases, documents, collections, folders, chunks
Memory Runtime    → memory records, snapshots, references
Retrieval Runtime → retrieval definitions, snapshots
Retrieval Execution→ execution, diagnostics, metrics
Runtime Optimization→ cache packages, metrics, provider outcomes
Streaming Runtime → stream sessions, chunks, diagnostics
Tool Registry     → tool definitions, parameters, schemas
Tool Runtime      → executions, attempts, state history
Provider Runtime  → runtime requests, snapshots
Conversation Runtime→ runtime definitions, messages, participants
Channel Runtime   → channels, connections, messages, webhooks (WhatsApp first)
Studio Project    → projects, revisions
```

### 1.3 Authentication & Authorization Model

- **JWT Access Token**: 15-minute expiry, signed, contains `sub`, `workspaceId`, `membershipId`, `sessionId`
- **JWT Refresh Token**: 30-day expiry, rotated on use, session-scoped, Argon2-hashed in DB
- **RBAC**: Permissions → RolePermission → Role → WorkspaceMembership → User
- **Permission Resolution**: Role permissions + workspace overrides + user overrides + temporary assignments
- **Tenant Context**: Every authenticated request carries `ResolvedTenantContext` with workspace, user, role
- **Guard Chain**: Throttler → JwtAuthGuard → TenantGuard → MembershipGuard → PermissionsGuard

### 1.4 Key Backend Patterns for Frontend

- **Workspace-scoped everything**: All data is tenant-isolated; the frontend must always send workspace context implicitly via JWT
- **Immutable snapshots with hashing**: Published versions carry `snapshotHash`, `checksum`, `revision` — frontend should respect optimistic locking
- **State machines**: Workspaces, memberships, channels, messages, workflows, tools all use explicit state machines with state versions
- **Renderer-neutral platform contracts**: `@responix/types` exposes `PlatformManifestDto`, `PlatformDashboardSchemaDto`, `PlatformNavigationSchemaDto` — the frontend should consume these to dynamically render navigation and dashboards
- **Streaming via SSE**: Agent/streaming execution produces ordered `StreamChunk` records; frontend must handle SSE disconnect/reconnect
- **Webhook endpoints are public**: Channel webhooks (`/channel-runtime/webhooks/...`) use HMAC signature verification, not JWT

---

## 2. Monorepo Frontend Layout

### 2.1 Proposed Directory Structure

```
responix/
├── apps/
│   ├── api/                    # existing NestJS backend (UNCHANGED)
│   ├── dashboard/              # Application 1: Responix Dashboard
│   │   ├── app/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   ├── providers/
│   │   │   ├── stores/
│   │   │   └── lib/
│   │   ├── public/
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   └── client/                 # Application 2: Responix Client
│       ├── app/
│       ├── src/
│       │   ├── modules/
│       │   ├── providers/
│       │   ├── stores/
│       │   └── lib/
│       ├── public/
│       ├── next.config.js
│       ├── tailwind.config.ts
│       └── package.json
├── packages/
│   ├── config/                 # existing (UNCHANGED)
│   ├── database/               # existing (UNCHANGED)
│   ├── types/                  # existing platform contracts + new frontend types
│   │   └── src/
│   │       └── api/            # generated or hand-written API DTO types
│   ├── ui/                     # shared design system
│   │   └── src/
│   │       ├── components/     # shadcn/ui primitives
│   │       ├── hooks/
│   │       ├── icons/
│   │       └── theme/
│   ├── api-client/             # NEW: shared API layer
│   │   └── src/
│   │       ├── client.ts
│   │       ├── interceptors/
│   │       ├── resources/      # per-module API clients
│   │       └── streaming/
│   ├── auth/                   # NEW: shared authentication logic
│   │   └── src/
│   │       ├── tokens.ts
│   │       ├── guards/
│   │       └── hooks/
│   ├── state/                  # NEW: shared state management primitives
│   │   └── src/
│   │       ├── query-client.ts
│   │       └── websocket/
│   └── utils/                  # existing (UNCHANGED)
├── docs/
├── infra/
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

### 2.2 Workspace Dependencies

```yaml
# pnpm-workspace.yaml (existing, UNCHANGED)
packages:
  - apps/*
  - packages/*
```

```json
// turbo.json pipeline (proposed additions for client)
{
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**", "dist/**"] },
    "lint": {},
    "typecheck": {},
    "test": {},
    "dev": { "cache": false, "persistent": true }
  }
}
```

---

## 3. Shared Packages Architecture

### 3.1 `@responix/api-client` (New Package)

**Responsibility:** Single source of truth for all HTTP communication with the NestJS API.

```
packages/api-client/src/
├── client.ts                  # axios/fetch instance with baseURL, interceptors
├── interceptors/
│   ├── auth.ts               # attach Bearer token, refresh on 401
│   ├── tenant.ts             # x-request-id, workspace context headers
│   ├── error.ts              # map HTTP status → domain errors
│   └── retry.ts              # idempotent retry logic
├── resources/
│   ├── auth.ts               # login, refresh, logout
│   ├── workspaces.ts
│   ├── platform.ts           # bootstrap, manifest, permissions
│   ├── ai.ts                 # providers, routing, invocations
│   ├── agents.ts
│   ├── prompts.ts
│   ├── workflows.ts
│   ├── knowledge.ts
│   ├── tools.ts
│   ├── channels.ts           # WhatsApp, multi-channel
│   ├── conversations.ts
│   ├── executions.ts         # kernel, pipeline, runtime
│   ├── memory.ts
│   ├── retrieval.ts
│   ├── streaming.ts          # SSE connection manager
│   └── dashboard-runtime.ts  # bootstrap manifest
├── streaming/
│   ├── sse-manager.ts        # EventSource abstraction with reconnect
│   ├── chunk-parser.ts       # parse StreamChunk DTOs
│   └── abort-controller.ts   # cancellation support
└── types/
    └── index.ts              # re-export request/response types
```

**Key Design Decisions:**
- Use **native `fetch`** (not axios) for future-proofing, streaming support, and smaller bundle size
- All resources return **typed promises** using DTOs derived from backend or `@responix/types`
- **Request deduplication** via request-idempotency for mutations
- **Automatic token refresh** on 401: queue inflight requests, refresh once, retry all

### 3.2 `@responix/auth` (New Package)

**Responsibility:** Authentication state, token management, guards, hooks shared across both apps.

```
packages/auth/src/
├── tokens.ts                 # accessToken / refreshToken storage (secure, httpOnly cookie preferred)
├── session.ts                # parse JWT claims, calculate expiry
├── guards/
│   ├── permission-guard.tsx  # React component: render children only if permission satisfied
│   ├── role-guard.tsx
│   └── workspace-guard.tsx   # redirect if no active workspace
├── hooks/
│   ├── use-auth.ts           # { user, workspace, login, logout, refresh }
│   ├── use-permissions.ts    # resolved permission array + helper `hasPermission(code)`
│   ├── use-workspace.ts      # current workspace context
│   └── use-tenant.ts         # tenant context for API calls
└── providers/
    └── auth-provider.tsx     # React context/provider wrapping auth state
```

**Key Design Decisions:**
- **Storage**: Refresh token in `httpOnly` cookie (set by backend); access token in memory (never localStorage for XSS safety)
- **Silent refresh**: SetInterval at `expiry - 60s` to proactively refresh
- **Workspace selection**: On login, if user has multiple memberships, present workspace switcher before establishing tenant context

### 3.3 `@responix/state` (New Package)

**Responsibility:** Shared state management primitives built on TanStack Query.

```
packages/state/src/
├── query-client.ts           # default QueryClient config (staleTime, gcTime, retry)
├── websocket/
│   ├── socket-client.ts      # WebSocket or SSE real-time connection
│   ├── channel-subscriptions.ts  # subscribe to channel events
│   └── presence-manager.ts   # agent/user presence tracking
└── hooks/
    ├── use-query.ts          # thin wrappers with default workspace scoping
    ├── use-mutation.ts
    ├── use-infinite-query.ts
    └── use-optimistic.ts     # optimistic update helpers for state machines
```

**Key Design Decisions:**
- **TanStack Query (React Query)** as the primary server-state cache layer
- **No global client-state library** (Zustand/Redux) unless complex client-only state emerges; prefer React context + refs for ephemeral UI state
- **Query keys are hierarchical**: `["workspaces", workspaceId, "conversations", conversationId, "messages"]`
- **Optimistic updates** for state machine transitions (e.g., message state `QUEUED` → `SENT`)

### 3.4 `@responix/ui` (Extended from existing)

**Responsibility:** Design System — component primitives, icons, theming, layouts.

```
packages/ui/src/
├── components/               # shadcn/ui primitives
│   ├── button.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   ├── toast.tsx
│   ├── tooltip.tsx
│   ├── badge.tsx
│   ├── avatar.tsx
│   ├── card.tsx
│   ├── skeleton.tsx
│   ├── scroll-area.tsx
│   ├── separator.tsx
│   ├── sheet.tsx
│   ├── sidebar.tsx
│   ├── command.tsx           # cmdk search
│   ├── calendar.tsx
│   └── ...
├── composite/                # higher-order components built from primitives
│   ├── data-table.tsx        # sortable, filterable, paginated table
│   ├── form-builder.tsx      # render forms from PlatformFormDto schema
│   ├── widget-renderer.tsx   # render PlatformWidgetDto dynamically
│   ├── page-builder.tsx      # render PlatformPageDto/PlatformSectionDto
│   ├── search-command.tsx    # global command palette
│   ├── theme-toggle.tsx
│   └── workspace-switcher.tsx
├── hooks/
│   ├── use-theme.ts
│   ├── use-media-query.ts
│   ├── use-debounce.ts
│   └── use-local-storage.ts
├── icons/
│   └── index.ts              # lucide-react re-exports + custom icons
├── theme/
│   ├── tokens.ts             # design tokens (colors, spacing, radius, typography)
│   ├── provider.tsx          # next-themes wrapper
│   └── globals.css           # Tailwind layers, CSS variables
└── utils/
    └── cn.ts                 # existing class-variance-authority helper
```

### 3.5 `@responix/types` (Extended)

**Responsibility:** All shared TypeScript types.

```
packages/types/src/
├── platform/                 # existing renderer-neutral contracts
│   ├── access.ts
│   ├── common.ts
│   ├── dashboard.ts
│   ├── forms.ts
│   ├── manifest.ts
│   ├── navigation.ts
│   └── registry.ts
└── api/                      # NEW: API request/response DTO types
    ├── auth.ts
    ├── workspace.ts
    ├── ai.ts
    ├── platform.ts
    ├── channel.ts
    ├── conversation.ts
    ├── agent.ts
    ├── workflow.ts
    ├── tool.ts
    ├── knowledge.ts
    └── streaming.ts
```

---

## 4. Application 1: Responix Dashboard

### 4.1 Architecture Overview

The Dashboard is the **internal SaaS administration console**. It consumes the renderer-neutral platform manifest (`GET /api/v1/dashboard-runtime/bootstrap`) to dynamically construct navigation, pages, and widgets based on the user's resolved permissions and role.

**Tech Stack:**
- Next.js 15 (App Router)
- React 19
- TypeScript (strict)
- Tailwind CSS v4
- TanStack Query
- `@responix/ui`, `@responix/api-client`, `@responix/auth`, `@responix/state`

### 4.2 Routing Architecture

```
app/
├── (auth)/
│   └── login/
│       └── page.tsx              # workspace-aware login form
├── (app)/                        # authenticated layout
│   ├── layout.tsx                # AppShell: sidebar + topbar + main content
│   ├── page.tsx                  # redirect to /dashboard or workspace home
│   ├── dashboard/
│   │   └── page.tsx              # main dashboard (from platform manifest)
│   ├── workspaces/
│   │   └── page.tsx              # workspace list + create
│   ├── settings/
│   │   ├── page.tsx              # workspace settings
│   │   ├── branding/
│   │   ├── members/
│   │   ├── roles/
│   │   └── billing/
│   ├── ai/
│   │   ├── providers/
│   │   ├── prompts/
│   │   ├── agents/
│   │   └── routing/
│   ├── studio/
│   │   ├── workflows/
│   │   ├── tools/
│   │   └── projects/
│   ├── knowledge/
│   │   └── page.tsx
│   ├── conversations/
│   │   └── page.tsx
│   ├── channels/
│   │   └── page.tsx              # WhatsApp + multi-channel config
│   ├── runtime/
│   │   ├── executions/
│   │   ├── memory/
│   │   ├── retrieval/
│   │   └── optimization/
│   ├── analytics/
│   │   └── page.tsx
│   └── audit/
│       └── page.tsx
├── api/
│   └── auth/
│       └── callback/
│           └── route.ts          # OAuth callback if added later
└── layout.tsx
```

**Route Guard Pattern:**
- `(app)/layout.tsx` wraps `<AuthProvider>` + `<TenantGuard>` + `<PermissionGuard>`
- Navigation items are **filtered server-side** by permissions from the bootstrap manifest
- Deep links to unauthorized routes show a 403 page with "Request Access" action

### 4.3 Module Structure (per domain)

Each module follows a consistent folder pattern:

```
src/modules/[domain]/
├── components/          # module-specific React components
├── forms/               # form schemas (Zod) + form components
├── hooks/               # TanStack Query hooks for this domain
├── types.ts             # module-local types
└── index.ts             # public API of the module
```

### 4.4 Dynamic Dashboard Engine

The Dashboard is **not hardcoded** — it renders from the platform manifest:

1. On mount / workspace switch, call `GET /api/v1/dashboard-runtime/bootstrap`
2. Receive `PlatformManifestDto` containing:
   - `navigation`: sidebar + topbar items with visibility conditions
   - `dashboard.pages`: pages with sections and widgets
   - `themes`: brand colors, typography
   - `features`: enabled/disabled feature flags
   - `whiteLabel`: company branding overrides
3. Render navigation dynamically using `<PlatformNavigationSchemaDto>`
4. Render dashboard pages using `<PageBuilder page={page} />` which iterates sections → widgets
5. Each widget kind (`card`, `metric`, `table`, `chart`, `timeline`, etc.) has a registered renderer

**Widget Registry:**
```typescript
// Widget kind → component mapping
const widgetRegistry: Record<PlatformWidgetKind, ComponentType<WidgetProps>> = {
  card: MetricCardWidget,
  metric: MetricValueWidget,
  table: DataTableWidget,
  chart: ChartWidget,        // Recharts / Tremor
  list: ListWidget,
  tabs: TabsWidget,
  timeline: TimelineWidget,
  activity: ActivityFeedWidget,
  markdown: MarkdownWidget,
  "json-viewer": JsonViewerWidget,
  "code-viewer": CodeViewerWidget,
  "button-group": ButtonGroupWidget,
  "quick-actions": QuickActionsWidget,
};
```

### 4.5 State Management Strategy

| State Type | Solution |
|-----------|----------|
| Server State | TanStack Query with workspace-scoped query keys |
| Auth State | `@responix/auth` React context |
| Tenant Context | React context derived from JWT claims + `/platform/current` |
| UI State (ephemeral) | React `useState` / `useReducer` |
| Form State | React Hook Form + Zod schemas |
| Real-time Updates | SSE via `@responix/state/websocket` for notifications, execution events |
| Dashboard Manifest | TanStack Query with `staleTime: 5 * 60 * 1000` (cache 5min) |

### 4.6 Key Dashboard Modules

| Module | Backend API | Frontend Focus |
|--------|-------------|----------------|
| Authentication | `POST /auth/*` | Login, workspace selection, session refresh, logout |
| Workspace Mgmt | `POST /workspaces/*` | Create, settings, lifecycle (suspend/archive/restore), invitations |
| AI Providers | `GET/POST /ai/*` | Provider discovery, credential management (masked), routing test |
| Prompt Studio | `GET/POST /prompt-library/*` | Draft/published lifecycle, version diff, variable preview |
| Agent Studio | `GET/POST /agent-studio/*` | Agent config, prompt bindings, capability toggles, publish |
| Workflow Studio | `GET/POST /workflow-engine/*` | Visual node editor (React Flow), edge connections, condition builder |
| Tool Registry | `GET/POST /tool-registry/*` | Tool definitions, parameter schemas, version publish |
| Knowledge Base | `GET/POST /knowledge-base/*` | Upload, chunk preview, indexing status, search test |
| Memory | `GET/POST /memory-runtime/*` | Memory records, scope viewer, reference graph |
| Retrieval | `GET/POST /retrieval-runtime/*` | Runtime config, execution test, diagnostics |
| Conversations | `GET/POST /conversation-runtime/*` | Conversation list, detail, message history |
| WhatsApp Channels | `GET/POST /channel-runtime/*` | Channel setup, connection config, webhook status, message log |
| Runtime Monitoring | `GET /execution-kernel/*`, `GET /streaming-runtime/*` | Execution trace viewer, stream session replay, metrics |
| Analytics | `GET /usage-statistics/*` | Charts, cost breakdown, token usage, growth metrics |
| Billing | `GET /subscriptions/*`, `GET /payments/*` | Plan display, usage quotas, invoice list |
| Team Mgmt | `GET /workspaces/current/members` | Member list, role assignment, invitations |
| Roles & Permissions | `GET/POST /platform/permissions/*` | Role CRUD, permission matrix UI, overrides |
| Audit Logs | `GET /audit-logs/*` | Filterable table, diff viewer for changes |

---

## 5. Application 2: Responix Client

### 5.1 Architecture Overview

The Client is a **standalone product** for customer support agents. It is completely independent from the Dashboard:
- Different codebase (`apps/client/`)
- Different routing, layout, and visual design
- Different authentication boundary (shares JWT system but may have different session policies)
- Different deployment target (could be deployed separately)

**Tech Stack:**
- Next.js 15 (App Router)
- React 19
- TypeScript (strict)
- Tailwind CSS v4
- TanStack Query
- `@responix/ui`, `@responix/api-client`, `@responix/auth`, `@responix/state`

### 5.2 Routing Architecture

```
app/
├── (auth)/
│   └── login/
│       └── page.tsx              # agent login (simpler, workspace pre-selected)
├── (app)/                        # authenticated agent layout
│   ├── layout.tsx                # AgentShell: inbox sidebar + conversation panel
│   ├── page.tsx                  # redirect to /inbox
│   ├── inbox/
│   │   └── page.tsx              # conversation list with filters
│   ├── conversations/
│   │   └── [id]/
│   │       └── page.tsx          # conversation detail view
│   ├── contacts/
│   │   └── page.tsx              # customer directory
│   ├── contacts/
│   │   └── [id]/
│   │       └── page.tsx          # customer profile + history
│   ├── whatsapp/
│   │   └── page.tsx              # WhatsApp-specific view
│   ├── ai/
│   │   └── page.tsx              # AI assistant panel, agent handoff
│   ├── settings/
│   │   └── page.tsx              # personal preferences, quick replies
│   └── profile/
│       └── page.tsx              # agent profile, presence status
└── layout.tsx
```

### 5.3 Layout Architecture

The Client uses a **persistent 3-panel layout** optimized for speed:

```
┌─────────────────────────────────────────────────────────────┐
│  TopBar: Search | Presence Toggle | Notifications | Profile │
├────────────┬──────────────────────────────┬─────────────────┤
│            │                              │                 │
│  Inbox     │   Conversation               │  Context Panel  │
│  Sidebar   │   Thread                     │  (Customer      │
│            │                              │   Profile, AI   │
│  - Open    │   ┌────────────────────┐     │   Suggestions,  │
│  - Pending │   │ Message bubbles    │     │   Notes)        │
│  - Closed  │   │                    │     │                 │
│            │   │ [Input composer]   │     │                 │
│            │   └────────────────────┘     │                 │
│            │                              │                 │
└────────────┴──────────────────────────────┴─────────────────┘
```

- **Left Panel**: Conversation list with real-time status indicators
- **Center Panel**: Active conversation thread with message composer
- **Right Panel**: Contextual info (customer profile, AI suggestions, internal notes)

### 5.4 State Management Strategy

| State Type | Solution |
|-----------|----------|
| Server State | TanStack Query with aggressive optimistic updates |
| Conversation Cache | Normalized conversation store (Zustand) for instant inbox switching |
| Real-time Messages | SSE/WebSocket push → append to conversation cache immediately |
| Presence | WebSocket heartbeat → show agent/customer online status |
| Composer State | Local React state (draft, attachments, quick reply selection) |
| Search / Filters | URL query params + TanStack Query |
| Notifications | Toast system for new messages, assignments |

### 5.5 Key Client Modules

| Module | Backend API | Frontend Focus |
|--------|-------------|----------------|
| Inbox | `GET /conversation-runtime/*` | Real-time conversation list, unread counts, assignment badges |
| Conversation Thread | `GET /conversation-runtime/messages`, `GET /channel-runtime/messages` | Message rendering (text, image, template), scroll pagination, read receipts |
| Composer | `POST /channel-runtime/messages` | Rich text input, attachments, quick replies, emoji, templates |
| Contacts | `GET /customers/*` | Customer directory, profile view, conversation history |
| WhatsApp | `GET /channel-runtime/*` | WhatsApp-specific UI: templates, media preview, status tracking |
| AI Assistant | `POST /ai/invocations` | Inline AI suggestions, agent handoff toggle, AI draft generation |
| Agent Handoff | `POST /workspaces/current/members` | Transfer conversation to another agent, escalation workflows |
| Notes | `POST /conversation-runtime/notes` | Internal team notes per conversation |
| Attachments | `POST /channel-runtime/attachments` | Upload, preview, download |
| Search | `GET /conversation-runtime/*` (with filters) | Full-text search across conversations, contacts, messages |
| Filters | Query params | Status, channel, date, assigned-to, priority filters |
| Presence | WebSocket/SSE | Agent online status, typing indicators |
| Quick Replies | `GET /prompt-library/*` | Predefined response snippets, searchable |
| Timeline | `GET /execution-events/*` | Conversation event history (assignments, AI actions, notes) |

### 5.6 Real-time Architecture

The Client is **real-time first**. All agents see conversation updates instantly:

```
┌──────────────┐     SSE Connection      ┌──────────────┐
│   Client     │ ◄─────────────────────  │   NestJS     │
│   (Browser)  │   /streaming/events     │   API        │
└──────────────┘                         └──────────────┘
       │                                        │
       │  1. New message received via webhook   │
       │  2. Backend normalizes + persists      │
       │  3. Backend pushes SSE event           │
       │     to subscribed workspace clients    │
       │◄───────────────────────────────────────┘
```

**Event Types:**
- `conversation:updated` — status, assignment, priority changed
- `message:received` — new inbound message
- `message:sent` — outbound message confirmed
- `message:read` — read receipt
- `presence:changed` — agent/customer online/offline
- `typing:started` / `typing:stopped`
- `notification:new` — system notification

**Implementation:**
- Single SSE connection per authenticated session
- Event source reconnects with exponential backoff
- Events are normalized and dispatched to TanStack Query cache via `queryClient.setQueryData()`

---

## 6. Cross-Cutting Concerns

### 6.1 Authentication Strategy (Both Apps)

```
Login Flow:
1. User submits credentials → POST /api/v1/auth/login
2. Backend sets httpOnly cookie with refresh token
3. Backend returns access token + user metadata in response body
4. Frontend stores access token in memory (React context/ref)
5. Frontend establishes tenant context from JWT claims
6. Frontend calls GET /api/v1/platform/current to resolve permissions, features, branding

Token Refresh:
1. Background timer triggers 60s before access token expiry
2. POST /api/v1/auth/refresh (cookie automatically sent)
3. New access token returned, stored in memory
4. All queued API calls resume with new token

Logout:
1. POST /api/v1/auth/logout
2. Clear memory token
3. Backend revokes session + clears cookie
4. Redirect to login
```

### 6.2 Error Handling Architecture

| Layer | Strategy |
|-------|----------|
| API Client | Map HTTP status to domain error classes (`PermissionDeniedError`, `ValidationError`, `NotFoundError`, `ServerError`) |
| React Boundary | `react-error-boundary` per major route segment; show friendly error UI |
| Toast Notifications | Non-blocking errors shown as toasts (permission denied, validation failed) |
| Form Errors | Zod validation errors mapped to field-level error messages |
| Retry | Idempotent GETs retry 3x with exponential backoff; mutations retry only on network errors |
| Fallback | Offline detection → show "Working offline" banner; queue mutations for retry |

### 6.3 Streaming Handling

```
Agent Streaming Flow:
1. User triggers AI action → POST /api/v1/ai/invocations (or streaming endpoint)
2. Backend opens SSE stream
3. Frontend receives StreamChunk DTOs with sequence numbers
4. Frontend appends chunks to a reactive buffer
5. On stream completion, final content persisted; frontend transitions from streaming to complete
6. On disconnect, attempt reconnect with last received sequence
7. On abort, call AbortController.abort()
```

**Streaming UI Pattern:**
- Show a "streaming indicator" (pulsing cursor) while chunks arrive
- Render partial content incrementally
- On completion, replace streaming block with final message
- On error, show retry action

### 6.4 Theme Architecture

**Design System Tokens (in `@responix/ui/theme/tokens.ts`):**
```typescript
export const tokens = {
  colors: {
    primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
    secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
    // ...semantic colors
  },
  radius: { sm: "0.25rem", md: "0.5rem", lg: "0.75rem", xl: "1rem" },
  spacing: { // Tailwind scale }
};
```

**Theme Strategy:**
- Base theme uses **shadcn/ui** with CSS variables
- Workspace branding overrides via `PlatformThemeManifestDto` from `/platform/current`
- `next-themes` for light/dark/system mode
- Dashboard and Client may apply different brand tokens but share component primitives

### 6.5 Component Architecture

**Composition Pattern:**
- Primitives from `@responix/ui/components` are unstyled or minimally styled
- Composite components (data-table, form-builder) live in `@responix/ui/composite`
- Application-specific components live in `apps/[app]/src/modules/[domain]/components`

**Component Contract:**
```typescript
// All shared components accept:
interface BaseProps {
  className?: string;
  children?: React.ReactNode;
  "data-testid"?: string;
}
```

### 6.6 Performance Strategy

| Technique | Application |
|-----------|-------------|
| Code Splitting | Next.js dynamic imports per route module |
| Tree Shaking | ESM-only packages, side-effect-free exports |
| Image Optimization | Next.js `<Image>` with Cloudflare R2 CDN |
| Font Optimization | `next/font` for Inter or workspace-branded font |
| Query Optimization | `staleTime` tuned per resource type; prefetch on hover |
| Virtualization | `react-window` or `@tanstack/react-virtual` for long conversation/message lists |
| Bundle Analysis | `next-bundle-analyzer` in CI |
| Service Worker | Optional PWA support for Client (offline queue, push notifications) |

### 6.7 Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | Utilities, hooks, pure functions, API client mappers |
| Component | Storybook + @testing-library/react | Isolated component rendering, interaction tests |
| Integration | @testing-library/react + MSW | Page-level flows with mocked API |
| E2E | Playwright | Critical user journeys (login → inbox → send message → receive reply) |
| Visual | Chromatic / Storybook | Visual regression on shared UI components |
| Accessibility | axe-core | Automated a11y checks in CI |

**Test File Conventions:**
```
Component.tsx
Component.test.tsx          # unit + integration
Component.stories.tsx       # Storybook stories
```

### 6.8 API Layer Design (Detailed)

**Resource Pattern (per backend module):**
```typescript
// packages/api-client/src/resources/channels.ts
export const channelsApi = {
  list: (workspaceId: string, query: ChannelListQueryDto) =>
    apiClient.get(`/channel-runtime/channels`, { params: query }),
  
  create: (workspaceId: string, dto: CreateChannelDto) =>
    apiClient.post(`/channel-runtime/channels`, dto),
  
  sendMessage: (workspaceId: string, channelId: string, dto: SendChannelMessageDto) =>
    apiClient.post(`/channel-runtime/channels/${channelId}/messages`, dto),
  
  // ...
};
```

**React Query Hook Pattern:**
```typescript
// apps/client/src/modules/channels/hooks/use-channel-messages.ts
export function useChannelMessages(channelId: string) {
  return useQuery({
    queryKey: ["channels", channelId, "messages"],
    queryFn: () => channelsApi.messages(channelId),
    enabled: !!channelId,
  });
}
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Sprint F1)
- [ ] Create `apps/client/` Next.js project
- [ ] Create `packages/api-client/`, `packages/auth/`, `packages/state/`
- [ ] Extend `@responix/ui` with full shadcn primitive set
- [ ] Implement auth flow (login, refresh, logout, workspace selection)
- [ ] Implement platform manifest consumption (`/dashboard-runtime/bootstrap`)
- [ ] Build shared layout shell (sidebar, topbar, navigation)

### Phase 2: Dashboard Core (Sprint F2)
- [ ] Workspace management pages
- [ ] Team management + roles/permissions UI
- [ ] Settings + branding configuration
- [ ] Audit logs viewer
- [ ] Dashboard dynamic page renderer from manifest

### Phase 3: AI Studio (Sprint F3)
- [ ] AI Providers management
- [ ] Prompt Studio (draft/publish/diff)
- [ ] Agent Studio (config, bindings, publish)
- [ ] Workflow Studio (React Flow visual editor)

### Phase 4: Operations (Sprint F4)
- [ ] Knowledge Base management
- [ ] Tool Registry
- [ ] Channel configuration (WhatsApp)
- [ ] Runtime monitoring views

### Phase 5: Client Application (Sprint F5)
- [ ] Client login + layout
- [ ] Inbox with real-time SSE
- [ ] Conversation thread view
- [ ] Composer with attachments + quick replies
- [ ] Contact directory

### Phase 6: Real-time + Polish (Sprint F6)
- [ ] Presence system
- [ ] AI assistant inline panel
- [ ] Agent handoff flow
- [ ] Mobile responsive Client
- [ ] Performance audit + optimization

---

## 8. Appendices

### A. Technology Choices Summary

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | Next.js 15 App Router | SSR/SSG, API routes, mature ecosystem |
| Language | TypeScript 5.x (strict) | Type safety, backend contract alignment |
| Styling | Tailwind CSS v4 | Utility-first, design token integration, small bundle |
| Components | shadcn/ui + custom | Headless primitives, copy-paste ownership, Radix UI base |
| Server State | TanStack Query v5 | Cache management, optimistic updates, devtools |
| Client State | React Context + Zustand (selective) | Simple for auth; Zustand only if needed for complex local state |
| Forms | React Hook Form + Zod | Performance, validation, type safety |
| Charts | Tremor + Recharts | Dashboard analytics, consistent with shadcn |
| Tables | TanStack Table v8 | Sorting, filtering, pagination, virtualization |
| Testing | Vitest + Testing Library + Playwright | Fast unit tests, realistic integration, E2E coverage |
| Icons | Lucide React | Consistent, tree-shakeable |
| Date/Time | date-fns | Modular, timezone-aware |
| Real-time | Native EventSource (SSE) | Server-sent events match backend Streaming Runtime |

### B. API Endpoint Registry (Frontend-facing)

| Domain | Base Path | Key Endpoints |
|--------|-----------|---------------|
| Auth | `/api/v1/auth` | `POST login`, `POST refresh`, `POST logout` |
| Workspaces | `/api/v1/workspaces` | `GET current`, `PATCH current`, `GET current/members` |
| Platform | `/api/v1/platform` | `GET current`, `GET manifest`, `GET features`, `PATCH branding` |
| Dashboard Runtime | `/api/v1/dashboard-runtime` | `GET bootstrap` |
| AI | `/api/v1/ai` | `GET providers`, `POST routing/resolve`, `POST invocations` |
| Channel Runtime | `/api/v1/channel-runtime` | `GET channels`, `POST channels/:id/messages`, `POST webhooks/...` |
| Agent Studio | `/api/v1/agent-studio` | CRUD agents, versions, prompt bindings |
| Workflow Engine | `/api/v1/workflow-engine` | CRUD workflows, nodes, edges |
| Tool Registry | `/api/v1/tool-registry` | CRUD tools, parameters, schemas |
| Knowledge Base | `/api/v1/knowledge-base` | CRUD bases, documents, upload |
| Conversation Runtime | `/api/v1/conversation-runtime` | CRUD conversation definitions |
| Execution Kernel | `/api/v1/execution-kernel` | Execution runs, steps, events |
| Streaming Runtime | `/api/v1/streaming-runtime` | Stream sessions, chunks |

---

*End of Architecture Proposal*
