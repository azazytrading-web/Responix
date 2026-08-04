# Local Development

The Windows bootstrap scripts provide a one-command development environment from the repository root. They validate tool versions, install missing dependencies, prepare `.env`, generate Prisma Client when stale, detect and start native PostgreSQL and Redis Windows services, and keep failed terminals open with an actionable message.

## Prerequisites

- Windows 10 or 11 with PowerShell 5.1 or newer.
- Node.js 20.11.0 or newer.
- pnpm 9 or newer (`corepack enable` is the recommended installation path).
- PostgreSQL installed and registered as a Windows service.
- Redis installed and registered as a Windows service.

### Installing PostgreSQL

Download and install PostgreSQL for Windows from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/).  The installer automatically creates a Windows service.  The bootstrap dynamically discovers any service whose Name or DisplayName contains `postgre` or `pgsql` — no manual service naming is required.

### Installing Redis

Install Redis for Windows (e.g., [Memurai](https://memurai.com/), [Redis-Windows](https://github.com/tporadowski/redis), or via WSL).  The bootstrap dynamically discovers any service whose Name or DisplayName contains `redis`, `memurai`, or `redisserver` — no manual service naming is required.

## First-time setup

Clone the repository and run:

```bat
start-all.bat
```

If `.env` does not exist, the bootstrap copies `.env.example` and generates local JWT and AES-256 credential-encryption secrets. External provider and R2 example values remain non-production placeholders and must be replaced before exercising those integrations. Dependencies are installed with the repository lockfile, Prisma Client is generated, PostgreSQL and Redis services are verified (started if stopped), and pending migrations are deployed.

## Daily startup

- `start-backend.bat` verifies PostgreSQL and Redis are running, applies pending migrations, and launches the Nest API on port 4000.
- `start-dashboard.bat` launches the management Dashboard on port 3000.
- `start-client.bat` launches the Client Portal view of the shared Next.js application on port 3001.
- `start-all.bat` prepares the complete environment and opens Backend, Dashboard, and Client Portal in separate terminals.

The repository currently has one Next.js frontend package. Dashboard and Client Portal therefore run the same application with separate ports and separate Next build directories; `/company` is the company dashboard surface and `/portal` is the client surface.

## Log files

Every service started by the bootstrap writes its output to a timestamped log file under `.dev-runtime/logs/`.  These files survive process restarts and are useful when a terminal window is accidentally closed or when you need to share startup traces.  The directory is ignored by Git.

## Startup ordering

When `start-all.bat` is used, the bootstrap waits for PostgreSQL and Redis to accept TCP connections before running Prisma migrations.  After the Backend terminal is launched, it polls `http://localhost:4000/api/v1/health` (up to 120 seconds) before continuing, ensuring the API is ready before Dashboard and Client are started.

## Graceful shutdown

`stop-all.bat` first attempts a graceful shutdown by sending a close signal to each tracked terminal window and waiting up to 5 seconds.  If the process does not exit in time, it is forcefully terminated (`taskkill /T /F`).  **PostgreSQL and Redis Windows services are intentionally left running** so data is preserved and subsequent startups are faster.

## Stopping services

Run:

```bat
stop-all.bat
```

Only process trees whose terminal PIDs were recorded under the ignored `.dev-runtime` directory are terminated.  PostgreSQL and Redis services are **not** stopped.  Unrelated Node processes and local data are preserved.

## Environment variables

The API reads the root `.env`. The authoritative list and local defaults are in `.env.example`. Important groups are:

- API and frontend URLs: `API_PORT`, `API_URL`, `DASHBOARD_URL`.
- Infrastructure: `DATABASE_URL`, `REDIS_URL`, and `POSTGRES_*`.
- Authentication: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
- Credential protection: `AI_CREDENTIAL_ENCRYPTION_KEY`, which must decode to exactly 32 bytes.
- Storage: `R2_*` values.
- AI runtime and provider network controls: `AI_*` values.
- Browser-visible API configuration can be supplied through `NEXT_PUBLIC_API_URL` when needed.

Never commit `.env`. Generated local secrets are intended only for development.

## Troubleshooting

### Node or pnpm is rejected

Run `node --version` and `pnpm --version`. Install Node 20.11+ and pnpm 9+, then open a new terminal so PATH changes take effect.

### PostgreSQL service is not found

The bootstrap dynamically scans all Windows services for any whose Name or DisplayName contains `postgre` or `pgsql`.  If none are found, it prints a list of all SQL-related services discovered on the machine to help you troubleshoot.  You can also verify available services manually with:

```powershell
Get-Service | Where-Object { $_.Name -match "postgre|pgsql" -or $_.DisplayName -match "postgre|pgsql" }
```

### Redis service is not found

The bootstrap dynamically scans all Windows services for any whose Name or DisplayName contains `redis`, `memurai`, or `redisserver`.  If none are found, it prints a list of all Redis/Memurai/cache-related services discovered on the machine.  You can also verify manually with:

```powershell
Get-Service | Where-Object { $_.Name -match "redis|memurai" -or $_.DisplayName -match "redis|memurai" }
```

### Port already in use

Stop the process already using ports 3000, 3001, 4000, 5432, or 6379. Use `stop-all.bat` first if it was launched by these scripts.

### A stale PID file remains

The next start removes PID files whose processes no longer exist. The `.dev-runtime` directory may also be removed safely when no Responix development terminals are running.

### Prisma or database startup fails

Confirm `DATABASE_URL` matches the running PostgreSQL instance and the service is healthy.  The bootstrap automatically retries `prisma migrate deploy` up to 5 times with a 3-second backoff, so transient database startup races are usually resolved without manual intervention.  If it still fails, rerun `start-backend.bat` after confirming the service health.

### Provider, media, or storage calls fail

Replace the example R2/provider values in `.env` with valid development credentials. The core API can start with example external-service values, but external calls cannot succeed without real credentials.

## Production deployment

Production deployments continue to use Docker Compose.  The `docker-compose.yml` and related production orchestration files in the repository are **not** modified by the local development bootstrap and remain the source of truth for staging and production environments.

## Bootstrap validation

Maintainers can validate preflight behavior without opening service terminals:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-bootstrap.ps1 -Target dashboard -ValidateOnly
powershell -ExecutionPolicy Bypass -File scripts/dev-bootstrap.ps1 -Target client -ValidateOnly
```

Backend validation additionally verifies that the PostgreSQL and Redis Windows services are installed.
