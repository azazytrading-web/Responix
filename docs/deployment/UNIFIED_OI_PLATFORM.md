# Unified Oi Platform deployment

Responix and OIC run as separate application processes with separate database
owners. The local unified entry point is `pnpm platform:dev`. It builds the OIC
API, Responix API, and Dashboard in sequence, then starts them in that order and
waits for each health endpoint. The APIs and Dashboard run from production build
output. Local PostgreSQL and Redis services must already be running. Set
`DATABASE_URL` and `REDIS_URL` in the ignored root `.env`, and
`OIC_DATABASE_URL` in the ignored `.env.oic.local`, pointing to separate local
databases. This process mode does not start containers.

Copy `.env.example` to `.env` and provide local-only Responix settings, the OIC
runtime and provisioning credentials, and `OIC_RUNTIME_PRINCIPAL_ID`. Keep the
OIC database settings and local foundation recovery credential in the ignored
`.env.oic.local`. Never use a foundation administrator credential for either
machine identity.

Provision separate OIC machine principals for runtime and workspace tenant
provisioning. The runtime principal needs only
`oic:runtime:invoke` and `oic:runtime:models:read`; the provisioning principal
needs `oic:applications:read`, `oic:tenants:read`, and `oic:tenants:manage` for
the current connector flow. Runtime credentials do not have provisioning
scopes.

Responix resolves an OIC Tenant through the OIC Foundation API using the
`RESPONIX_WORKSPACE` external reference and grants the tenant to the configured
runtime principal. It does not query the OIC database. Agent execution selects
an Oi Model ID only. Provider Connections, upstream models, variants, and
runtime bindings remain OIC-owned. Memory, Knowledge, Guard, channel
serialization, and outbound delivery remain Responix-owned and workspace
scoped.

The dashboard is internal Oi software. Agent Studio supports the LEGACY/OIC
selector and Oi Model selection. The current OIC internal operations surface is
the authenticated OIC API, including Swagger at `/docs` and application,
tenant/external-reference, principal, provider/connection, model/catalog, and
audit routes. This is the OIC-4 foundation surface; the future OIC-9 control
center is outside this release. Customers do not receive OIC credentials or
direct OIC API access.

OIC-4 HTTP acceptance exercised Responix through `@oic/client` to OIC Native
Runtime, including authentication, tenant isolation, request propagation,
idempotency handling, and Responix error mapping. Without a local provider
binding, the expected result is `OIC_MODEL_NOT_AVAILABLE`; OIC mode does not
silently fall back to LEGACY. Raw usage is bridged when a provider produces it.
The local acceptance environment did not have a provider binding, so no real
provider call or raw usage record was produced.

Migration `000045_oic_agent_runtime_decoupling` belongs only on the Responix
database. Local deployment and final schema/data verification passed. The first
local attempt failed because `migration.sql` had a UTF-8 BOM; it had no side
effects, was marked rolled back with Prisma migrate resolve, the BOM was
removed, and the migration then applied successfully. Preserve the historical
rolled-back migration record. OIC migrations are applied separately using
`oic-migrate` or the OIC Prisma workflow.

Configure `API_PORT`, `DASHBOARD_PORT`, and `OIC_PORT` to choose local ports.
The process runner binds OIC and Responix to `127.0.0.1` and supplies Responix
with the loopback OIC URL. Startup is sequential with bounded readiness checks;
startup failure stops the process trees. Run `pnpm platform:dev` in the
foreground and press Ctrl+C to stop it. `pnpm platform:down` is for the optional
Docker Compose topology only; it does not stop the local foreground runner.

The non-Docker unified smoke passed: OIC API, Responix API, and Dashboard built
and became ready over loopback. Docker Compose runtime validation remains
blocked because Docker is unavailable on this machine. Production deployments
must keep OIC private, supply credentials through a deployment secret manager,
and deploy each product's migrations to its own database before enabling
traffic. Compose keeps the OIC API private with no published host port and runs
the one-shot `oic-migrate` service before OIC starts.
