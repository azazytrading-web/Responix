# Responix

Enterprise multi-tenant AI customer engagement platform.

This repository follows `MASTER_CODEX_PROMPT.md` and the official technical documentation as the single source of truth.

## AI Development Workflow

Every AI session must read, in order, [AI_CONTEXT.md](docs/project-state/AI_CONTEXT.md), [SESSION_HANDOFF.md](docs/project-state/SESSION_HANDOFF.md), [KNOWN_ISSUES.md](docs/project-state/KNOWN_ISSUES.md), and [ENGINEERING_WORKFLOW.md](docs/project-state/ENGINEERING_WORKFLOW.md). Implementation must not begin until these documents are understood.

## Foundation Scope

- Turborepo + pnpm monorepo foundation.
- Next.js dashboard application.
- NestJS API application.
- Foundation shared packages only.
- PostgreSQL with `pgvector`.
- Redis for cache, queues, sessions, and rate limiting.
- Cloudflare R2 environment contract for object storage.
- Reproducible Docker builds, Compose health checks, and CI cache support.
- Structured API logging, configurable HTTP rate limiting, compression, and browser security headers.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm db:deploy
pnpm db:reset
docker compose up -d
```
