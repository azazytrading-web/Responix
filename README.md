# Responix

Enterprise multi-tenant AI customer engagement platform.

This repository follows `MASTER_CODEX_PROMPT.md` and the official technical documentation as the single source of truth.

## Sprint 0 Scope

- Turborepo + pnpm monorepo foundation.
- Next.js dashboard application.
- NestJS API application.
- Foundation shared packages only.
- PostgreSQL with `pgvector`.
- Redis for cache, queues, sessions, and rate limiting.
- Cloudflare R2 environment contract for object storage.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
docker compose up -d
```
