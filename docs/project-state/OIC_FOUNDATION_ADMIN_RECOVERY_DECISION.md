# OIC Foundation Administrative Recovery Decision

**Status:** APPROVED / LOCKED
**Authority:** Owner decision in the OIC-1 Stage 1G Security Closeout instructions provided 2026-09-30.
**Scope:** This decision amends the locked OIC Foundation Phase 1 contract only for protected recovery of the canonical platform administrator.

## Initial bootstrap

Initial bootstrap is creation-only. It creates the canonical OIC platform Application, the `platform-admin` Service Principal, the canonical Foundation Phase 1 scopes, one high-entropy credential and an audit event in one transaction. It fails closed if bootstrap state already exists. It never reactivates or rotates existing identities or credentials. Operators must use the separate recovery command when canonical bootstrap records exist.

## Recovery command and authorization

Administrative recovery is available only through a separate local/operator CLI command. It is not an HTTP, Swagger, runtime or OpenAI-compatible API operation. The command requires all of:

- exact recovery command selection;
- process-only `OIC_OPERATOR_RECOVERY_AUTHORIZED=1` authorization;
- exact confirmation phrase `RECOVER OIC PLATFORM ADMIN`;
- a validated, bounded operation ID;
- an 8–256 character bounded operator reason.

The authorization flag is never enabled in committed configuration. The OIC API never invokes recovery automatically.

## Fixed recovery target and lifecycle

Recovery resolves only Application key `OIC_PLATFORM` and its Service Principal key `platform-admin`. It accepts no caller-supplied resource IDs. Missing canonical records fail closed; recovery never recreates them. `SUSPENDED` records may be restored. `ARCHIVED` records are terminal and cannot be recovered.

## Credential, authorization and audit state

One successful operation atomically:

1. restores the canonical Application and administrator principal to `ACTIVE`;
2. revokes every currently active credential for that principal while retaining history;
3. restores exactly the shared canonical Foundation Phase 1 scope profile and revokes noncanonical active scopes;
4. creates exactly one new high-entropy credential and persists only its verifier;
5. persists a unique recovery operation record to make retries safe;
6. creates a dedicated append-only audit event.

The new credential is returned only on the first successful command result. A repeated operation ID with the same reason returns safe metadata with no credential secret and makes no new state change. Reuse of an operation ID with a different reason fails as a conflict. A new recovery requires a new explicit operation ID and fresh operator authorization.

Audit metadata may include the operation ID, canonical Application and principal IDs, operator class, bounded reason, correlation ID and count of revoked active credentials. It never includes credential material, verifier material, database credentials or environment secrets. Audit failure rolls back the complete recovery transaction.

## Security test and change boundary

Repository-owned OIC tests must cover authorization failures, fixed-target behavior, missing and terminal records, suspension recovery, credential revocation and one-time return, exact scope restoration, recovery idempotency, audit secrecy and complete rollback on audit failure. Recovery remains OIC-only. No Responix source, schema, database or behavior changes are authorized by this decision.
