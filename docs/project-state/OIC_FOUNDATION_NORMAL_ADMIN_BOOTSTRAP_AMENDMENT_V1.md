# OIC Foundation normal administrator bootstrap amendment v1

**Status:** OWNER APPROVED FOR IMPLEMENTATION; one-time execution against `oic_development` requires a separate owner approval.
**Authority:** Owner approval supplied 2026-10-14 after the Foundation authority deadlock and privileged-target credential issuance defect were identified.
**Affected contracts:** `OIC_FOUNDATION_PHASE_1_CONTRACT.md` and `OIC_FOUNDATION_ADMIN_RECOVERY_DECISION.md` are amended only as described here. The fixed-target recovery command retains its original behavior.

## Decision and compatibility impact

When `OIC_PLATFORM` and `platform-admin` exist but no normal operational Foundation administrator exists, a separate local deployment command may verify the canonical recovery credential once and establish the fixed `oic-foundation-operator` Service Principal. It is application-owned by `OIC_PLATFORM`, receives exactly `oic:principals:manage`, `oic:credentials:rotate`, `oic:credentials:revoke`, `oic:evaluation:manage`, and `oic:evaluation:holdout:import`, and receives neither `oic:foundation:admin` nor Console authority. The evaluation scopes are required by the existing grantor-must-hold-scope rule. The operator is an identity administrator and is never the OIC-7 runner, fixture author, publisher, or evaluator execution principal.

This is not a general recovery or scope-grant API. The command has no HTTP route and accepts no target identity, application, or scope parameters. Its owner authorization is separate from the original `admin:recover` authorization. It requires local deployment access, an explicit process-only authorization flag, exact confirmation, bounded operation ID and reason, approved decision reference, and private proof from an active canonical `platform-admin` credential. Successful execution atomically revokes all active credentials of `platform-admin`; later break-glass use requires the original separately authorized recovery command.

Ordinary OIC HTTP authentication rejects `platform-admin` credentials. Foundation credential, scope, and lifecycle operations protect privileged targets. A newly granted `oic:foundation:admin`, `oic:evaluation:manage`, or `oic:evaluation:holdout:import` scope revokes all pre-existing active credentials of that target in the same audited transaction. Existing clients that depended on HTTP use of `platform-admin`, ordinary Console minting of privileged credentials, or retention of credentials across elevation must use the authorized operational principal and newly issued credentials instead.

The normal operator authenticates only to the Foundation administration controller. Its evaluation scopes grant scope-delegation authority under the current Foundation rule but cannot be used on evaluation routes. The runner and independent publisher must use their own credentials.

## One-time, persistence, and secret rules

The command checks the fixed existing OIC identities and refuses inactive, partial, existing-normal-admin, or already-completed state. A PostgreSQL transaction-scoped advisory lock and unique operation/application/target constraints prevent concurrent creation. Exact operation replay returns safe metadata without a new secret; a new operation after completion refuses. A new `OicOperationalAdminBootstrapRecord` migration stores the one-time operation, principal and credential IDs, request hash, and revoked recovery credential count.

The operational credential is generated with the existing OIC credential primitive. Only its verifier enters the database. A restricted, ignored local file is written, flushed, closed, read back, and verified against that verifier before commit. Failure rolls back the database transaction. If commit outcome cannot be determined after a connection failure, the file is retained pending reconciliation. The command never prints the credential or accepts it through process arguments.

The success transaction records owner decision reference and safe events for request, authorization, exceptional recovery use, principal creation, each grant, credential issuance, recovery credential revocation, and completion. The existing immutable audit trigger remains in force. No secret, verifier, or database URL enters audit metadata.

## Operation, replacement, and residual risk

In local development, the command reads recovery proof from `.dev-runtime/foundation-bootstrap/platform-admin.recovery.credential` and delivers the new credential to `.dev-runtime/foundation-bootstrap/oic-foundation-operator.credential`. The ignored directory must have a private ACL; the command rejects an unsafe Windows ACL. The recovery credential must not be loaded into Console or normal API configuration. The operational administrator may rotate its credential and establish an application-owned successor through audited Foundation operations; the successor verifies before the old credential is revoked and old principal suspended. Lost access after the one-time transition requires a separately authorized recovery decision, not a repeat bootstrap.

A trusted deployment operator with database and recovery access remains powerful. The normal administrator holds evaluation scopes because the current grant policy requires them; its credential must be reserved for identity administration. An administrator who can issue credentials for the OIC-7 runner and publisher can impersonate those principals, so custody and audit review remain required.

**Migration:** Required only in the OIC-owned database. No Responix schema or behavior changes are authorized. No OIC-7 canary is authorized by this amendment.
