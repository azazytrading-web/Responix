# Roadmap Status

## WhatsApp Connection Management Milestone - 2026-08-09

| Milestone | Status | Outcome |
| --- | --- | --- |
| WhatsApp onboarding | Complete | Manual Meta Cloud connection surface with write-only credentials |
| WhatsApp connection edit | Complete | PATCH connection, regenerate verify token, edit form |
| WhatsApp callback URL | Complete | Full URL displayed with copy button, localhost warning |
| Next | Not started | Supply real Meta development values, validate connection, verify webhook delivery |

Inbox, Conversations, analytics, and unrelated Memory/Retrieval/Tools/Workflow surfaces remain outside this milestone.

## WhatsApp Onboarding Milestone - 2026-08-09

## WhatsApp Onboarding Milestone - 2026-08-09

| Milestone | Status | Outcome |
| --- | --- | --- |
| FM-7 live gate | Complete | Real DeepSeek validation and a real published-Agent execution succeeded |
| WhatsApp onboarding | Complete | Discoverable manual Meta Cloud connection/configuration surface backed by Channel Runtime |
| Next | Not started | Supply real Meta development values, create/validate the first connection, then verify webhook delivery |

Inbox, Conversations, analytics, and unrelated Memory/Retrieval/Tools/Workflow surfaces remain outside this milestone.

## Post-FM-7 Gate - 2026-08-09

FM-7 is code-complete but its external smoke gate is blocked by the absence of a real provider credential. Current roadmap records list Memory, Retrieval, Tools, Workflow, Conversations/Inbox, Channels/WhatsApp, and monitoring as later surfaces but do not establish an authoritative post-FM-7 milestone number or dependency order. No next milestone is started until provider validation and one real Agent execution succeed.

## Provider & Prompt Library Resource Milestone - 2026-08-09

| Sprint | Status | Outcome |
| --- | --- | --- |
| FM-7 | Complete | Provider/model discovery, encrypted self-service configuration/validation, and Prompt Library management implemented and validated |
| Provider blocker | Closed | Safe read/upsert/validation APIs, permissions, audits, health records, and credential encryption integrated |

FM-7 is the validated frontend baseline. Preserve Provider and Prompt Library resource ownership; later Memory, Retrieval, Tools, Workflow, Inbox, WhatsApp, and monitoring work remains outside this milestone.

## Frontend Agent Configuration Milestone - 2026-08-09

| Sprint | Status | Outcome |
| --- | --- | --- |
| FM-6 | Complete | Agent list, creation, persisted draft configuration, provider/model selection, Prompt Library binding, capability flags, and publishing |
| Next | Not started | Provider and prompt resource configuration required for self-service Agent setup |

FM-6 consumes the existing Agent Studio, AI provider-capability, and Prompt Library APIs. Routes are `/ai/agents`, `/ai/agents/new`, and `/ai/agents/[agentId]`. Workspace-scoped query keys and permission boundaries are enforced in the UI while the backend remains authoritative. Full Prompt Studio, resource management, Workflow Builder, runtime history, Inbox, Conversations, and WhatsApp UI remain later work.

## Frontend Feature Milestone - 2026-08-09

| Sprint | Status | Outcome |
| --- | --- | --- |
| FM-5 | Complete | Dashboard Home, Workspace Management, Platform Control, and Team Management feature modules |
| Next | Not started | Agent creation and configuration frontend |

FM-5 consumes existing backend bootstrap, workspace, membership, and platform-role contracts without changing completed runtime architecture. The next exact frontend milestone is Agent configuration; Provider, Prompt, Channel, Inbox, and runtime-observability screens remain later work.

## Frontend Foundation Milestones - 2026-08-02

| Sprint | Status | Outcome |
| --- | --- | --- |
| FM-3 | Complete | Backend-authoritative authentication and tenant lifecycle |
| FM-4 | Complete | Canonical platform bootstrap, provider composition, readiness boundary, and manifest-driven navigation |
| FM-5 | Complete | Core Dashboard, Workspace, Platform, and Team feature modules |

## Authoritative Current State — Sprint FM-2 — 2026-08-01

Sprint FM-2 (API Foundation) is **complete**. `@responix/api-client` is the single frontend HTTP owner and consumes raw NestJS DTO responses without a frontend-only response envelope. It provides query serialization, request metadata, timeout and abort handling, empty-body handling, normalized backend errors, and replay-capable interceptor integration points. OpenAPI types are generated from the live NestJS `/docs-json` document. The unused Dashboard-local API layer and unsupported shared endpoint catalog were removed.

