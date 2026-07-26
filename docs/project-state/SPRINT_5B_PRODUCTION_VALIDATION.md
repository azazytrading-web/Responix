# Sprint 5B Production Validation

## Scope

Sprint 5B Packages 1 through 5 cover the provider, routing, invocation, HTTP, and production-validation foundations. This record does not authorize additional AI features.

## Automated Evidence

The AI integration suite exercises the real Nest HTTP boundary and the real provider-neutral service pipeline while replacing only persistence and the external provider network with deterministic test doubles.

| Area | Verified behavior |
| --- | --- |
| Provider | Persisted provider discovery, registry lookup, factory resolution, and adapter interchangeability |
| Routing | Workspace-scoped candidates, capability and health eligibility, deterministic priority, and routing selection |
| Invocation | Request normalization, credential callback execution, provider execution, usage/cost normalization, lifecycle completion, and failure persistence |
| HTTP | Runtime validation, thin controller delegation, explicit DTO serialization, stable error mapping, authorization metadata, request-ID propagation, and Swagger paths |
| Tenant isolation | Caller tenant identifiers are rejected and authenticated workspace context remains authoritative |
| Credential security | Plaintext and encrypted credentials are absent from responses, persistence calls, and structured error logs |
| Failure handling | Provider failures and timeouts produce safe stable responses and close pending lifecycle records |
| Transaction safety | Invocation finalization uses one Prisma transaction; rollback regression coverage verifies later records are not written after a failed transaction step |

## Production Runtime Checklist

On a Docker-capable host:

1. Start the documented PostgreSQL, Redis, API, and Dashboard services with `docker compose up --build`.
2. Confirm all services are healthy with `docker compose ps`.
3. Verify `GET /api/v1/health`.
4. Authenticate into an active workspace whose role has `ai.configure` and `ai.invoke`.
5. Verify `GET /api/v1/ai/providers` returns only provider and model DTO fields.
6. Verify `POST /api/v1/ai/routing/resolve` returns a deterministic provider-neutral decision.
7. Verify `POST /api/v1/ai/invocations` propagates or generates `x-request-id` and returns the same ID in the normalized response.
8. Confirm API logs and responses contain no API keys, credential envelopes, authorization headers, provider payloads, or stack traces.
9. Confirm successful invocations persist lifecycle, usage, cost, and routing records consistently.
10. Confirm a controlled provider failure persists a normalized failure without partial usage, cost, or routing finalization.

## Environment Limitation

Docker is unavailable on the current host, so live Compose, PostgreSQL, Redis, and external-provider verification remains pending on a Docker-capable environment. Automated production validation does not require real provider credentials and does not log or persist test secrets.
