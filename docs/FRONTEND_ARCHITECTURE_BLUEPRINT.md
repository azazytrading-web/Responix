# Responix Frontend Architecture Blueprint

> **Status:** FINAL — Implementation Contract  
> **Version:** 2.0  
> **Date:** 2026-07-31  
> **Scope:** Complete frontend execution plan for Internal Dashboard + Client Dashboard  
> **Languages:** English + Arabic (RTL from day one)  
> **Backend:** FROZEN — all consumption only

---

## Frontend Foundation Completion Matrix — 2026-08-01

The blueprint remains the architectural contract. Current foundation implementation status is:

| Foundation milestone | Status | Repository state |
| --- | --- | --- |
| FM-0 — Architecture and implementation planning | Complete | Approved blueprint and phased implementation plan established. |
| FM-1 — Build and validation stabilization | Complete | Dashboard typecheck, lint, tests, and production build form the validated baseline. |
| FM-2 — API Foundation | **Complete** | `@responix/api-client` is the canonical transport; raw NestJS DTOs and generated OpenAPI types are authoritative; duplicate Dashboard API resources were removed. |
| FM-3 — Authentication/runtime integration | **Not started** | No authentication lifecycle, provider composition, or application bootstrap integration was implemented by FM-2. |

FM-2 consolidates HTTP ownership in `packages/api-client`. Feature-specific services must not recreate transport clients or endpoint catalogs in application code.

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Overall Frontend Architecture](#2-overall-frontend-architecture)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Folder Structure](#4-folder-structure)
5. [Applications](#5-applications)
6. [Shared Packages](#6-shared-packages)
7. [Design System Architecture](#7-design-system-architecture)
8. [Dashboard Architecture (Plugin-Based)](#8-dashboard-architecture-plugin-based)
9. [Dashboard Routing](#9-dashboard-routing)
10. [Permission Rendering](#10-permission-rendering)
11. [Navigation Architecture](#11-navigation-architecture)
12. [Layout Architecture](#12-layout-architecture)
13. [Theme Architecture](#13-theme-architecture)
14. [Realtime Abstraction](#14-realtime-abstraction)
15. [Caching Strategy](#15-caching-strategy)
16. [Offline Strategy](#16-offline-strategy)
17. [Streaming UI Architecture](#17-streaming-ui-architecture)
18. [Notification Architecture](#18-notification-architecture)
19. [Error Handling](#19-error-handling)
20. [Feature Flags](#20-feature-flags)
21. [Telemetry](#21-telemetry)
22. [Performance Strategy](#22-performance-strategy)
23. [Testing Strategy](#23-testing-strategy)
24. [Security Strategy](#24-security-strategy)
25. [Deployment Strategy](#25-deployment-strategy)
26. [OpenAPI/SDK Generation](#26-openapisdk-generation)
27. [Form Architecture](#27-form-architecture)
28. [Command Palette](#28-command-palette)
29. [Global Search](#29-global-search)
30. [Keyboard Shortcut System](#30-keyboard-shortcut-system)
31. [Widget SDK](#31-widget-sdk)
32. [User Layout Persistence](#32-user-layout-persistence)
33. [Accessibility Target](#33-accessibility-target)
34. [Motion System](#34-motion-system)
35. [Frontend Error Architecture](#35-frontend-error-architecture)
36. [API Version Compatibility](#36-api-version-compatibility)
37. [Dashboard Manifest Cache](#37-dashboard-manifest-cache)
38. [AI UI Component Library](#38-ai-ui-component-library)
39. [Charting Standard](#39-charting-standard)
40. [Rich Text Editor](#40-rich-text-editor)
41. [Data Grid Standard](#41-data-grid-standard)
42. [File Upload Architecture](#42-file-upload-architecture)
43. [AI User Experience Guidelines](#43-ai-user-experience-guidelines)
44. [Dashboard Sprint Roadmap](#44-dashboard-sprint-roadmap)
45. [Client Dashboard Sprint Roadmap](#45-client-dashboard-sprint-roadmap)



---

## 1. Executive Summary

Responix requires **two independent Next.js 15 applications** consuming a frozen NestJS backend. The architecture prioritizes:

- **Plugin-based Dashboard**: Every module (AI Studio, Workflow, Knowledge, etc.) is an independently mountable plugin. No hardcoded dashboard.
- **i18n + RTL First**: English and Arabic supported from day one. All layout, components, and tokens are direction-agnostic.
- **Shared Packages**: Seven shared packages provide the contract layer between apps and backend.
- **Dashboard First, Then Client**: Implementation is sequential. Dashboard reaches 100% before Client begins.
- **Backend as Source of Truth**: The backend's platform manifest (`/dashboard-runtime/bootstrap`) dynamically drives navigation, pages, widgets, and permissions.

---

## 2. Overall Frontend Architecture

### 2.1 Architectural Principles

| Principle | Rule |
|-----------|------|
| Backend is Truth | Frontend never invents data shapes. All DTOs mirror backend contracts. |
| Plugin-First Dashboard | Every feature module is a self-contained plugin with its own routes, components, and state. |
| Shared Nothing Between Apps | Dashboard and Client share packages, not code. No shared pages, layouts, or routes. |
| i18n from Byte Zero | No string is hardcoded. All UI text flows through `next-intl`. RTL is a first-class layout mode. |
| Transport-Agnostic Realtime | No direct EventSource or WebSocket in UI code. All realtime flows through an abstract transport layer. |
| Optimistic by Default | UI assumes success and rolls back on failure. Drafts survive disconnects. |
| Permission-Gated Rendering | If the user lacks a permission, the feature is not mounted, routed, or linked. |

### 2.2 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.x |
| Language | TypeScript | 5.x strict |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui + Radix UI primitives | latest |
| Design Tokens | CSS Custom Properties | — |
| Server State | TanStack Query (React Query) | 5.x |
| Client State | Zustand | 4.x (selective) |
| Forms | React Hook Form + Zod | 7.x + 3.x |
| i18n | next-intl | 3.x |
| Routing | Next.js App Router | 15.x |
| Realtime | Native EventSource (abstracted) | — |
| Charts | Tremor + Recharts | latest |
| Tables | TanStack Table | 8.x |
| Testing | Vitest + Testing Library + Playwright | latest |
| Icons | Lucide React | latest |
| Date/Time | date-fns | 3.x |

### 2.3 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RESPONIX FRONTEND                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐                    ┌──────────────┐                  │
│  │  Dashboard   │                    │    Client    │                  │
│  │   (App 1)    │                    │   (App 2)    │                  │
│  └──────┬───────┘                    └──────┬───────┘                  │
│         │                                   │                           │
│         └──────────────┬────────────────────┘                           │
│                        │                                                │
│         ┌──────────────▼────────────────────┐                          │
│         │        SHARED PACKAGES            │                          │
│         ├──────────┬──────────┬─────────────┤                          │
│         │api-client│  auth    │    state    │                          │
│         │  types   │   ui     │design-system│                          │
│         │  shared  │          │             │                          │
│         └────┬─────┴────┬─────┴──────┬──────┘                          │
│              │          │            │                                   │
│              └──────────┼────────────┘                                   │
│                         │                                               │
│              ┌──────────▼──────────┐                                    │
│              │   HTTP / SSE / WS   │                                    │
│              └──────────┬──────────┘                                    │
│                         │                                               │
│              ┌──────────▼──────────┐                                    │
│              │   NestJS API v1     │                                    │
│              │  (FROZEN BACKEND)   │                                    │
│              └─────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Monorepo Structure

```
responix/
├── apps/
│   ├── api/                          # NestJS backend (FROZEN, NO CHANGES)
│   ├── dashboard/                    # Application 1: Internal SaaS Dashboard
│   └── client/                       # Application 2: Agent Client (NOT YET BUILT)
│
├── packages/
│   ├── config/                       # ESLint, Prettier, TS configs (EXISTING)
│   ├── database/                     # Prisma schema (EXISTING, backend-only)
│   ├── types/                        # Shared TypeScript contracts
│   ├── utils/                        # Lightweight utilities (EXISTING)
│   ├──
│   ├── api-client/                   # NEW: HTTP client + resource APIs
│   ├── auth/                         # NEW: Authentication logic + hooks
│   ├── state/                        # NEW: TanStack Query + Zustand primitives
│   ├── ui/                           # NEW: React component library
│   ├── design-system/                # NEW: Tokens, themes, CSS variables
│   └── shared/                       # NEW: Constants, helpers, formatters
│
├── docs/
│   ├── project-state/                # existing
│   └── architecture/                 # frontend blueprints
│
├── infra/                            # Docker, k8s, terraform
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### Turborepo Pipeline

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {},
    "typecheck": {},
    "test": { "dependsOn": ["^build"] },
    "test:ci": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

---

## 4. Folder Structure

### 4.1 Dashboard App (`apps/dashboard/`)

```
apps/dashboard/
├── app/                                    # Next.js App Router
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   │
│   ├── (app)/                              # Authenticated shell
│   │   ├── layout.tsx                      # AppShell: sidebar + topbar + main
│   │   ├── page.tsx                        # Redirect to /dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx                    # Dynamic dashboard from manifest
│   │   ├──
│   │   ├── settings/                       # Plugin: Settings
│   │   ├── platform/                       # Plugin: Platform Control
│   │   ├── workspaces/                     # Plugin: Workspace Management
│   │   ├── members/                        # Plugin: Team Management
│   │   ├── ai/
│   │   │   ├── providers/                  # Plugin: AI Providers
│   │   │   ├── prompts/                    # Plugin: Prompt Studio
│   │   │   ├── agents/                     # Plugin: Agent Studio
│   │   │   └── routing/                    # Plugin: AI Routing
│   │   ├── studio/
│   │   │   ├── workflows/                  # Plugin: Workflow Studio
│   │   │   ├── tools/                      # Plugin: Tool Registry
│   │   │   └── projects/                   # Plugin: Studio Projects
│   │   ├── knowledge/                      # Plugin: Knowledge Base
│   │   ├── channels/                       # Plugin: Channel Management
│   │   ├── conversations/                  # Plugin: Conversations
│   │   ├── runtime/
│   │   │   ├── executions/                 # Plugin: Execution Monitoring
│   │   │   ├── memory/                     # Plugin: Memory Runtime
│   │   │   ├── retrieval/                  # Plugin: Retrieval Runtime
│   │   │   └── optimization/               # Plugin: Runtime Optimization
│   │   ├── analytics/                      # Plugin: Analytics
│   │   ├── billing/                        # Plugin: Billing
│   │   └── audit/                          # Plugin: Audit Logs
│   │
│   ├── api/                                # Next.js API Routes (if needed)
│   │
│   ├── layout.tsx                          # Root layout (i18n provider, theme)
│   └── not-found.tsx
│
├── src/
│   ├── plugins/                            # PLUGIN REGISTRY
│   │   ├── index.ts                        # Plugin loader + mount registry
│   │   ├── types.ts                        # Plugin interface contract
│   │   ├──
│   │   ├── settings/
│   │   │   ├── plugin.manifest.ts          # Plugin metadata
│   │   │   ├── routes.ts                   # Route definitions
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── index.ts
│   │   ├── ai-providers/
│   │   ├── ai-prompts/
│   │   ├── ai-agents/
│   │   ├── ai-routing/
│   │   ├── workflow-studio/
│   │   ├── tool-registry/
│   │   ├── knowledge-base/
│   │   ├── channels/
│   │   ├── conversations/
│   │   ├── executions/
│   │   ├── memory/
│   │   ├── retrieval/
│   │   ├── optimization/
│   │   ├── analytics/
│   │   ├── billing/
│   │   ├── audit/
│   │   ├── members/
│   │   ├── platform/
│   │   └── workspaces/
│   │
│   ├── components/                         # App-level shared components
│   │   ├── app-shell/
│   │   ├── sidebar/
│   │   ├── topbar/
│   │   ├── command-palette/
│   │   ├── workspace-switcher/
│   │   ├── breadcrumb/
│   │   ├── page-header/
│   │   └── error-boundary/
│   │
│   ├── hooks/                              # App-level shared hooks
│   │   ├── use-bootstrap.ts
│   │   ├── use-plugin-navigation.ts
│   │   └── use-permission-gate.ts
│   │
│   ├── lib/                                # App-level utilities
│   │   ├── i18n/
│   │   │   ├── config.ts
│   │   │   ├── messages/
│   │   │   │   ├── en.json
│   │   │   │   └── ar.json
│   │   │   └── routing.ts
│   │   └── navigation-builder.ts
│   │
│   └── types/
│       └── app.d.ts
│
├── public/
│   ├── images/
│   └── fonts/
│
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── middleware.ts                           # i18n routing + auth redirect
└── package.json
```

### 4.2 Client App (`apps/client/`)

```
apps/client/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   │
│   ├── (app)/
│   │   ├── layout.tsx                      # AgentShell: 3-panel layout
│   │   ├── page.tsx                        # Redirect to /inbox
│   │   ├── inbox/
│   │   │   └── page.tsx
│   │   ├── conversations/
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── contacts/
│   │   │   └── page.tsx
│   │   ├── contacts/
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── whatsapp/
│   │   │   └── page.tsx
│   │   ├── ai-assistant/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── profile/
│   │       └── page.tsx
│   │
│   ├── layout.tsx
│   └── not-found.tsx
│
├── src/
│   ├── modules/
│   │   ├── inbox/
│   │   ├── conversation-thread/
│   │   ├── composer/
│   │   ├── contacts/
│   │   ├── ai-assistant/
│   │   ├── whatsapp/
│   │   ├── search/
│   │   ├── quick-replies/
│   │   └── presence/
│   │
│   ├── components/
│   │   ├── agent-shell/
│   │   ├── conversation-list/
│   │   ├── message-bubble/
│   │   ├── message-composer/
│   │   ├── customer-card/
│   │   ├── typing-indicator/
│   │   └── notification-toast/
│   │
│   ├── hooks/
│   ├── lib/
│   │   └── i18n/
│   │       ├── config.ts
│   │       ├── messages/
│   │       │   ├── en.json
│   │       │   └── ar.json
│   │       └── routing.ts
│   └── types/
│
├── public/
├── next.config.js
├── tailwind.config.ts
├── middleware.ts
└── package.json
```

### 4.3 Shared Packages Detail

```
packages/api-client/
├── src/
│   ├── client.ts
│   ├── interceptors/
│   │   ├── auth.ts
│   │   ├── error.ts
│   │   ├── retry.ts
│   │   └── locale.ts
│   ├── resources/
│   │   ├── auth.ts
│   │   ├── workspaces.ts
│   │   ├── platform.ts
│   │   ├── ai.ts
│   │   ├── agents.ts
│   │   ├── prompts.ts
│   │   ├── workflows.ts
│   │   ├── knowledge.ts
│   │   ├── tools.ts
│   │   ├── channels.ts
│   │   ├── conversations.ts
│   │   ├── executions.ts
│   │   ├── memory.ts
│   │   ├── retrieval.ts
│   │   ├── streaming.ts
│   │   └── dashboard-runtime.ts
│   ├── streaming/
│   │   ├── sse-connection.ts
│   │   ├── chunk-buffer.ts
│   │   └── abort-manager.ts
│   └── types/
│       └── index.ts
├── package.json
└── tsconfig.json

packages/auth/
├── src/
│   ├── tokens.ts
│   ├── session.ts
│   ├── claims.ts
│   ├── guards/
│   │   ├── permission-guard.tsx
│   │   ├── role-guard.tsx
│   │   └── workspace-guard.tsx
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-permissions.ts
│   │   ├── use-workspace.ts
│   │   └── use-tenant.ts
│   └── providers/
│       └── auth-provider.tsx
├── package.json
└── tsconfig.json

packages/state/
├── src/
│   ├── query-client.ts
│   ├── zustand/
│   │   ├── create-store.ts
│   │   └── slices/
│   ├── websocket/
│   │   ├── transport-interface.ts
│   │   ├── sse-transport.ts
│   │   ├── ws-transport.ts
│   │   └── connection-pool.ts
│   └── hooks/
│       ├── use-query.ts
│       ├── use-mutation.ts
│       ├── use-infinite-query.ts
│       ├── use-optimistic.ts
│       └── use-realtime.ts
├── package.json
└── tsconfig.json

packages/ui/
├── src/
│   ├── primitives/                         # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx
│   │   ├── tooltip.tsx
│   │   ├── badge.tsx
│   │   ├── avatar.tsx
│   │   ├── card.tsx
│   │   ├── skeleton.tsx
│   │   ├── scroll-area.tsx
│   │   ├── separator.tsx
│   │   ├── sheet.tsx
│   │   ├── sidebar.tsx
│   │   ├── command.tsx
│   │   ├── calendar.tsx
│   │   ├── popover.tsx
│   │   ├── accordion.tsx
│   │   ├── checkbox.tsx
│   │   ├── radio-group.tsx
│   │   ├── slider.tsx
│   │   ├── switch.tsx
│   │   ├── textarea.tsx
│   │   ├── label.tsx
│   │   ├── form.tsx
│   │   └── ...
│   ├── composite/                          # Higher-order components
│   │   ├── data-table.tsx
│   │   ├── form-builder.tsx
│   │   ├── widget-renderer.tsx
│   │   ├── page-builder.tsx
│   │   ├── search-command.tsx
│   │   ├── workspace-switcher.tsx
│   │   ├── theme-toggle.tsx
│   │   ├── locale-switcher.tsx
│   │   ├── error-fallback.tsx
│   │   ├── empty-state.tsx
│   │   ├── loading-state.tsx
│   │   └── pagination.tsx
│   ├── hooks/
│   │   ├── use-theme.ts
│   │   ├── use-media-query.ts
│   │   ├── use-debounce.ts
│   │   ├── use-local-storage.ts
│   │   └── use-mounted.ts
│   ├── icons/
│   │   └── index.ts
│   └── utils/
│       └── cn.ts
├── package.json
└── tsconfig.json

packages/design-system/
├── src/
│   ├── tokens/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   ├── radius.ts
│   │   ├── elevation.ts
│   │   ├── motion.ts
│   │   ├── breakpoints.ts
│   │   └── z-index.ts
│   ├── themes/
│   │   ├── light.ts
│   │   ├── dark.ts
│   │   └── index.ts
│   ├── css/
│   │   ├── variables.css
│   │   ├── reset.css
│   │   └── utilities.css
│   └── index.ts
├── package.json
└── tsconfig.json

packages/shared/
├── src/
│   ├── constants/
│   │   ├── api.ts
│   │   ├── permissions.ts
│   │   ├── routes.ts
│   │   └── feature-flags.ts
│   ├── helpers/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── dates.ts
│   │   └── strings.ts
│   └── types/
│       └── helpers.d.ts
├── package.json
└── tsconfig.json

packages/types/
├── src/
│   ├── platform/                           # EXISTING renderer-neutral contracts
│   │   ├── access.ts
│   │   ├── common.ts
│   │   ├── dashboard.ts
│   │   ├── forms.ts
│   │   ├── manifest.ts
│   │   ├── navigation.ts
│   │   └── registry.ts
│   └── api/                                # NEW: API DTO types
│       ├── auth.ts
│       ├── workspace.ts
│       ├── platform.ts
│       ├── ai.ts
│       ├── agent.ts
│       ├── prompt.ts
│       ├── workflow.ts
│       ├── tool.ts
│       ├── knowledge.ts
│       ├── channel.ts
│       ├── conversation.ts
│       ├── execution.ts
│       ├── memory.ts
│       ├── retrieval.ts
│       ├── streaming.ts
│       └── index.ts
├── package.json
└── tsconfig.json
```

---

## 5. Applications

### 5.1 Application 1: Responix Dashboard (Internal SaaS)

**Purpose:** Company administrator console for configuring, monitoring, and managing the entire Responix platform.

**User Persona:** Workspace owners, administrators, AI engineers, operations teams.

**Key Characteristics:**
- **Plugin-based architecture**: Every module is an independently mountable plugin registered at runtime.
- **Manifest-driven**: Navigation, pages, sections, and widgets come from `GET /api/v1/dashboard-runtime/bootstrap`.
- **Permission-gated**: The entire UI tree is filtered by resolved permissions from `/api/v1/platform/current`.
- **Studio-focused**: Heavy emphasis on visual builders (Workflow, Agent, Prompt) with canvas/diagram editing.

**Layout:** Sidebar navigation + topbar + main content area. Sidebar items come from the platform manifest filtered by permissions.

### 5.2 Application 2: Responix Client (Agent Product)

**Purpose:** Daily-use support agent console for handling customer conversations.

**User Persona:** Customer support agents, team leads.

**Key Characteristics:**
- **Speed-first**: Every interaction is optimized for millisecond response.
- **Real-time-first**: Messages appear instantly via SSE push.
- **Persistent layout**: 3-panel layout (inbox list, conversation thread, context sidebar) never unmounts.
- **Mobile-ready**: Responsive down to tablet; touch-optimized.

**Layout:** Topbar + 3-column persistent layout. Left = inbox, Center = thread, Right = context.

**Constraint:** NOT built until Dashboard is 100% complete.

---

## 6. Shared Packages

### 6.1 `@responix/api-client`

**Responsibility:** Single HTTP client for all backend communication.

**Design:**
- Native `fetch` (not axios) for streaming, smaller bundles, and spec compliance.
- Singleton client instance with request/response interceptors.
- Per-resource API objects (`authApi`, `workspaceApi`, `aiApi`, etc.).
- Automatic token refresh on 401 with request queuing.
- Request deduplication via AbortController.
- `x-request-id` header propagation.

### 6.2 `@responix/auth`

**Responsibility:** Authentication lifecycle, permission resolution, route guards.

**Design:**
- `AuthProvider` React context wraps the app.
- Access token held in memory (never localStorage).
- Refresh token via `httpOnly` cookie (set by backend).
- Silent refresh timer: `expiry - 60s`.
- `usePermissions()` hook returns resolved array + `hasPermission(code)` helper.
- PermissionGuard, RoleGuard, WorkspaceGuard components.

### 6.3 `@responix/state`

**Responsibility:** Server-state caching, client-state primitives, realtime transport.

**Design:**
- Default `QueryClient` with workspace-scoped query keys.
- `useRealtime()` hook subscribes to abstract transport events.
- Zustand for high-frequency client-only state (composer drafts, UI panels).
- Offline detection + background sync queue.

### 6.4 `@responix/ui`

**Responsibility:** React component library — primitives + composites.

**Design:**
- All primitives built on Radix UI + Tailwind.
- Fully typed with `forwardRef`.
- All components accept `dir` prop for RTL override.
- Composite components are data-agnostic (receive props, not fetch data).

### 6.5 `@responix/design-system`

**Responsibility:** Design tokens, CSS variables, theme definitions.

**Design:**
- Token objects in TypeScript that emit CSS custom properties.
- Separate token files: colors, typography, spacing, radius, elevation, motion, breakpoints, z-index.
- `light.ts` and `dark.ts` theme objects.
- CSS `variables.css` is the runtime contract between tokens and Tailwind.
- Motion tokens define duration, easing curves for all animations.

### 6.6 `@responix/shared`

**Responsibility:** Pure utilities, constants, formatters, validators.

**Design:**
- Zero React dependency. Tree-shakeable ESM.
- Permission code constants mirroring backend.
- API endpoint path constants.
- Date formatters (timezone-aware), number formatters, string helpers.

### 6.7 `@responix/types`

**Responsibility:** All shared TypeScript types.

**Design:**
- `platform/` — existing renderer-neutral DTOs (NO CHANGES).
- `api/` — NEW. Hand-written or generated types for every backend request/response DTO.
- All frontend packages depend on `@responix/types`.

---

## 7. Design System Architecture

### 7.1 Tokens

All design decisions are expressed as typed tokens. Tokens are the single source of truth.

```typescript
// packages/design-system/src/tokens/colors.ts
export const colorTokens = {
  base: {
    white: "#FFFFFF",
    black: "#000000",
  },
  brand: {
    50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd",
    400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8",
    800: "#1e40af", 900: "#1e3a8a", 950: "#172554",
  },
  semantic: {
    background: "var(--color-background)",
    foreground: "var(--color-foreground)",
    primary: { DEFAULT: "var(--color-primary)", foreground: "var(--color-primary-foreground)" },
    secondary: { DEFAULT: "var(--color-secondary)", foreground: "var(--color-secondary-foreground)" },
    muted: { DEFAULT: "var(--color-muted)", foreground: "var(--color-muted-foreground)" },
    accent: { DEFAULT: "var(--color-accent)", foreground: "var(--color-accent-foreground)" },
    destructive: { DEFAULT: "var(--color-destructive)", foreground: "var(--color-destructive-foreground)" },
    border: "var(--color-border)",
    input: "var(--color-input)",
    ring: "var(--color-ring)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    info: "var(--color-info)",
  },
  chart: {
    1: "var(--chart-1)", 2: "var(--chart-2)", 3: "var(--chart-3)",
    4: "var(--chart-4)", 5: "var(--chart-5)",
  },
} as const;
```

### 7.2 Colors

- **Brand palette**: Primary blue scale (50–950).
- **Semantic palette**: Background, foreground, primary, secondary, muted, accent, destructive, border, input, ring.
- **Status colors**: Success (green), warning (amber), error (red), info (blue).
- **Dark mode**: Each semantic color has a dark variant mapped via CSS variables.
- **Workspace override**: `/api/v1/platform/branding` can override primary and secondary colors. The frontend swaps CSS variables dynamically.

### 7.3 Typography

- **Font family**: Inter for LTR, IBM Plex Sans Arabic for RTL. Loaded via `next/font`.
- **Scale**: 12px (xs), 14px (sm), 16px (base), 18px (lg), 20px (xl), 24px (2xl), 30px (3xl), 36px (4xl).
- **Line heights**: 1.25 (headings), 1.5 (body), 1.75 (relaxed).
- **Weights**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold).
- **Letter spacing**: Tighter for headings, normal for body, wider for labels.

### 7.4 Icons

- **Library**: Lucide React.
- **Size scale**: 16px (sm), 20px (md), 24px (lg), 32px (xl).
- **Stroke width**: 2px default, 1.5px for dense UIs.
- **RTL**: Icons with directional meaning (arrows, chevrons) are mirrored automatically via CSS `scaleX(-1)` when `dir="rtl"`.

### 7.5 Motion

```typescript
// packages/design-system/src/tokens/motion.ts
export const motionTokens = {
  duration: {
    instant: "0ms",
    fast: "100ms",
    normal: "200ms",
    slow: "300ms",
    slower: "500ms",
  },
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",      // ease-in-out
    enter: "cubic-bezier(0, 0, 0.2, 1)",           // ease-out
    exit: "cubic-bezier(0.4, 0, 1, 1)",            // ease-in
    bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  transition: (properties: string[], duration = "normal", easing = "default") =>
    properties.map(p => `${p} ${duration} ${easing}`).join(", "),
} as const;
```

### 7.6 Elevation

- **Shadow tokens**:
  - `shadow-sm`: `0 1px 2px rgba(0,0,0,0.05)`
  - `shadow-md`: `0 4px 6px -1px rgba(0,0,0,0.1)`
  - `shadow-lg`: `0 10px 15px -3px rgba(0,0,0,0.1)`
  - `shadow-xl`: `0 20px 25px -5px rgba(0,0,0,0.1)`
- **Dark mode shadows**: Reduced opacity (0.3 → 0.15) for dark surfaces.

### 7.7 Radius

- `radius-none`: 0px
- `radius-sm`: 4px
- `radius-md`: 6px
- `radius-lg`: 8px
- `radius-xl`: 12px
- `radius-full`: 9999px

### 7.8 Layout

- **Max content width**: 1440px (dashboard), fluid (client).
- **Content padding**: 24px (desktop), 16px (tablet), 12px (mobile).
- **Page gutters**: 32px (desktop), 16px (mobile).

### 7.9 Grid

- **System**: Tailwind's 12-column grid.
- **Gap scale**: 4px, 8px, 12px, 16px, 24px, 32px, 48px.
- **Responsive breakpoints**: sm(640), md(768), lg(1024), xl(1280), 2xl(1536).

### 7.10 Responsive Rules

| Breakpoint | Layout Change |
|------------|---------------|
| < 768px | Dashboard: sidebar becomes drawer. Client: single-column (inbox or thread, not both). |
| 768–1024px | Dashboard: collapsed sidebar (icons only). Client: inbox + thread, no context panel. |
| > 1024px | Full layout for both apps. |

### 7.11 Accessibility

- **WCAG 2.1 AA** target for all components.
- **Keyboard navigation**: All interactive elements reachable via Tab. Modal traps focus.
- **Screen readers**: `aria-label`, `aria-describedby`, `role` on all composites.
- **Color contrast**: Minimum 4.5:1 for body text, 3:1 for large text.
- **Focus indicators**: Visible 2px ring with offset on all focusable elements.
- **Reduced motion**: `prefers-reduced-motion` disables all non-essential animations.
- **Skip links**: Dashboard has "Skip to main content" link.

### 7.12 RTL (Right-to-Left)

RTL is **not an afterthought**. It is built into every component from day one.

- **Direction**: `dir="rtl"` set on `<html>` based on active locale.
- **CSS Logical Properties**:
  - Use `margin-inline-start` instead of `margin-left`.
  - Use `padding-inline-end` instead of `padding-right`.
  - Use `border-start` instead of `border-left`.
- **Tailwind**: Use `start/end` utilities (`ms-4`, `pe-2`) instead of `left/right` (`ml-4`, `pr-2`).
- **Component mirroring**:
  - Sidebar: anchors to `start` (left in LTR, right in RTL).
  - Breadcrumbs: chevron direction flips.
  - Tables: text alignment follows direction.
  - Charts: x-axis labels and legend order follow direction.
  - Dialogs: close button aligns to `end`.
- **Font**: IBM Plex Sans Arabic loaded when locale is `ar`.

### 7.13 Dark Mode

- **Toggle**: System preference by default, user override stored in localStorage.
- **Implementation**: `next-themes` with `class` strategy. `dark:` Tailwind variants.
- **CSS Variables**: All color tokens have light and dark values in `variables.css`.

### 7.14 Charts

- **Library**: Recharts for flexibility, Tremor for dashboard layout consistency.
- **Tokens**: Chart colors (`chart-1` through `chart-5`) are CSS variables mapping to brand palette.
- **RTL**: Chart axes, legends, and tooltips respect text direction.
- **Accessibility**: Charts have `aria-label` descriptions and data tables as fallbacks.

### 7.15 Data Grid

- **Library**: TanStack Table v8.
- **Features**: Sorting, filtering, pagination, column visibility, row selection, virtual scrolling.
- **RTL**: Column resize handles align to `end`. Sort icons flip.

### 7.16 Empty States

- **Pattern**: Icon + heading + description + optional action button.
- **Variants**: `default`, `search`, `error`, `permission-denied`.
- **Component**: `<EmptyState variant="search" icon={SearchIcon} title={t("noResults")} description={t("tryDifferentTerm")} />`

### 7.17 Loading States

- **Skeletons**: `<Skeleton>` primitive for content placeholders. Pulse animation. Responsive to container width.
- **Spinners**: `<Spinner>` for inline loading. Size variants. Used in buttons and overlays.
- **Page loading**: Route-level suspense with `<PageSkeleton>` layout.

### 7.18 Toasts

- **Library**: Built on shadcn Toast (Radix Toast).
- **Positions**: Bottom-right (LTR), Bottom-left (RTL).
- **Duration**: 4 seconds default. Actionable toasts stay until dismissed.
- **Types**: Success, Error, Warning, Info.
- **Stacking**: Max 5 visible. Older ones fade.

### 7.19 Modals

- **Library**: Radix Dialog (shadcn Dialog).
- **Sizes**: sm (400px), md (520px), lg (720px), xl (980px), full.
- **Behavior**: Focus trap, escape to close, click outside to close (configurable), prevent body scroll.
- **Animation**: Fade + scale. Duration: 200ms.

---

## 8. Dashboard Architecture (Plugin-Based)

### 8.1 Plugin Contract

Every dashboard module is a **plugin** implementing this interface:

```typescript
// packages/types/src/platform/plugin.ts (NEW)
export interface DashboardPlugin {
  id: string;                               // e.g., "ai-agents"
  name: string;                             // e.g., "Agent Studio"
  version: string;                          // semantic version
  icon?: string;                            // lucide icon name
  permissions: string[];                    // required permissions to mount
  featureFlags?: string[];                  // required feature flags
  routes: PluginRoute[];
  navigation?: PluginNavigationItem[];
  widgets?: PluginWidgetRegistration[];
}

export interface PluginRoute {
  path: string;                             // e.g., "/ai/agents"
  component: LazyExoticComponent<ComponentType>;
  permissions?: string[];
  exact?: boolean;
}

export interface PluginNavigationItem {
  labelKey: string;                         // i18n key
  route: string;
  icon?: string;
  children?: PluginNavigationItem[];
  permissions?: string[];
}
```

### 8.2 Plugin Registration

Plugins register themselves in a central registry. The app loads only plugins the user is authorized to see.

```typescript
// apps/dashboard/src/plugins/index.ts
import { aiAgentsPlugin } from "./ai-agents";
import { workflowStudioPlugin } from "./workflow-studio";
import { knowledgeBasePlugin } from "./knowledge-base";
// ...

export const pluginRegistry: DashboardPlugin[] = [
  aiAgentsPlugin,
  workflowStudioPlugin,
  knowledgeBasePlugin,
  // ... all plugins
];

export function getAuthorizedPlugins(permissions: string[], features: string[]): DashboardPlugin[] {
  return pluginRegistry.filter(plugin =>
    plugin.permissions.every(p => permissions.includes(p)) &&
    (plugin.featureFlags?.every(f => features.includes(f)) ?? true)
  );
}
```

### 8.3 Plugin File Structure

Every plugin follows an identical structure:

```
src/plugins/[plugin-name]/
├── plugin.manifest.ts          # Plugin metadata + registration
├── routes.ts                   # Route definitions with lazy imports
├── navigation.ts               # Sidebar nav items
├── components/
│   ├── index.ts
│   └── ...
├── hooks/
│   ├── index.ts
│   └── ...
├── forms/
│   └── ...
└── index.ts                    # Public exports
```

### 8.4 Dynamic Route Generation

At build time, Next.js App Router routes exist for all plugins. At runtime, the app filters which navigation items and widgets render based on permissions.

**Hardcoded routes are OK** — the `/app` directory must contain the route files for Next.js to build. But the **sidebar links** and **dashboard widgets** are dynamic from the manifest.

### 8.5 Plugin List

| Plugin ID | Name | Required Permissions |
|-----------|------|---------------------|
| `dashboard` | Main Dashboard | `platform.read` |
| `ai-providers` | AI Providers | `ai.configure` |
| `ai-prompts` | Prompt Studio | `ai.configure` |
| `ai-agents` | Agent Studio | `ai.configure` |
| `ai-routing` | AI Routing | `ai.configure` |
| `workflow-studio` | Workflow Studio | `workflow.configure` |
| `tool-registry` | Tool Registry | `tool.configure` |
| `knowledge-base` | Knowledge Base | `knowledge.configure` |
| `channels` | Channels | `channel.runtime.read` |
| `conversations` | Conversations | `conversation.read` |
| `executions` | Execution Monitoring | `execution.read` |
| `memory` | Memory Runtime | `memory.read` |
| `retrieval` | Retrieval Runtime | `retrieval.read` |
| `optimization` | Runtime Optimization | `optimization.read` |
| `analytics` | Analytics | `analytics.read` |
| `billing` | Billing | `billing.read` |
| `members` | Team Management | `workspace.members.manage` |
| `platform` | Platform Control | `platform.configure` |
| `workspaces` | Workspace Management | `workspace.read` |
| `audit` | Audit Logs | `audit.read` |
| `settings` | Settings | `platform.read` |

---

## 9. Dashboard Routing

### 9.1 Route Structure

```
/dashboard                         → Main dashboard (from manifest)
/settings                          → Workspace settings
/settings/branding                 → Branding configuration
/settings/billing                  → Billing settings
/platform                          → Platform control
/platform/permissions              → Permission matrix
/platform/roles                    → Role management
/workspaces                        → Workspace list
/workspaces/[id]                   → Workspace detail
/ai/providers                      → AI Provider management
/ai/prompts                        → Prompt Studio
/ai/agents                         → Agent Studio
/ai/routing                        → AI Routing
/studio/workflows                  → Workflow Studio
/studio/workflows/[id]             → Workflow editor
/studio/workflows/[id]/executions  → Workflow execution history
/studio/tools                      → Tool Registry
/studio/projects                   → Studio Projects
/knowledge                         → Knowledge Base
/knowledge/bases                   → Knowledge bases list
/knowledge/documents               → Documents
/channels                          → Channel management
/channels/whatsapp                 → WhatsApp channels
/channels/[id]                     → Channel detail
/conversations                     → Conversation list
/conversations/[id]                → Conversation detail
/runtime/executions                → Execution monitoring
/runtime/memory                    → Memory runtime
/runtime/retrieval                 → Retrieval runtime
/runtime/optimization              → Runtime optimization
/analytics                         → Analytics dashboard
/billing                           → Billing overview
/billing/invoices                  → Invoice list
/members                           → Team members
/members/invitations               → Pending invitations
/audit                             → Audit logs
```

### 9.2 Route Guards

Each route is wrapped by middleware and layout guards:

1. **Auth Guard** (`middleware.ts`): Redirect unauthenticated to `/login`.
2. **Workspace Guard**: Ensure active workspace is resolved. Show workspace switcher if multiple.
3. **Permission Guard**: Check resolved permissions against route requirements. Redirect to `/unauthorized` if missing.
4. **Feature Flag Guard**: Hide routes for disabled features.

---

## 10. Permission Rendering

### 10.1 Backend RBAC as Source of Truth

The frontend NEVER invents permissions. It consumes `permissions` array from `GET /api/v1/platform/current`.

### 10.2 Permission Gating Strategies

| Strategy | Implementation |
|----------|---------------|
| **Route-level** | Middleware checks permission before rendering route. Unauthorized → redirect. |
| **Navigation-level** | Sidebar items filtered by `item.permissions`. Missing permission = item not rendered. |
| **Component-level** | `<PermissionGate permission="ai.configure">{children}</PermissionGate>` |
| **Action-level** | Buttons disabled or hidden if permission missing. Tooltip explains why. |
| **Field-level** | Form fields hidden when user lacks edit permission (read-only mode). |

### 10.3 Permission Gate Component

```tsx
function PermissionGate({
  permission,
  fallback = null,
  children
}: {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { hasPermission } = usePermissions();
  return hasPermission(permission) ? children : fallback;
}
```

### 10.4 Plugin Mounting

A plugin is only registered in the navigation and route map if ALL its required permissions are present in the user's resolved permission set.

---

## 11. Navigation Architecture

### 11.1 Navigation Sources

The dashboard navigation is built from **two sources merged together**:

1. **Platform Manifest** (`GET /api/v1/dashboard-runtime/bootstrap`): Renderer-neutral navigation schema from backend.
2. **Plugin Registry**: Frontend plugins define their navigation items.

The frontend merges these, filters by permissions, and renders the sidebar.

### 11.2 Navigation Structure

```
Sidebar (collapsible, resizable)
├── Workspace Header
│   └── Name + Switcher
├── Main Navigation
│   ├── Dashboard
│   ├── AI
│   │   ├── Providers
│   │   ├── Prompts
│   │   ├── Agents
│   │   └── Routing
│   ├── Studio
│   │   ├── Workflows
│   │   ├── Tools
│   │   └── Projects
│   ├── Knowledge
│   ├── Conversations
│   ├── Channels
│   ├── Runtime
│   │   ├── Executions
│   │   ├── Memory
│   │   ├── Retrieval
│   │   └── Optimization
│   ├── Analytics
│   └── Billing
├── Secondary Navigation
│   ├── Members
│   ├── Audit
│   └── Platform
└── Bottom Actions
    ├── Settings
    ├── Help
    └── Theme Toggle + Locale Switcher
```

### 11.3 Navigation Behavior

- **Active state**: Exact route match + child route highlighting.
- **Collapse**: Clicking section header toggles children. State persisted in localStorage.
- **RTL**: Sidebar anchors to `start` (right side in RTL).
- **Mobile**: Sidebar becomes a slide-out drawer. Swipe to open/close.

### 11.4 Breadcrumbs

Auto-generated from route hierarchy. Last item is current page (not clickable). Home icon links to `/dashboard`.

---

## 12. Layout Architecture

### 12.1 Dashboard Layout (`AppShell`)

```
┌────────────────────────────────────────────────────────────────┐
│  TopBar (64px)                                                 │
│  ├─ Toggle Sidebar │ Breadcrumbs │ Search │ Actions │ Profile  │
├──────────┬─────────────────────────────────────────────────────┤
│          │                                                     │
│ Sidebar  │  Main Content Area                                  │
│ (256px)  │  ┌─────────────────────────────────────────────┐   │
│          │  │  Page Header                                │   │
│          │  │  Title + Description + Actions              │   │
│          │  ├─────────────────────────────────────────────┤   │
│          │  │                                             │   │
│          │  │  Content                                    │   │
│          │  │  (scrollable)                               │   │
│          │  │                                             │   │
│          │  └─────────────────────────────────────────────┘   │
│          │                                                     │
└──────────┴─────────────────────────────────────────────────────┘
```

### 12.2 Client Layout (`AgentShell`)

```
┌────────────────────────────────────────────────────────────────┐
│  TopBar (56px)                                                 │
│  ├─ Logo │ Search │ Notifications │ Presence │ Profile        │
├──────────┬──────────────────────────────┬──────────────────────┤
│          │                              │                      │
│ Inbox    │  Conversation Thread         │  Context Panel       │
│ (320px)  │  ┌────────────────────────┐  │  ├─ Customer Profile │
│          │  │ Messages               │  │  ├─ AI Suggestions   │
│          │  │                        │  │  ├─ Internal Notes   │
│          │  │ [Composer]             │  │  └─ Assign/Transfer  │
│          │  └────────────────────────┘  │                      │
│          │                              │                      │
└──────────┴──────────────────────────────┴──────────────────────┘
```

### 12.3 Layout Tokens

```
topbar-height: 64px (dashboard), 56px (client)
sidebar-width: 256px (expanded), 72px (collapsed)
inbox-width: 320px
context-panel-width: 320px
content-max-width: 1440px
page-padding: 24px
```

---

## 13. Theme Architecture

### 13.1 Theme Layers

| Layer | Source | Overrideable |
|-------|--------|-------------|
| Design System Tokens | `@responix/design-system` | No |
| Base Theme (light/dark) | `@responix/design-system/themes` | No |
| Workspace Branding | `GET /api/v1/platform/branding` | Yes (admin) |
| User Preference | localStorage | Yes (user) |

### 13.2 CSS Variable Injection

On app initialization:
1. Load base theme CSS variables.
2. Fetch workspace branding from `/platform/branding`.
3. Override CSS variables for primary, secondary colors.
4. Apply user's light/dark preference via `next-themes`.

### 13.3 Theme Switching

- Toggle in topbar footer.
- Options: Light, Dark, System.
- Persists to localStorage.
- Syncs across tabs via `storage` event listener.

---

## 14. Realtime Abstraction

### 14.1 Design Principle

**No component directly uses `EventSource` or `WebSocket`.** All realtime communication flows through an abstract transport layer.

### 14.2 Transport Interface

```typescript
// packages/state/src/websocket/transport-interface.ts
export interface RealtimeTransport {
  connect(url: string, options?: TransportOptions): void;
  disconnect(): void;
  on(event: string, handler: (payload: unknown) => void): () => void;
  off(event: string, handler: (payload: unknown) => void): void;
  isConnected(): boolean;
  getState(): "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";
}

export interface TransportOptions {
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelayMs?: number;
  backoffMultiplier?: number;
  authToken?: string;
  heartbeatIntervalMs?: number;
}
```

### 14.3 SSE Transport Implementation

```typescript
// packages/state/src/websocket/sse-transport.ts
export class SseTransport implements RealtimeTransport {
  private eventSource: EventSource | null = null;
  private handlers = new Map<string, Set<(payload: unknown) => void>>();
  private reconnectAttempts = 0;
  private state: RealtimeTransport["getState"] extends () => infer R ? R : never = "idle";
  
  connect(url: string, options: TransportOptions = {}) {
    this.eventSource = new EventSource(url, { withCredentials: true });
    this.state = "connecting";
    
    this.eventSource.onopen = () => {
      this.state = "connected";
      this.reconnectAttempts = 0;
    };
    
    this.eventSource.onmessage = (event) => {
      const { type, payload } = JSON.parse(event.data);
      this.handlers.get(type)?.forEach(h => h(payload));
    };
    
    this.eventSource.onerror = () => {
      this.state = "disconnected";
      if (options.reconnect) this.scheduleReconnect(url, options);
    };
  }
  
  private scheduleReconnect(url: string, options: TransportOptions) {
    if (this.reconnectAttempts >= (options.maxReconnectAttempts ?? 10)) return;
    this.state = "reconnecting";
    const delay = (options.reconnectDelayMs ?? 1000) * Math.pow(options.backoffMultiplier ?? 2, this.reconnectAttempts);
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(url, options);
    }, Math.min(delay, 30000));
  }
  
  // ... disconnect, on, off, isConnected, getState
}
```

### 14.4 WebSocket Transport (Future)

A `WsTransport` class implementing the same `RealtimeTransport` interface. Swap transport type without changing consumer code.

### 14.5 Hook API

```typescript
// packages/state/src/hooks/use-realtime.ts
export function useRealtime(event: string, handler: (payload: unknown) => void) {
  const transport = useTransport(); // gets transport from context
  
  useEffect(() => {
    const unsubscribe = transport.on(event, handler);
    return unsubscribe;
  }, [event, handler, transport]);
}
```

### 14.6 Connection Pool

- One transport connection per authenticated session.
- Workspace-scoped event filtering: backend only pushes events for the active workspace.
- Graceful disconnect on page hide (mobile), reconnect on page show.

---

## 15. Caching Strategy

### 15.1 TanStack Query Configuration

```typescript
// packages/state/src/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes
      gcTime: 10 * 60 * 1000,          // 10 minutes
      retry: (failureCount, error) => {
        if (error instanceof NetworkError) return failureCount < 3;
        return false;
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: (failureCount, error) => {
        if (error instanceof NetworkError) return failureCount < 2;
        return false;
      },
    },
  },
});
```

### 15.2 Query Key Hierarchy

```typescript
// Workspace-scoped query keys
["workspaces", workspaceId, "members"]           // member list
["workspaces", workspaceId, "members", memberId]  // single member
["ai", workspaceId, "providers"]                  // AI providers
["ai", workspaceId, "agents"]                     // agents
["channels", workspaceId, "messages"]             // channel messages
["conversations", workspaceId, conversationId]    // conversation
```

### 15.3 Runtime Optimization Integration

The backend `RuntimeOptimizationPackage` caches compiled prompts, rendered outputs, and execution plans by hash. The frontend leverages this by:

1. **Not caching responses**: TanStack Query caches API responses; the backend caches expensive computations.
2. **Cache key awareness**: When the frontend invokes AI, it includes a `requestId` and receives back `cacheHit` metadata. Display cache indicators in the UI.
3. **Invalidation on publish**: When a prompt/agent/workflow is published, invalidate related query keys to force refetch.

### 15.4 Cache Invalidation Rules

| Action | Invalidated Queries |
|--------|-------------------|
| Publish Agent | `["ai", *, "agents"]` + `["ai", *, "agents", agentId]` |
| Update Workspace | `["workspaces", *, "current"]` |
| Send Message | `["conversations", *, *, "messages"]` |
| Create Channel | `["channels", *, "channels"]` |
| Assign Role | `["workspaces", *, "members"]` + `["platform", *, "permissions"]` |

---

## 16. Offline Strategy

### 16.1 Goals

- Drafts survive browser crashes and network loss.
- Optimistic UI shows immediate feedback.
- Automatic sync when connection returns.
- Clear visual indication of offline state.

### 16.2 Offline Detection

```typescript
// packages/state/src/offline/detector.ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  
  return isOnline;
}
```

### 16.3 Optimistic Updates

```typescript
// TanStack Query optimistic update pattern
const mutation = useMutation({
  mutationFn: sendMessage,
  onMutate: async (newMessage) => {
    await queryClient.cancelQueries({ queryKey: ["messages", conversationId] });
    const previous = queryClient.getQueryData(["messages", conversationId]);
    queryClient.setQueryData(["messages", conversationId], (old) => [...old, newMessage]);
    return { previous };
  },
  onError: (err, newMessage, context) => {
    queryClient.setQueryData(["messages", conversationId], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
  },
});
```

### 16.4 Draft Persistence

- **Composer drafts**: Saved to `localStorage` every 2 seconds. Key: `draft:{workspaceId}:{conversationId}`.
- **Form drafts**: Saved to `localStorage`. Key: `form:{workspaceId}:{formId}`.
- **Expiry**: Drafts older than 7 days are auto-purged.

### 16.5 Retry Queue

- Failed mutations are queued in memory + `localStorage`.
- On reconnect, the queue replays in order.
- If a retry fails permanently, the user is notified with a toast + action to retry manually.

### 16.6 Visual Feedback

- **Offline banner**: Sticky top banner: "Working offline. Changes will sync when connection returns."
- **Pending indicators**: Greyed-out items that haven't synced yet.
- **Sync complete**: Brief toast when queue finishes replaying.

---

## 17. Streaming UI Architecture

### 17.1 Streaming Flow

```
User Action → POST /ai/invocations (or streaming endpoint)
           → Backend opens SSE stream
           → Frontend receives StreamChunk DTOs
           → Frontend appends to reactive buffer
           → UI renders partial content incrementally
           → Stream completion → final content persisted
```

### 17.2 Streaming Hook

```typescript
function useStreamingInvocation() {
  const [chunks, setChunks] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "streaming" | "complete" | "error">("idle");
  const abortRef = useRef<AbortController | null>(null);
  
  const invoke = async (request: InvocationRequest) => {
    setStatus("streaming");
    setChunks([]);
    abortRef.current = new AbortController();
    
    const response = await fetch("/api/v1/ai/invocations/stream", {
      method: "POST",
      body: JSON.stringify(request),
      signal: abortRef.current.signal,
      headers: { "Content-Type": "application/json" }
    });
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      // Parse SSE lines
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const chunk = JSON.parse(line.slice(6));
          setChunks(prev => [...prev, chunk.content]);
        }
      }
    }
    
    setStatus("complete");
  };
  
  const cancel = () => abortRef.current?.abort();
  const content = chunks.join("");
  
  return { invoke, cancel, content, status };
}
```

### 17.3 Streaming UI Patterns

- **Typing indicator**: Pulsing cursor while chunks arrive.
- **Incremental render**: Each chunk appends to the message bubble.
- **Markdown streaming**: Parsed and rendered chunk by chunk (careful with partial markdown).
- **Abort action**: Stop button during streaming.
- **Error state**: If stream fails mid-way, show "Generation interrupted" with retry.

---

## 18. Notification Architecture

### 18.1 Sources

| Source | Delivery |
|--------|----------|
| Backend SSE events | Real-time push |
| API responses | Toast on mutation success/failure |
| Browser Notifications | Service Worker push (future) |
| In-app badge | Unread count on sidebar items |

### 18.2 Toast System

- Global toast provider at app root.
- `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()` utility functions.
- RTL: toasts slide from `start` side (left in LTR, right in RTL).
- Stacking: max 5, newest on top.

### 18.3 Notification Center

- Bell icon in topbar opens a dropdown panel.
- Lists recent notifications with timestamps.
- Mark as read / mark all as read.
- Unread badge on bell icon.

### 18.4 Event Types

- `workspace:invitation` — You were invited to a workspace
- `member:role_changed` — Your role was updated
- `ai:invocation_complete` — AI task finished
- `channel:message_received` — New message in channel
- `system:maintenance` — Scheduled maintenance

---

## 19. Error Handling

### 19.1 Error Layers

| Layer | Handler | Action |
|-------|---------|--------|
| API Client | Interceptor | Map HTTP status → typed error |
| TanStack Query | `onError` | Show toast, roll back optimistic |
| React Boundary | `ErrorBoundary` | Show fallback UI, log to telemetry |
| Form | Zod resolver | Field-level error messages |
| Global | `window.onerror` | Log to telemetry, show generic error |

### 19.2 Error Types

```typescript
class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string
  ) {
    super(message);
  }
}

class PermissionDeniedError extends ApiError {
  constructor() { super(403, "PERMISSION_DENIED", "You do not have permission"); }
}

class ValidationError extends ApiError {
  constructor(public fields: Record<string, string[]>) {
    super(400, "VALIDATION_ERROR", "Invalid input");
  }
}

class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, "NOT_FOUND", `${resource} not found`);
  }
}
```

### 19.3 Error UI Patterns

- **Toast**: Non-blocking errors (validation, permission denied on action).
- **Inline**: Form field errors below inputs.
- **Page-level**: Full-page error for route failures (404, 500).
- **Retry**: Network errors show "Retry" button.

### 19.4 React Error Boundaries

- One boundary per major route segment.
- Fallback UI: "Something went wrong" + error code + "Reload page" button.
- Logs error details to telemetry (not user-facing).

---

## 20. Feature Flags

### 20.1 Source of Truth

Feature flags come from `GET /api/v1/platform/current` → `features` array.

### 20.2 Feature Flag Hook

```typescript
function useFeatureFlag(flag: string): boolean {
  const { features } = usePlatform();
  return features.some(f => f.id === flag && f.state === "ENABLED");
}
```

### 20.3 Gating Patterns

| Pattern | Usage |
|---------|-------|
| Route-level | If feature disabled, route renders `<FeatureComingSoon />` |
| Navigation | If feature disabled, nav item hidden |
| Component | `<FeatureGate flag="ai.streaming">{children}</FeatureGate>` |
| API call | If feature disabled, API call not made |

### 20.4 Flag List (Expected)

- `ai.enabled`
- `ai.streaming`
- `whatsapp.enabled`
- `email.enabled`
- `api.enabled`
- `knowledge.enabled`
- `workflows.enabled`
- `analytics.enabled`
- `billing.enabled`

---

## 21. Telemetry

### 21.1 Goals

- Track feature usage without PII.
- Measure performance (page load, API latency).
- Catch errors in production.

### 21.2 Events

| Event | Payload |
|-------|---------|
| `page_view` | route, workspaceId (hashed) |
| `api_request` | endpoint, duration, status, requestId |
| `feature_used` | featureId, action |
| `error_occurred` | errorCode, route, requestId |
| `stream_started` | model, provider |
| `stream_completed` | duration, tokenCount |

### 21.3 Implementation

- Telemetry client in `@responix/shared`.
- Batch events and send every 30 seconds or on page unload.
- Respect `navigator.doNotTrack`.
- No user-identifiable data (emails, names, content).

### 21.4 Performance Monitoring

- Web Vitals (LCP, FID, CLS) collected via `next/web-vitals`.
- API latency tracked per request.
- Reported to backend `/telemetry` endpoint.

---

## 22. Performance Strategy

### 22.1 Code Splitting

- **Route-level**: Every route uses `dynamic()` with `ssr: true` (or `false` for heavy client-only pages).
- **Plugin-level**: Each plugin's main component is lazy-loaded.
- **Component-level**: Heavy components (charts, editors) lazy-loaded.

### 22.2 Bundle Optimization

- Tree-shake all packages (ESM-only).
- Lucide icons imported individually (`import { X } from "lucide-react"`).
- date-fns functions imported individually.
- Bundle analyzer in CI (`@next/bundle-analyzer`).

### 22.3 Image Optimization

- All images via Next.js `<Image>`.
- WebP format preferred.
- Lazy loading below the fold.
- Cloudflare R2 as image CDN.

### 22.4 Font Optimization

- `next/font` for Inter and IBM Plex Sans Arabic.
- `font-display: swap` to prevent FOIT.
- Subset Arabic font to reduce size.

### 22.5 Caching

- Static assets: 1-year cache headers.
- API responses: TanStack Query cache with tuned staleTime.
- Service Worker (future): Cache shell + offline fallback.

### 22.6 Virtualization

- Long lists (conversations, messages, audit logs) use `@tanstack/react-virtual`.
- Tables with >100 rows use virtual scrolling.

### 22.7 Rendering Strategy

| Page Type | Strategy |
|-----------|----------|
| Login | Static + client redirect |
| Dashboard home | SSR (needs auth + manifest) |
| Plugin pages | SSR or streaming SSR |
| Studio builders | Client-side only (React Flow) |
| Client inbox | Client-side only (real-time) |

---

## 23. Testing Strategy

### 23.1 Unit Tests (Vitest)

- **Scope**: Utilities, formatters, hooks (without DOM), API client mappers.
- **Location**: Co-located with source (`Component.test.ts`).
- **Coverage target**: 80% logic coverage.

### 23.2 Component Tests (Testing Library + Vitest)

- **Scope**: Component rendering, user interactions, prop variations.
- **Mocks**: MSW for API calls.
- **RTL**: Every component test verifies RTL rendering by toggling `dir="rtl"`.

### 23.3 Integration Tests (Testing Library)

- **Scope**: Page-level flows (login → navigate → perform action).
- **Router**: Use `next/navigation` mock.

### 23.4 E2E Tests (Playwright)

- **Scope**: Critical user journeys.
- **Journeys**:
  1. Login → select workspace → view dashboard
  2. Create workspace → invite member → accept invitation
  3. Configure AI provider → test routing → run invocation
  4. Create agent → publish agent → verify in list
  5. Client: Login → receive message → reply → verify delivery
- **Browsers**: Chromium, Firefox, WebKit.
- **Mobile**: iPhone 14 viewport.
- **RTL**: Test key flows in RTL mode.

### 23.5 Visual Regression (Chromatic)

- Storybook stories for all shared UI components.
- Baseline on `main` branch.
- PRs trigger Chromatic diff.

### 23.6 Accessibility Tests

- `axe-core` runs in CI on every component test.
- Manual keyboard navigation testing per major feature.

### 23.7 Test File Convention

```
Component.tsx
Component.test.tsx          # Unit + component test
Component.stories.tsx       # Storybook
```

---

## 24. Security Strategy

### 24.1 Authentication Security

- Access token **never** in localStorage. Held in memory only.
- Refresh token in `httpOnly`, `Secure`, `SameSite=Strict` cookie.
- Token refresh on a silent iframe/page background timer.
- Logout revokes server session + clears cookie.

### 24.2 XSS Prevention

- No `dangerouslySetInnerHTML` unless sanitized (DOMPurify for markdown).
- All user content escaped by React by default.
- CSP header (future): `script-src 'self'`.

### 24.3 CSRF Prevention

- Cookie `SameSite=Strict`.
- Custom header `X-Requested-With` on all API calls.

### 24.4 Secret Management

- No API keys in frontend code.
- Environment variables only for public config (API URL, feature flags).
- All secrets stay in backend.

### 24.5 Input Validation

- All forms use Zod schemas (mirroring backend DTO validation).
- Client-side validation before API call.
- File uploads: client-side MIME + size check before sending.

### 24.6 Permission Enforcement

- Frontend gating is **UX-only**. Backend is the authorization authority.
- Never trust frontend permissions for security decisions.

---

## 25. Deployment Strategy

### 25.1 Build Output

- **Dashboard**: Next.js standalone output for Docker.
- **Client**: Next.js standalone output for Docker.
- **Shared packages**: Pre-built before app build.

### 25.2 Docker

```dockerfile
# apps/dashboard/Dockerfile
FROM node:20-alpine AS base
# ... install, build, standalone output
EXPOSE 3000
CMD ["node", "server.js"]
```

### 25.3 Environment Variables

| Variable | Example | Scope |
|----------|---------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.responix.io` | Both apps |
| `NEXT_PUBLIC_APP_NAME` | `Responix Dashboard` | Per app |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `en` | Per app |
| `NEXT_PUBLIC_SUPPORTED_LOCALES` | `en,ar` | Both apps |

### 25.4 CI/CD Pipeline

1. `pnpm install`
2. `pnpm lint` (all packages)
3. `pnpm typecheck` (all packages)
4. `pnpm test:ci` (all packages)
5. `pnpm build` (all packages)
6. Docker build + push
7. Deploy to staging
8. Playwright smoke tests
9. Deploy to production

### 25.5 Health Checks

- Dashboard: `GET /api/health` (Next.js API route returning 200).
- Client: Same pattern.
- Readiness: Check API connectivity.

---


## 26. OpenAPI/SDK Generation

### 26.1 Principle

The frontend **never manually maintains API type definitions**. All request/response DTOs, enums, and path parameters are generated directly from the backend's OpenAPI (Swagger) specification. The backend is the single source of truth for every data shape.

### 26.2 Generation Pipeline

```
Backend Swagger JSON (GET /api/v1/docs-json)
           │
           ▼
    openapi-typescript
           │
           ▼
  packages/types/src/generated/api.d.ts
           │
           ▼
  Re-exported from packages/types/src/api/index.ts
```

### 26.3 Tooling

- **Generator**: `openapi-typescript` (latest stable).
- **Trigger**: CI step on every backend deployment that produces a Swagger artifact.
- **Local fallback**: A checked-in snapshot of the generated types allows offline development. The snapshot is updated automatically when CI detects a Swagger diff.
- **Validation**: A `typecheck:api` script fails the build if the frontend uses a field that no longer exists in the generated contract.

### 26.4 Package Layout

```
packages/types/
├── src/
│   ├── platform/           # Renderer-neutral contracts (EXISTING, untouched)
│   ├── api/                # API DTO types
│   │   ├── generated/
│   │   │   └── api.d.ts    # Auto-generated from Swagger
│   │   └── index.ts        # Re-exports + hand-written convenience unions
│   └── index.ts
```

### 26.5 Manual Overrides

Only **convenience unions** and **frontend-specific derived types** (e.g., `FormState<T>`) may be handwritten. They must compose the generated types, never replace them.

```typescript
// packages/types/src/api/index.ts
import type { components } from "./generated/api";

export type Agent = components["schemas"]["AgentDto"];
export type CreateAgent = components["schemas"]["CreateAgentDto"];
```

### 26.6 Version Pinning

The generated types include a doc-comment with the backend commit hash and API version. If the frontend's generated types drift from the deployed backend, a runtime warning is emitted in development builds.

---

## 27. Form Architecture

### 27.1 Stack

| Concern | Library |
|---------|---------|
| Form state | React Hook Form v7 |
| Validation | Zod v3 |
| Schema mirroring | Backend DTO schemas (via `openapi-typescript` + `zod-openapi`) |
| UI primitives | `@responix/ui` `<Form>` components |

### 27.2 Validation Strategy

- **Synchronous**: All fields validate on `blur` and `submit`.
- **Asynchronous**: Server-side uniqueness checks (e.g., workspace slug) use RHF's `resolver` with a Zod schema that calls a debounced API endpoint.
- **Cross-field**: Conditional validation (e.g., "if provider = OpenAI, API key is required") is expressed as Zod refinements, not imperative logic.

### 27.3 Wizard Forms

Multi-step forms (agent creation, workflow setup, channel onboarding) use a shared `FormWizard` composite:

- **State**: One RHF instance for the entire wizard. Step components receive `control` and `watch`.
- **Navigation**: Step validation gates forward movement. The user can freely navigate backward.
- **Persistence**: Drafts auto-save to `localStorage` every 3 seconds with a `wizard:{formId}:draft` key.
- **Resume**: On remount, the wizard detects a draft and offers "Resume" or "Start over."

### 27.4 Autosave Pattern

```typescript
function useAutosave<T>(form: UseFormReturn<T>, key: string, delay = 3000) {
  const values = form.watch();
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(values));
    }, delay);
    return () => clearTimeout(timer);
  }, [values, key, delay]);
}
```

### 27.5 Error Display

- Field errors appear below inputs with `aria-invalid="true"` and `aria-describedby` linking to the error message.
- Form-level errors (e.g., "This name is already taken") render as a top-level `<Alert>`.
- Server errors map to fields via the API's `fieldErrors` payload.

---

## 28. Command Palette

### 28.1 Design

A global `Cmd/Ctrl+K` command palette provides instant navigation and action execution across every plugin. It is the primary power-user interface.

### 28.2 Architecture

```
CommandPaletteProvider (Zustand store)
    │
    ├── Static Commands (registered at build time)
    │   ├── Navigation: "Go to Agent Studio", "Go to Workflow Studio"
    │   ├── Actions: "Create workspace", "Invite member"
    │   └── Settings: "Toggle dark mode", "Switch language"
    │
    └── Dynamic Commands (fetched at runtime)
        ├── Recent items: "Open Agent 'Support Bot'"
        ├── Workspace-specific: "Switch to Workspace X"
        └── Plugin-contributed: each plugin registers its own commands
```

### 28.3 Plugin Extensibility

Every plugin exposes a `commands` array in its manifest:

```typescript
interface PluginCommand {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string[];
  action: () => void;
  predicate?: () => boolean; // permission or feature-flag gate
}
```

### 28.4 Ranking & Search

- **Fuzzy search**: `fuse.js` or `fast-fuzzy` ranks commands by relevance.
- **Recency boost**: Recently used commands rank higher.
- **Contextual filtering**: Commands gated by current route or permission are hidden, not just disabled.

### 28.5 UI

- Built on `@responix/ui` `<Command>` composite (shadcn Command).
- Grouped by category: Navigation, Actions, Recent, Plugin-specific.
- Keyboard navigation: `↑↓` to navigate, `Enter` to execute, `Esc` to close.
- RTL: Search input and results list flow in the active direction.

---

## 29. Global Search

### 29.1 Scope

Global search is **not** the command palette. It is a dedicated full-text search interface (`Cmd/Ctrl+Shift+K` or topbar search input) that searches **content**, not just commands.

### 29.2 Search Categories

| Category | Source | Display |
|----------|--------|---------|
| Agents | `GET /api/v1/ai/agents` | Name + description |
| Prompts | `GET /api/v1/ai/prompts` | Name + category |
| Workflows | `GET /api/v1/studio/workflows` | Name + status |
| Knowledge | `GET /api/v1/knowledge/documents` | Title + excerpt |
| Conversations | `GET /api/v1/conversations` | Contact name + last message |
| Members | `GET /api/v1/workspaces/members` | Name + email + role |

### 29.3 Ranking

1. **Exact match** (name starts with query) → top.
2. **Substring match** (name contains query) → next.
3. **Fuzzy match** → lower.
4. **Recency** (last updated) → tiebreaker.

### 29.4 Keyboard Navigation

- `↑↓` navigates results.
- `Enter` opens the selected item.
- `Tab` cycles through categories.
- `Esc` closes search.

### 29.5 Semantic Search (Future-Ready)

The search architecture is designed to accept a vector/semantic backend:
- Results are rendered via the same `<SearchResultCard>` component.
- A `confidence` score field is reserved in the result type.
- The API client supports a `?semantic=true` query parameter.

### 29.6 Implementation

- **Frontend**: Debounced input (300ms), TanStack Query with `staleTime: 0`.
- **Backend**: Aggregates multiple endpoints or a unified search endpoint (future).
- **Empty state**: "No results for 'query'. Try searching in [Category]."

---

## 30. Keyboard Shortcut System

### 30.1 Architecture

A global shortcut manager (`packages/ui/src/shortcuts`) registers and resolves shortcuts without hardcoding them in components.

```typescript
// Shortcut registration
registerShortcut({
  id: "global.search",
  keys: ["Ctrl", "Shift", "K"],
  action: () => openGlobalSearch(),
  scope: "global",
  preventDefault: true,
});
```

### 30.2 Scopes

| Scope | Description |
|-------|-------------|
| `global` | Active everywhere |
| `plugin:{id}` | Active only when plugin route is mounted |
| `modal` | Active only when a specific modal is open |
| `input` | Disabled when any text input is focused |

### 30.3 Conflict Resolution

- More specific scopes override less specific ones.
- If two shortcuts in the same scope share keys, the most recently registered wins (with a console warning in development).
- Duplicate detection runs at build time.

### 30.4 Future Customization

The shortcut system stores a user-overrides map in `localStorage`:

```typescript
// localStorage key: keyboard-shortcuts
{
  "global.search": ["Ctrl", "K"],
  "agent.create": ["Ctrl", "Shift", "A"]
}
```

A future "Keyboard Settings" page will allow users to remap shortcuts. The system validates that remapped shortcuts do not conflict within the same scope.

### 30.5 Discovery

- Shortcuts are displayed in tooltips next to menu items.
- The Command Palette shows the shortcut next to each command.
- A `?` help modal lists all shortcuts for the current scope.

### 30.6 RTL Considerations

Shortcuts use physical keys, not logical directions. `Ctrl+ArrowLeft` is always the physical left arrow, regardless of text direction. Labels display as-is.

---

## 31. Widget SDK

### 31.1 Purpose

Widgets are embeddable, self-contained UI units that plugins register to appear on the main Dashboard page or in side panels. The Widget SDK defines their lifecycle, configuration, and rendering contract.

### 31.2 Widget Contract

```typescript
interface DashboardWidget {
  id: string;
  pluginId: string;
  name: string;
  permissions: string[];
  defaultSize: { w: number; h: number }; // grid units
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
  component: ComponentType<WidgetProps>;
  configSchema?: z.ZodObject<any>; // runtime config form
}

interface WidgetProps {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
  isEditing: boolean;
}
```

### 31.3 Lifecycle

1. **Registration**: Plugin registers widgets in its manifest.
2. **Discovery**: Dashboard queries the manifest and lists available widgets.
3. **Placement**: User adds a widget to their dashboard layout.
4. **Configuration**: User opens widget settings; a form is auto-generated from `configSchema`.
5. **Rendering**: Widget renders with its resolved `config`.
6. **Cleanup**: On removal, the widget's `onUnmount` (if provided) runs.

### 31.4 Permissions

Widgets are filtered by the same permission system as plugins. If a user loses a permission, the widget disappears from their dashboard with a toast: "Widget removed due to permission change."

### 31.5 Manifest Integration

```typescript
// In plugin.manifest.ts
export const myPlugin: DashboardPlugin = {
  id: "analytics",
  // ...
  widgets: [
    {
      id: "analytics.token-usage",
      name: "Token Usage",
      defaultSize: { w: 6, h: 4 },
      component: lazy(() => import("./widgets/TokenUsageWidget")),
      configSchema: z.object({
        period: z.enum(["7d", "30d", "90d"]).default("7d"),
        provider: z.string().optional(),
      }),
    },
  ],
};
```

---

## 32. User Layout Persistence

### 32.1 Scope

Every user can personalize their Dashboard layout. Persisted state survives logout, browser restarts, and cross-device sessions (via backend storage, not just localStorage).

### 32.2 Persisted Elements

| Element | Storage | Key |
|---------|---------|-----|
| Sidebar collapsed/expanded | Backend user prefs | `sidebar.collapsed` |
| Sidebar width (if resizable) | Backend user prefs | `sidebar.width` |
| Widget positions (dashboard grid) | Backend user prefs | `dashboard.widgets` |
| Panel sizes (split panes) | Backend user prefs | `panels.{id}.size` |
| Active tabs | localStorage (ephemeral) | `tabs:{workspaceId}:{route}` |
| Table filters | localStorage | `filters:{workspaceId}:{tableId}` |
| Table column visibility | localStorage | `columns:{workspaceId}:{tableId}` |

### 32.3 Saved Layouts

Power users can save **multiple named layouts**:

```typescript
interface SavedLayout {
  id: string;
  name: string;
  isDefault: boolean;
  widgets: Array<{ widgetId: string; x: number; y: number; w: number; h: number; config: object }>;
  sidebar: { collapsed: boolean; width: number };
  panels: Record<string, { size: number }>;
}
```

- Layouts are scoped to the workspace.
- The user can switch layouts from a dropdown in the dashboard header.
- An "Admin default" layout is provided per workspace; users start from it and customize.

### 32.4 Sync Strategy

- **Optimistic**: Changes apply immediately in the UI.
- **Debounced save**: POST to `/api/v1/platform/preferences` 2 seconds after the last change.
- **Conflict resolution**: Last-write-wins. A version timestamp prevents stale overwrites.
- **Hydration**: On app bootstrap, user preferences are fetched alongside the platform manifest.

### 32.5 Reset

Every personalized view has a "Reset to default" action that restores the workspace admin's default layout.

---

## 33. Accessibility Target

### 33.1 Official Target: WCAG 2.1 AA

This is a contractual requirement, not an aspiration. Every component, page, and interaction must meet or exceed WCAG 2.1 Level AA.

### 33.2 Focus Management

- **Focus trap**: All modals, drawers, and dialogs trap focus. `Tab` cycles within the container; `Shift+Tab` reverses.
- **Focus restoration**: When a modal closes, focus returns to the element that opened it.
- **Focus indicators**: Every focusable element has a visible 2px ring with 2px offset. No element is focusable without a visual indicator.
- **Skip links**: "Skip to main content" and "Skip to navigation" links are the first focusable elements on every page.

### 33.3 Screen Readers

- **Landmarks**: `<main>`, `<nav>`, `<aside>`, `<header>` are used consistently.
- **Headings**: Pages have a single `<h1>`; heading hierarchy is never skipped.
- **Live regions**: `aria-live="polite"` for toast notifications; `aria-live="assertive"` for critical errors.
- **Labels**: Every `<input>` has an associated `<label>` or `aria-label`.
- **Descriptions**: Complex fields use `aria-describedby` to link to helper text.
- **Roles**: Custom widgets (tabs, accordion, tree) use correct ARIA roles and states.

### 33.4 RTL Accessibility

- Screen readers must read content in the correct DOM order, which matches the visual order in both LTR and RTL.
- `aria-orientation` is set on horizontal tab lists and sliders.
- Arabic content uses `lang="ar"` on text containers.

### 33.5 Motion Reduction

- `prefers-reduced-motion` disables:
  - Page transitions
  - Skeleton pulse animations (static placeholder instead)
  - Toast slide-in (fade only)
  - Modal scale-in (fade only)
  - Streaming cursor blink (static cursor)
- Essential motion (progress indicators, real-time status changes) remains.

### 33.6 Testing Requirements

- `axe-core` runs in every component test and E2E test.
- Manual keyboard-only navigation tests are performed per sprint.
- Screen reader smoke tests (NVDA/VoiceOver) are performed before each release.

---

## 34. Motion System

### 34.1 Principle

All motion is token-driven. **No arbitrary animations** are permitted. Every animation uses a token from `@responix/design-system`.

### 34.2 Tokens

```typescript
// packages/design-system/src/tokens/motion.ts
export const motionTokens = {
  duration: {
    instant: "0ms",
    fast: "100ms",
    normal: "200ms",
    slow: "300ms",
    slower: "500ms",
  },
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",   // ease-in-out
    enter: "cubic-bezier(0, 0, 0.2, 1)",        // ease-out
    exit: "cubic-bezier(0.4, 0, 1, 1)",         // ease-in
    bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;
```

### 34.3 Animation Categories

| Category | Token | Usage |
|----------|-------|-------|
| Enter | `duration.normal` + `easing.enter` | Page transitions, modals, toasts |
| Exit | `duration.fast` + `easing.exit` | Dismissing modals, toasts, dropdowns |
| Hover | `duration.fast` + `easing.default` | Button/color state changes |
| Loading | `duration.slow` + `easing.default` | Skeleton pulse, spinner |
| Streaming | `duration.instant` | Cursor blink, chunk append |

### 34.4 Implementation

- Use CSS transitions and keyframes exclusively. No JavaScript animation libraries (GSAP, Framer Motion) in the core UI.
- React state changes that need animation use Tailwind's `transition` utilities with token values.
- `@media (prefers-reduced-motion: reduce)` forces all transitions to `0ms`.

### 34.5 Streaming-Specific Motion

- The streaming cursor blinks at 530ms (CSS animation).
- New chunks append without scroll-jump; the view auto-scrolls only if the user is already at the bottom.
- Tool-call cards expand with `duration.normal` + `easing.enter`.

---

## 35. Frontend Error Architecture

### 35.1 Error Categories

| Category | Code Prefix | Example |
|----------|------------|---------|
| Network | `NET_` | `NET_TIMEOUT`, `NET_OFFLINE` |
| API | `API_` | `API_400`, `API_403`, `API_500` |
| Validation | `VAL_` | `VAL_REQUIRED`, `VAL_FORMAT` |
| Permission | `PERM_` | `PERM_DENIED` |
| Runtime | `RUN_` | `RUN_UNKNOWN`, `RUN_STREAM_ABORT` |
| Fatal | `FATAL_` | `FATAL_BOUNDARY` |

### 35.2 Error Codes

Every error carries a machine-readable code:

```typescript
interface FrontendError {
  code: string;
  category: "network" | "api" | "validation" | "permission" | "runtime" | "fatal";
  message: string;           // User-facing, i18n key
  detail?: string;           // Technical detail for dev mode
  requestId?: string;        // Backend trace ID
  recoverable: boolean;      // Can the user retry?
  retry?: () => void;        // Retry function if recoverable
}
```

### 35.3 Error Boundaries

- **Global boundary**: Wraps the entire app. Catches fatal errors. Shows "Something went wrong" with error code and reload button.
- **Route boundary**: Wraps each major route. Catches plugin-level errors. Shows plugin-specific fallback with "Go back" action.
- **Component boundary**: Wraps complex components (charts, editors). Shows inline fallback.

### 35.4 Recovery Patterns

| Error | UX | Action |
|-------|-----|--------|
| Network timeout | Toast + inline retry button | Auto-retry 2x, then manual |
| 403 Permission | Toast + hide action | Redirect to authorized page |
| 500 Server | Toast + error code | Report to telemetry |
| Validation | Inline field errors | None (user corrects) |
| Stream abort | Inline "Generation stopped" | Allow re-invoke |
| Fatal | Full-page fallback | Reload page |

### 35.5 User Messages

All user-facing error messages are i18n keys, not hardcoded strings:

```json
{
  "error.api.403": "You don't have permission to perform this action.",
  "error.net.timeout": "The server is taking too long to respond. Please try again.",
  "error.fallback.title": "Something went wrong",
  "error.fallback.description": "We've logged this error. Please reload the page or contact support."
}
```

### 35.6 Logging

- **Development**: Full stack traces to console.
- **Production**: Errors sent to telemetry with code, route, requestId, and hashed user ID. No PII.

---

## 36. API Version Compatibility

### 36.1 Version Detection

The frontend detects the backend API version from two sources:
1. **Build-time**: The Swagger JSON used to generate types includes `info.version`.
2. **Runtime**: `GET /api/v1/platform/current` returns `apiVersion`.

### 36.2 Compatibility Matrix

```typescript
// packages/api-client/src/version.ts
const SUPPORTED_API_VERSIONS = ["1.0.0", "1.1.0"];

export function checkApiCompatibility(serverVersion: string): "ok" | "deprecated" | "breaking" {
  // semver comparison
}
```

| Result | Behavior |
|--------|----------|
| `ok` | Normal operation |
| `deprecated` | Console warning; toast once per session: "A new version is available. Reload to update." |
| `breaking` | Modal blocking UI: "This app version is incompatible. Please reload." |

### 36.3 Deprecation Strategy

- The backend marks deprecated fields in Swagger with `x-deprecated`.
- The frontend type generator emits `@deprecated` JSDoc tags.
- CI linting (`eslint-plugin-deprecation`) fails builds if deprecated fields are used in new code.
- A grace period of 2 sprints is given before breaking changes are enforced.

### 36.4 Breaking Change Handling

- If a breaking change is unavoidable, the frontend ships a new version.
- The old frontend version is kept deployable for 1 week (blue/green).
- Users on stale frontends see the `breaking` modal and must reload.

---

## 37. Dashboard Manifest Cache

### 37.1 Purpose

The dashboard manifest (`GET /api/v1/dashboard-runtime/bootstrap`) is fetched on every app initialization. Caching it correctly improves startup time and offline resilience.

### 37.2 Cache Strategy

| Layer | TTL | Invalidation |
|-------|-----|-------------|
| HTTP cache (CDN) | 5 minutes | `Cache-Control: max-age=300` |
| TanStack Query cache | 10 minutes | Background refetch on mount |
| localStorage snapshot | 24 hours | Used only if API is unreachable |

### 37.3 Startup Flow

```
App mounts
    │
    ├── Try: Fetch manifest from API
    │   ├── Success → Cache in TQuery + localStorage → Render
    │   └── Failure →
    │       ├── localStorage snapshot exists AND < 24h → Render from snapshot
    │       └── No snapshot → Show offline fallback with retry
    │
    └── In background: Re-fetch permissions + features
```

### 37.4 Invalidation Triggers

- User performs an action that changes platform config (role change, feature toggle) → invalidate manifest cache.
- Admin publishes a new plugin version → invalidate manifest cache.
- SSE event `manifest:updated` → immediate refetch.

### 37.5 Offline Behavior

- If the app starts offline and a cached manifest exists, the dashboard renders in "read-only" mode.
- Mutations are queued and show pending states.
- A banner: "Working offline. Some features may be unavailable."

### 37.6 Startup Optimization

- The manifest fetch and the auth bootstrap happen in parallel.
- The `<AppShell>` skeleton renders while both resolve.
- First Contentful Paint target: < 1.5s on a 3G connection.

---

## 38. AI UI Component Library

### 38.1 Purpose

AI interactions require specialized UI patterns that are not part of standard component libraries. These components live in `packages/ui/src/ai/` and are used by both Dashboard and Client.

### 38.2 Component Inventory

| Component | Purpose |
|-----------|---------|
| `<StreamingMarkdown>` | Renders markdown incrementally as chunks arrive. Handles partial tokens gracefully. |
| `<ThinkingIndicator>` | Animated "thinking" state shown while the backend prepares a response. |
| `<ToolCallCard>` | Expandable card showing a tool execution: name, parameters, status (running/success/error), and output. |
| `<WorkflowCard>` | Displays a workflow step in the conversation stream with status and branch info. |
| `<CitationCard>` | Renders a source citation with excerpt, source title, and confidence score. |
| `<ConfidenceBadge>` | Visual indicator (low/medium/high) of AI response confidence. |
| `<RetryAction>` | Button group offering "Retry", "Regenerate", and "Edit prompt" on failed AI responses. |
| `<AbortButton>` | Stop button for in-flight streaming. Becomes disabled after abort. |
| `<AIMessageBubble>` | Message container optimized for AI content: markdown, tool cards, citations, streaming cursor. |
| `<HumanMessageBubble>` | User message container with edit/delete actions. |
| `<SystemMessage>` | Internal/system message styled distinctly (subtle, non-interactive). |

### 38.3 Streaming Markdown Behavior

- Parses markdown incrementally without re-rendering the entire document.
- Partial code blocks show a "copy" button only when complete.
- Tables render only when all rows are received.
- Links are clickable only when the URL is complete.

### 38.4 Tool Call Visualization

```
┌─────────────────────────────────────────────┐
│ 🔧 search_knowledge_base          ▼        │
│ Parameters:                                  │
│   query: "refund policy"                     │
│ Status: ✅ Completed in 0.4s                 │
│ Output: 3 documents found                    │
└─────────────────────────────────────────────┘
```

- Running tools show a spinner and elapsed time.
- Failed tools show error details with "Retry tool" action.
- The user can expand/collapse tool details.

---

## 39. Charting Standard

### 39.1 Selected Library: Recharts

**Justification:**
- **Tremor** provides dashboard layout primitives but is limited in chart customization.
- **Recharts** is composable, React-native, and allows deep customization of axes, tooltips, and legends.
- We use Tremor's layout wrappers (`Card`, `Grid`) + Recharts for the actual chart rendering.
- Single library reduces bundle size and learning curve.

### 39.2 Supported Chart Types

| Type | Usage | Component |
|------|-------|-----------|
| Line | Trends over time (token usage, message volume) | `<LineChart>` |
| Bar | Comparisons (cost by provider, requests by model) | `<BarChart>` |
| Area | Cumulative metrics (total conversations) | `<AreaChart>` |
| Pie/Donut | Proportions (cost breakdown %) | `<PieChart>` |
| Stacked Bar | Multi-series comparison | `<BarChart stacked>` |
| Sparkline | Inline mini-trends (table cells, cards) | `<Sparkline>` |

### 39.3 Token Integration

All charts consume CSS variables for colors:
- `var(--chart-1)` through `var(--chart-5)` for data series.
- `var(--color-muted-foreground)` for axis labels.
- `var(--color-border)` for grid lines.

### 39.4 Accessibility

- Every chart has an `aria-label` describing what it shows.
- A visually hidden data table (`<table className="sr-only">`) provides the raw data for screen readers.
- Tooltips are keyboard-accessible.

### 39.5 RTL

- X-axis labels and legend order follow text direction.
- Bar charts start from the correct edge.
- Tooltips position correctly in RTL.

---

## 40. Rich Text Editor

### 40.1 Selected Architecture: Tiptap (ProseMirror-based)

**Justification:**
- **Tiptap** is headless, fully customizable, and has excellent React integration.
- It supports markdown input/output via extensions.
- Mention/suggestion systems are first-class extensions.
- Slash commands are achievable via custom extensions.
- It is lighter than Slate or CKEditor and more battle-tested than Novel.

### 40.2 Features

| Feature | Extension |
|---------|-----------|
| Bold, italic, code, headings | `@tiptap/starter-kit` |
| Lists (ordered, unordered) | `@tiptap/extension-list-item` |
| Mentions (`@user`, `#ticket`) | `@tiptap/extension-mention` |
| Slash commands (`/prompt`, `/template`) | Custom extension |
| AI insertion | Custom node: `<ai-insertion>` |
| Attachments | Custom node: `<file-attachment>` |
| Markdown paste | `@tiptap/extension-markdown` |
| Placeholder | `@tiptap/extension-placeholder` |

### 40.3 Mention System

- Typing `@` triggers a dropdown with users, agents, or workflows.
- Typing `#` triggers a dropdown with tickets, conversations, or knowledge articles.
- Mentions are stored as structured nodes, not plain text.

### 40.4 Slash Commands

| Command | Action |
|---------|--------|
| `/prompt [name]` | Insert a saved prompt |
| `/template [name]` | Insert a WhatsApp message template |
| `/ai` | Trigger AI draft generation inline |
| `/note` | Convert current block to an internal note |

### 40.5 AI Insertion

When the AI generates a draft, it is rendered as a ghost block in the editor. The user can:
- **Accept**: Replace current content with the draft.
- **Reject**: Remove the ghost block.
- **Edit**: The ghost block becomes editable before acceptance.

### 40.6 Markdown

- The editor stores content as ProseMirror JSON.
- On submit, it serializes to markdown if the channel requires it (WhatsApp).
- On paste, markdown is parsed into the editor's document model.

---

## 41. Data Grid Standard

### 41.1 Selected Solution: TanStack Table v8 + `@tanstack/react-virtual`

**Justification:**
- Already in the tech stack. No additional dependency.
- Headless: full control over rendering (crucial for RTL and theming).
- Virtualization, server-side pagination, sorting, filtering, column resizing, row selection, and bulk actions are all supported.

### 41.2 Required Features

| Feature | Implementation |
|---------|---------------|
| Virtual scrolling | `@tanstack/react-virtual` for >100 rows |
| Server pagination | Manual pagination mode + `pageCount` from API |
| Server sorting | `onSortingChange` → invalidate query |
| Server filtering | `onColumnFiltersChange` → debounced API call |
| Column visibility | `columnVisibility` state + dropdown menu |
| Row selection | Checkbox column + `rowSelection` state |
| Bulk actions | Action bar appears when `rowSelection` is non-empty |
| Column resizing | `enableColumnResizing` + `columnResizeMode="onEnd"` |
| CSV export | Client-side export for small tables; server-side for large |

### 41.3 Performance

- Server-side everything: pagination, sorting, filtering. The frontend does not load full datasets.
- Default page size: 25 rows.
- Virtual scrolling activates automatically when the table height exceeds 500px.

### 41.4 Bulk Actions

When rows are selected:
1. A sticky action bar appears above or below the table.
2. Actions are permission-gated (e.g., "Delete" requires `workspace.members.manage`).
3. Confirm modal for destructive actions.
4. Optimistic update: selected rows are marked pending; on success, they are removed.

### 41.5 RTL

- Column resize handles align to `end`.
- Sort indicator direction flips for descending.
- Checkbox column anchors to `start`.
- Bulk action bar flows in the active text direction.

---

## 42. File Upload Architecture

### 42.1 Upload Flow

```
User selects file(s)
    │
    ▼
Client-side validation (size, type, extension)
    │
    ▼
Request pre-signed upload URL from backend
    │
    ▼
Chunked upload to storage (S3/R2) with resumable progress
    │
    ▼
Backend confirms upload completion → virus scan → index
    │
    ▼
Frontend receives file metadata → renders preview
```

### 42.2 Chunk Upload

- Chunk size: 5MB (configurable).
- Concurrent chunks: 3 (configurable).
- Resume: Track uploaded chunks in `localStorage` with `upload:{fileId}:chunks`.
- Retry: Exponential backoff on failed chunks. Max 5 retries per chunk.
- Cancel: AbortController cancels in-flight chunks.

### 42.3 Progress & Preview

- **Progress**: Individual file progress bar + overall batch progress.
- **Preview**: Images render a thumbnail via `URL.createObjectURL`. Documents show an icon + file name.
- **Validation errors**: Inline error per file (too large, wrong type).

### 42.4 Validation

| Check | Frontend | Backend |
|-------|----------|---------|
| File size | Hard limit (e.g., 50MB) | Enforced |
| MIME type | Whitelist | Enforced |
| Extension | Whitelist | Enforced |
| Virus scan | N/A | Required before availability |

### 42.5 Storage Abstraction

The frontend does not know the storage provider. It only communicates with the backend API:

```typescript
// packages/api-client/src/resources/files.ts
async function requestUploadUrl(file: File): Promise<{ uploadUrl: string; fileId: string }>;
async function confirmUpload(fileId: string): Promise<void>;
async function getFile(fileId: string): Promise<FileMetadata>;
```

### 42.6 Drag & Drop

- Drop zone highlights on drag-over.
- Multiple files supported.
- Dropped folders are flattened (if supported by browser).
- Mobile: File picker triggered by tap.

---

## 43. AI User Experience Guidelines

### 43.1 Streaming Response UX

- **Instant feedback**: The UI shows a thinking indicator within 200ms of the user action.
- **Progressive disclosure**: Content appears word-by-word, not sentence-by-sentence.
- **No layout shift**: The message container reserves estimated height; content grows downward.
- **Auto-scroll**: Only if the user is already at the bottom. If the user scrolls up, auto-scroll pauses.
- **Cursor**: A blinking cursor (`▍`) follows the last chunk. Disappears on completion.

### 43.2 Tool Execution Visualization

- Tools are shown as cards in the message stream, not hidden.
- Running tools show elapsed time and a spinner.
- Completed tools show a checkmark and collapsible output.
- Failed tools show an error with a retry action.

### 43.3 Citations

- AI responses that use knowledge base documents include inline citation markers (`[1]`, `[2]`).
- Hovering a marker shows a tooltip with the source title and excerpt.
- Clicking a marker opens the source document in a side panel.
- Citations are numbered sequentially within a message.

### 43.4 Confidence Indicators

- When the AI is uncertain, a subtle badge appears: "Low confidence — verify this information."
- Confidence is backend-derived and passed in the stream metadata.

### 43.5 Retry & Cancellation

- **Cancel**: Available during streaming. Stops the stream immediately. The partial content remains.
- **Retry**: Available after completion or error. Resends the same request with an incremented attempt counter.
- **Regenerate**: Available after completion. Sends a variation request (e.g., `temperature` adjusted).

### 43.6 Background Execution

- Long-running AI workflows (batch processing, knowledge indexing) run in the background.
- The user receives a toast: "Task started. You'll be notified when complete."
- A "Background Tasks" panel (in the topbar) shows running and completed tasks with progress bars.
- On completion, a toast with a link to the result appears.

### 43.7 Long-Running Workflows

- Workflows that exceed 10 seconds show a progress indicator in the UI.
- The user can navigate away; the workflow continues server-side.
- On return, the workflow status is fetched and displayed.
- Failed workflows show which node failed and why, with a "Resume from here" action.

---

## 44. Dashboard Sprint Roadmap

> **Total Estimated Sprints:** 14 frontend sprints for Dashboard to reach production quality.

---

### Sprint F1: Foundation & Tooling

**Goal:** Establish the monorepo foundation. All packages created. Tooling configured.

**Scope:**
- Create `apps/client/` skeleton (empty, not built yet).
- Create all 4 new shared packages with build configs.
- Configure Turborepo pipeline for new packages.
- Set up Vitest, Testing Library, Storybook, Playwright.
- Configure Tailwind v4 with design system tokens.
- Set up `next-intl` in Dashboard with English + Arabic message files.
- Configure RTL support in Tailwind (logical properties).

**Modules:** `packages/api-client`, `packages/auth`, `packages/state`, `packages/ui`, `packages/design-system`, `packages/shared`

**Deliverables:**
- All 7 packages build successfully (`pnpm build` passes).
- `packages/ui` has 5+ primitive components working in Storybook.
- `packages/design-system` emits correct CSS variables.
- Dashboard app renders a localized "Hello World" in both EN and AR.
- RTL toggle works and flips layout.

**Dependencies:** None.

**Validation:** `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck` pass for all packages.

**Exit Criteria:** CI pipeline green. All packages build. i18n + RTL demonstrable.

---

### Sprint F2: Authentication & Tenant Context

**Goal:** Complete authentication flow and tenant context establishment.

**Scope:**
- Implement `@responix/auth` with token management, refresh, session parsing.
- Build Dashboard login page with workspace selection.
- Implement silent refresh timer.
- Implement logout with session revocation.
- Build `AuthProvider` + `TenantProvider` context hierarchy.
- Implement middleware for auth redirect + i18n routing.
- Build `WorkspaceSwitcher` component.

**Modules:** `packages/auth`, `apps/dashboard/(auth)`, `apps/dashboard/(app)/layout`

**Deliverables:**
- User can log in, select workspace, and land on dashboard.
- Token refresh happens transparently.
- Logout clears session and redirects to login.
- Workspace switcher shows available workspaces.
- Unauthenticated users are redirected to `/login`.

**Dependencies:** Sprint F1.

**Validation:** Playwright E2E test: login → workspace selection → dashboard.

**Exit Criteria:** Auth flow complete and tested. No manual token management needed.

---

### Sprint F3: API Client, State Layer & Platform Bootstrap

**Goal:** API communication layer complete. Dashboard consumes platform manifest.

**Scope:**
- Build `@responix/api-client` with all resource modules.
- Implement request/response interceptors (auth, error, retry, locale).
- Build `@responix/state` with QueryClient, realtime transport abstraction.
- Implement SSE transport with reconnect logic.
- Dashboard calls `GET /api/v1/dashboard-runtime/bootstrap` on mount.
- Dashboard calls `GET /api/v1/platform/current` to resolve permissions.
- Build `AppShell` layout (sidebar + topbar + main).
- Build dynamic navigation from platform manifest + plugin registry.
- Implement OpenAPI type generation pipeline.

**Modules:** `packages/api-client`, `packages/state`, `apps/dashboard/src/components/app-shell`, `apps/dashboard/src/plugins`

**Deliverables:**
- API client can call all major endpoints successfully.
- OpenAPI types generate and typecheck correctly.
- Dashboard renders sidebar navigation dynamically from manifest.
- Navigation items are permission-filtered.
- Active workspace context available throughout app.
- Realtime transport connects and stays alive.

**Dependencies:** Sprint F2.

**Validation:** E2E: login → sidebar renders → navigate to platform → permissions resolved.

**Exit Criteria:** All major API endpoints callable. Navigation is dynamic and permission-gated. Types are generated.

---

### Sprint F4: Design System Completion & UI Components

**Goal:** Complete design system. All primitives, composites, and AI components built.

**Scope:**
- Build all shadcn/ui primitives in `@responix/ui`.
- Build composite components: DataTable, FormBuilder, SearchCommand, EmptyState, LoadingState.
- Build AI components: StreamingMarkdown, ThinkingIndicator, ToolCallCard, AIMessageBubble.
- Implement dark mode toggle.
- Implement all animation/motion tokens.
- Build toast system.
- Build modal/dialog system.
- Build command palette skeleton.
- Verify all components in Storybook with both EN and AR, light and dark.
- Verify RTL behavior on all directional components.

**Modules:** `packages/ui`, `packages/design-system`

**Deliverables:**
- 25+ primitive components in Storybook.
- 5+ composite components.
- 4+ AI-specific components.
- Dark mode works across all components.
- RTL verified on all components.
- Toast and modal systems functional.
- Command palette renders and searches static commands.

**Dependencies:** Sprint F1.

**Validation:** Chromatic visual regression baselines established. Accessibility audit passed.

**Exit Criteria:** Component library is complete and documented. All variants tested.

---

### Sprint F5: Workspace Management Plugin

**Goal:** First complete plugin. Workspace CRUD, members, invitations.

**Scope:**
- Build `workspaces` plugin.
- Workspace list page.
- Workspace create form (with validation).
- Workspace settings (update, suspend, archive, restore, delete).
- Members list with role display.
- Invite member flow.
- Accept/reject invitation (handled in auth but linked here).
- Member actions (suspend, restore, remove, update role).
- Implement form wizard for workspace creation.

**Modules:** `apps/dashboard/src/plugins/workspaces`, `apps/dashboard/src/plugins/members`

**Deliverables:**
- Workspace CRUD fully functional.
- Member invitation lifecycle works end-to-end.
- All workspace lifecycle operations (suspend, archive, restore) work.
- Permission gating applied.
- Form validation works with async checks.

**Dependencies:** Sprint F3.

**Validation:** E2E: create workspace → invite member → accept → update role → suspend.

**Exit Criteria:** Workspace plugin is feature-complete and tested.

---

### Sprint F6: Platform Control Plugin

**Goal:** Platform configuration: permissions, roles, branding, features.

**Scope:**
- Build `platform` plugin.
- Platform overview page (permissions, features, license, branding, manifest).
- Role CRUD page.
- Permission matrix UI (grant/revoke per role).
- Workspace permission overrides.
- User permission overrides.
- Branding configuration (colors, logo).
- Feature flag toggles.
- Manifest viewer.
- Implement global search (static commands).
- Implement keyboard shortcut registration system.

**Modules:** `apps/dashboard/src/plugins/platform`

**Deliverables:**
- Roles can be created, edited, deleted.
- Permissions assigned/revoked from roles.
- Branding changes reflect immediately in UI.
- Feature flags toggle on/off.
- Manifest is viewable as JSON tree.
- Global search navigates to any plugin page.
- Keyboard shortcuts are discoverable.

**Dependencies:** Sprint F5.

**Validation:** E2E: create role → assign permissions → verify navigation updates.

**Exit Criteria:** Platform plugin complete. RBAC management fully functional. Search and shortcuts operational.

---

### Sprint F7: AI Studio Suite (Providers, Routing, Prompts)

**Goal:** AI provider configuration, routing visualization, and prompt library.

**Scope:**
- Build `ai-providers` plugin.
  - Provider discovery list.
  - Credential management (masked display, add, test).
  - Model list per provider.
  - Provider health status display.
- Build `ai-routing` plugin.
  - Routing resolution test UI.
  - Display routing decision factors.
  - Show ordered fallback list.
- Build `ai-prompts` plugin.
  - Prompt list with search/filter.
  - Prompt create/edit form with variable definition.
  - Draft/published state management.
  - Version history with diff viewer.
  - Category and tag management.
  - Prompt preview with variable substitution.

**Modules:** `apps/dashboard/src/plugins/ai-providers`, `apps/dashboard/src/plugins/ai-routing`, `apps/dashboard/src/plugins/ai-prompts`

**Deliverables:**
- Providers listed with models and capabilities.
- Credentials can be added (UI only — backend encrypts).
- Routing test shows which provider would be selected.
- Prompts CRUD with draft/publish lifecycle.
- Version history viewable.
- Variable preview works.

**Dependencies:** Sprint F6.

**Validation:** E2E: configure provider → test routing → create prompt → publish → verify version.

**Exit Criteria:** AI Studio Suite (Providers + Routing + Prompts) functional and tested.

---

### Sprint F8: Agent Studio Plugin

**Goal:** Complete AI agent configuration.

**Scope:**
- Build `ai-agents` plugin.
- Agent list with status indicators.
- Agent create/edit form (model, temperature, tokens, capabilities).
- Prompt binding UI (bind system/user/library prompts to agent).
- Capability toggles (memory, knowledge, tools, vision, streaming).
- Draft/published lifecycle.
- Version history.
- Agent preview/test invocation.
- Implement widget SDK: agent status widget for dashboard home.

**Modules:** `apps/dashboard/src/plugins/ai-agents`

**Deliverables:**
- Agent CRUD with full configuration.
- Prompt bindings work.
- Capabilities can be toggled.
- Publish creates version.
- Test invocation runs and shows result.
- Agent status widget renders on dashboard.

**Dependencies:** Sprint F7.

**Validation:** E2E: create agent → bind prompt → enable tools → publish → test.

**Exit Criteria:** Agent Studio plugin feature-complete.

---

### Sprint F9: Workflow Studio & Tool Registry

**Goal:** Workflow builder canvas with node editor, execution, and tool management.

**Scope:**
- Build `workflow-studio` plugin.
  - Workflow list with status.
  - Workflow create/edit.
  - Integrate React Flow for visual node editor.
  - Node types: Start, End, Agent, Prompt, Tool, Condition, Delay, Variable, Subflow.
  - Edge connections with labels.
  - Branch/condition configuration.
  - Auto-save drafts.
  - Position persistence.
  - Workflow publish with version creation.
  - Workflow execution history.
  - Execution trace viewer (node-by-node status).
- Build `tool-registry` plugin.
  - Tool definition CRUD.
  - Parameter schema builder (JSON Schema UI).
  - Tool type selection (HTTP, REST, Webhook, Internal, etc.).
  - Tool publish/version lifecycle.

**Modules:** `apps/dashboard/src/plugins/workflow-studio`, `apps/dashboard/src/plugins/tool-registry`

**Deliverables:**
- Visual workflow editor with drag-and-drop nodes.
- All node types renderable.
- Edges connect nodes.
- Draft auto-saves.
- Workflows can be published and executed.
- Execution trace shows node statuses.
- Tools can be defined with parameters.
- Tool versions managed.

**Dependencies:** Sprint F8.

**Validation:** E2E: publish workflow → trigger execution → view trace. Manual: create tool → define parameters → publish.

**Exit Criteria:** Workflow execution and Tool Registry plugins complete.

---

### Sprint F10: Knowledge Base Plugin

**Goal:** Document management, upload, indexing.

**Scope:**
- Build `knowledge-base` plugin.
- Knowledge base list.
- Base create/edit.
- Document upload (drag-and-drop) with chunked upload architecture.
- Document list with indexing status.
- Chunk preview.
- Collection/folder management.
- Search test interface.
- File upload architecture implemented (chunk, resume, retry, preview, progress).

**Modules:** `apps/dashboard/src/plugins/knowledge-base`

**Deliverables:**
- Documents upload and show indexing status.
- Chunk preview visible.
- Collections and folders organize documents.
- Search test returns results.
- File upload handles large files with resume.

**Dependencies:** Sprint F9.

**Validation:** E2E: create base → upload document → wait for indexing → search.

**Exit Criteria:** Knowledge Base plugin feature-complete.

---

### Sprint F11: Channels, Conversations & Execution Monitoring

**Goal:** Channel configuration, WhatsApp setup, message monitoring, and execution traces.

**Scope:**
- Build `channels` plugin.
  - Channel list with state.
  - Channel create (select provider).
  - WhatsApp connection setup form (phone number, verify token, webhook).
  - Webhook status display.
  - Message list with delivery states.
  - Attachment viewer.
  - Connection health check.
  - Credential rotation UI.
- Build `conversations` plugin.
  - Conversation list with filters.
  - Conversation detail with message history.
  - Message rendering (text, image, template).
- Build `executions` plugin.
  - Execution run list.
  - Execution detail with step-by-step trace.
  - Execution event timeline.
  - Log viewer with filtering.

**Modules:** `apps/dashboard/src/plugins/channels`, `apps/dashboard/src/plugins/conversations`, `apps/dashboard/src/plugins/executions`

**Deliverables:**
- WhatsApp channel can be configured.
- Webhook verification status visible.
- Messages list shows inbound/outbound with states.
- Attachments viewable.
- Health check runs and reports.
- Conversations viewable with full message history.
- Execution traces show step statuses.
- Logs filterable by level.

**Dependencies:** Sprint F10.

**Validation:** Manual: create WhatsApp channel → verify webhook → view conversation → view execution trace.

**Exit Criteria:** Channels, Conversations, and Execution Monitoring plugins complete.

---

### Sprint F12: Runtime Introspection (Memory, Retrieval & Optimization)

**Goal:** Runtime introspection UIs.

**Scope:**
- Build `memory` plugin.
  - Memory record list by scope.
  - Memory content viewer.
  - Reference graph visualization.
- Build `retrieval` plugin.
  - Retrieval runtime list.
  - Execution test with results.
  - Diagnostics viewer.
- Build `optimization` plugin.
  - Cache package list.
  - Hit/miss metrics display.
  - Provider outcome viewer.

**Modules:** `apps/dashboard/src/plugins/memory`, `apps/dashboard/src/plugins/retrieval`, `apps/dashboard/src/plugins/optimization`

**Deliverables:**
- Memory records viewable by scope.
- Retrieval testable with diagnostics.
- Cache metrics visible.

**Dependencies:** Sprint F11.

**Validation:** Manual: inspect memory → run retrieval test → view cache metrics.

**Exit Criteria:** All runtime introspection plugins functional.

---

### Sprint F13: Operations Suite (Analytics, Billing, Audit & Settings)

**Goal:** Charts, reports, billing management, audit logs, and final polish.

**Scope:**
- Build `analytics` plugin.
  - Dashboard with charts (Recharts).
  - Token usage over time.
  - Cost breakdown by provider/model.
  - Message volume.
  - AI request volume.
- Build `billing` plugin.
  - Current plan display.
  - Usage vs quota bars.
  - Invoice list.
  - Payment history.
- Build `audit` plugin.
  - Audit log table with filters (date, user, action).
  - Diff viewer for changes.
- Build `settings` plugin.
  - Workspace settings form.
  - Personal preferences (theme, locale, notifications).
  - Quick replies management.
- Plugin-wide polish: loading states, empty states, error boundaries.
- Performance audit + optimization.
- User layout persistence implemented.

**Modules:** `apps/dashboard/src/plugins/analytics`, `apps/dashboard/src/plugins/billing`, `apps/dashboard/src/plugins/audit`, `apps/dashboard/src/plugins/settings`

**Deliverables:**
- Analytics dashboard with 4+ chart types.
- Billing shows plan and usage.
- Invoices listed.
- Audit logs filterable and viewable.
- Settings pages functional.
- No broken loading states anywhere.
- Performance audit shows acceptable metrics.
- User layouts save and restore correctly.

**Dependencies:** Sprint F12.

**Validation:** E2E: filter audit logs → change settings → verify persistence. Manual: view analytics charts → check billing → view invoice.

**Exit Criteria:** Operations Suite complete. App feels polished.

---

### Sprint F14: Testing, Security Review & Production Hardening

**Goal:** Production readiness.

**Scope:**
- E2E test coverage for all critical journeys.
- Security review: verify no secrets, no localStorage tokens, CSP headers.
- Performance: verify Web Vitals, bundle sizes, API latency.
- Accessibility: full WCAG 2.1 AA audit.
- i18n: verify all strings translated, RTL perfect.
- Offline: verify optimistic updates, draft persistence.
- Realtime: verify SSE reconnect, event handling.
- Error handling: verify boundaries, fallback UIs, error codes.
- Motion system: verify no arbitrary animations, reduced-motion compliance.
- AI UX: verify streaming, tool cards, citations, confidence badges.
- Documentation: README, deployment guide, runbook.

**Modules:** All.

**Deliverables:**
- E2E test suite passes.
- Lighthouse score >90 on all major pages.
- Security checklist complete.
- Accessibility audit passes.
- All Arabic translations verified.
- Reduced-motion mode tested.

**Dependencies:** Sprint F13.

**Validation:** Full regression test. CI/CD pipeline end-to-end.

**Exit Criteria:** Dashboard is production-ready. Ready for deployment.

---

## 45. Client Dashboard Sprint Roadmap

> **Constraint:** Client Dashboard is NOT built until Dashboard reaches 100% (after Sprint F14).
> This roadmap is high-level and will be refined when work begins.

### Sprint C1: Client Foundation
- Create `apps/client/` Next.js project.
- Configure i18n (EN + AR), Tailwind, auth, state.
- Build `AgentShell` 3-panel layout.
- Implement login for agents (workspace pre-selected).
- Implement file upload architecture for attachments.

### Sprint C2: Inbox & Conversation List
- Real-time SSE connection for inbox.
- Conversation list with filters (open, pending, closed).
- Unread counts, assignment badges.
- Optimistic updates for status changes.
- Implement data grid standard for conversation list.

### Sprint C3: Conversation Thread
- Message thread rendering (text, image, template, file).
- Scroll pagination for history.
- Read receipts.
- Message status indicators (sent, delivered, read).
- AI message bubbles with streaming support.

### Sprint C4: Composer
- Rich text editor (Tiptap) with mentions, slash commands, templates.
- Attachment upload (drag-and-drop) with chunked upload.
- Quick replies selector.
- Emoji picker.
- Template selector (WhatsApp).
- Typing indicator.
- AI draft generation inline.

### Sprint C5: Contacts & Customer Profile
- Contact directory with search.
- Customer profile panel (right side).
- Conversation history per customer.
- Customer fields editable.

### Sprint C6: AI Assistant & Agent Handoff
- Inline AI suggestion panel.
- AI draft generation.
- Agent handoff actions (transfer, escalate).
- AI confidence indicators.
- Tool execution visualization in agent context.

### Sprint C7: WhatsApp, Search & Presence
- WhatsApp-specific UI (templates, media).
- Global search (conversations, contacts, messages).
- Presence system (online/away/busy).
- Typing indicators between agents.
- Command palette for agent actions.

### Sprint C8: Polish, Mobile & Production
- Mobile responsive (tablet + phone).
- Performance optimization.
- E2E tests for all agent journeys.
- Offline handling for composer.
- Production hardening.
- Accessibility audit (WCAG 2.1 AA).

---

*End of Frontend Architecture Blueprint*
