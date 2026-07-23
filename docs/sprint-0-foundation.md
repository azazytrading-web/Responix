# Sprint 0 Foundation

Sprint 0 initializes the Responix repository without implementing business features.

## Included

- `pnpm` workspace and Turborepo task orchestration.
- Strict TypeScript base configuration.
- Shared ESLint and Prettier configuration.
- NestJS API foundation with versioned health endpoint and OpenAPI setup.
- Next.js dashboard foundation with route groups for company dashboard, client portal, and authentication.
- Foundation packages: `config`, `database`, `types`, `ui`, and `utils`.
- PostgreSQL using the `pgvector` image and startup extension initialization.
- Redis for cache, queues, sessions, rate limiting, and temporary state.
- Cloudflare R2 environment contract.
- GitHub Actions CI quality pipeline.

## Excluded

- Business modules.
- Authentication implementation.
- AI provider integrations.
- WhatsApp integration.
- MinIO or local object storage emulation.
- Empty future packages.