FM-3 has not started. Authentication lifecycle, provider composition, runtime bootstrap integration, navigation integration, realtime, notifications, UI, and feature modules remain outside FM-2. This section supersedes older frontend-next-step statements below.

## Sprint F2.5 Update - 2026-08-01

Sprint F2.5 (Dashboard Infrastructure Completion) is complete. All hardcoded navigation has been replaced with a manifest-driven navigation engine. The notification infrastructure is fully abstracted with provider, store, transport, repository, and hooks. Auth refresh infrastructure includes silent refresh manager, token expiration detector, 401 retry pipeline, and request replay. Frontend testing foundation is established with Vitest, React Testing Library, and 22 passing tests. Developer experience improvements include global error/loading boundaries, query devtools, environment validation, logger, debug mode, and runtime assertions. API integration clients are prepared for all domains. The manifest mock matches backend contracts and is replaceable by `GET /dashboard-runtime/bootstrap`.

## Sprint F2 Update - 2026-08-01

Sprint F2 (Dashboard Core Shell & Auth System) is complete. The Dashboard now has a fully functional authentication layer, workspace-aware navigation, responsive layout shell, command palette, and error pages. All frontend packages and the Dashboard app pass typecheck, lint, build, and tests. The auth provider stores access tokens in memory only; session metadata is persisted to `responix:session`. The sidebar, topbar, app-shell, and command palette are all integrated and responsive.

## Foundation Verification - 2026-08-01

The Frontend Foundation has passed strict verification. All temporary scripts, placeholder text, and unnecessary dependencies were removed. The auth provider now stores access tokens in memory only (never localStorage). All 7 shared packages export clean public APIs. The Dashboard shell matches the MVP HTML visual language. Next.js 15.5.21, React 19, TypeScript 5.7.3, next-intl 3.26, next-themes, and TanStack Query 5.64.2 are in place. The foundation is production-ready and will not force refactoring during later Dashboard sprints.

## Sprint F1 Update - 2026-08-01

The Frontend Foundation & Design System sprint is complete. The Turborepo monorepo now contains 7 shared packages (`types`, `design-system`, `ui`, `shared`, `api-client`, `auth`, `state`) and a bootable Next.js 15 Dashboard application at `apps/dashboard/`. All workspace packages typecheck, lint, test, and build successfully. The two-TSConfig pattern (`tsconfig.json` for typecheck, `tsconfig.build.json` for build) is established. next-intl v3.26 i18n, theme provider, auth foundation, plugin infrastructure, widget SDK, manifest loader, route guards, error boundaries, Suspense, and layout persistence are all in place.

## Sprint 6E.14 Update - 2026-07-31

The Channel Runtime is now a provider-neutral multi-channel foundation. Installed adapters are resolved through a registry and share credential, transport, webhook, media, capability, health, retry, rate-limit, delivery, batching, presence, diagnostics, metrics, audit, and normalized-message contracts. Meta WhatsApp Cloud implements these contracts without a provider-specific orchestration path.

## Sprint 6E.13 Update - 2026-07-31

The generic Channel Runtime and its first production adapter, Meta WhatsApp Cloud, are implemented. The runtime owns workspace-scoped connections, sessions, normalized messages, media, delivery state, replay protection, immutable history, diagnostics, metrics, and transactional audits while reusing existing Conversation, Workflow, Agent, Tool, Memory, Retrieval, Optimization, Provider, Streaming, and Execution Kernel layers.

## Sprint 6E.12 Update - 2026-07-31

Advanced Prompt Cache and Runtime Optimization is implemented by extending the existing
immutable optimization packages rather than adding a response cache or Redis-only path.
Static prompt/runtime assets now reuse hash-addressed workspace packages across providers,
while native provider hits, internal fallback, invalidation, history, audits, and metrics
remain explicit and durable.

## Sprint 6E.11 Update - 2026-07-31

The Tool Calling Engine is implemented as the vendor-neutral execution layer shared by
Agent Execution and Workflow Runtime. Published tool definitions are hash-protected and
workspace isolated; executions reuse Execution Kernel, secure HTTP transport, Retrieval,
Memory, Runtime Optimization, Prompt, Provider, and Streaming boundaries with durable
history, diagnostics, metrics, permissions, and append-only audits.

## Sprint 6E.10 Update - 2026-07-31

The Workflow Execution Engine is complete and validated in the working tree. Immutable
published workflow versions now execute through a provider-neutral orchestration layer
above Agent Execution with durable lifecycle, graph, approval, retry, compensation,
history, diagnostics, metrics, permissions, auditing, and workspace isolation.

## Sprint 6E.9 Update - 2026-07-31

The Retrieval Execution Engine is complete and validated in the working tree. Published
Retrieval Runtime metadata now becomes immutable, prompt-ready execution context without
introducing a vector database, embedding provider, or provider-specific retrieval path.

## Sprint 6E.7 Update - 2026-07-30

The Unified Streaming Execution Engine is complete and validated. It extends the
existing Sprint 6D/6E runtime foundations without introducing a parallel provider,
execution, prompt, agent, or accounting path.

| Sprint                                                        | Status    | Scope                                                                                             |
| ------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| Sprint FM-2 — API Foundation                                  | Complete  | Canonical API client, raw NestJS DTO transport, OpenAPI generation, consolidated API ownership   |
| Sprint F2.5 — Dashboard Infrastructure Completion            | Complete  | Navigation engine, notifications, auth refresh, testing, DX, API clients, manifest mock |
| Sprint F2 — Dashboard Core Shell & Auth System                | Complete  | Auth pages, workspace switcher, sidebar, topbar, command palette, error pages, i18n, responsive   |
| Sprint F1 — Frontend Foundation & Design System               | Verified  | Turborepo packages, Design System, UI primitives, Dashboard shell, i18n, theme, auth foundation   |
| Sprint 0 — Project Initialization                             | Completed | Monorepo and development foundation                                                               |
| Sprint 1 — Infrastructure Finalization                        | Completed | Production-readiness and infrastructure baseline                                                  |
| Sprint 2 — Database Foundation                                | Completed | Prisma schema, migrations, pgvector, and bootstrap data                                           |
| Sprint 3 — Identity, Authentication & Multi-Tenant Foundation | Completed | JWT authentication, sessions, RBAC, and authorization                                             |
| Sprint 4 — Workspace & Multi-Tenant Core                      | Completed | Tenant context, memberships, invitations, workspace lifecycle, isolation, and API hardening       |
| Sprint 5 — AI Engine                                          | Current   | Router, prompts, memory, knowledge injection, providers, validation, cost tracking, and analytics |
| Sprint 6 — WhatsApp Integration                               | Planned   | Cloud API, webhooks, messages, media, templates, status, reconnect, and health                    |
| Sprint 7 — Knowledge Engine                                   | Planned   | Upload, chunking, embeddings, vector search, RAG, re-indexing, and analytics                      |
| Sprint 8 — Workflow Builder                                   | Planned   | Builder, nodes, triggers, actions, execution, history, and logs                                   |
| Sprint 9 — CRM                                                | Planned   | Customers, leads, deals, pipelines, tasks, calendar, activities, and reports                      |
| Sprint 10 — Company Dashboard                                 | Planned   | Analytics, management, monitoring, subscriptions, AI control, and health                          |
| Sprint 11 — Client Dashboard                                  | Planned   | Conversations, knowledge, AI, CRM, billing, settings, and reports                                 |
| Sprint 12 — Billing                                           | Planned   | Subscriptions, invoices, payments, quotas, and usage billing                                      |
| Sprint 13 — Analytics                                         | Planned   | Charts, reports, AI cost, growth, revenue, usage, performance, and KPIs                           |
| Sprint 14 — Testing                                           | Planned   | Unit, integration, API, load, security, regression, and smoke testing                             |
| Sprint 15 — Production Deployment                             | Planned   | Images, CI/CD, monitoring, alerts, backups, SSL, CDN, and scaling                                 |

## Current Direction

Sprint F2 is complete. The frontend Dashboard now has a production-ready auth system, workspace-aware navigation, responsive layout shell, and command palette. The next step is Sprint F3 — Dashboard Feature Modules (AI Providers, Prompt Studio, Agent Studio, Workflow Studio, Tool Registry, Knowledge Base, Memory, Retrieval, Conversations, Channels, Runtime Monitoring, Analytics, Billing, Team Management, Roles & Permissions, Audit Logs, Settings). Preserve all completed backend boundaries; do not modify backend code.
