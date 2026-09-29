# MOD-1 Universal Provider Architecture Contract

**Status: APPROVED / LOCKED**

**Decision authority:** project owner decision lock supplied 2026-09-29

**Repository baseline:** branch `frontend`; HEAD `ad0ec577401304d766dc8e9e9d0193e956afce45`, equal to `origin/frontend`.
**Sprint 1 feature commit:** `ea5b82831e72efaca6efc178baac12f06ae43900`.

This document records the project owner's locked MOD-1 decisions. It authorizes implementation planning against this contract; it does not itself implement code, settle a physical schema design, or authorize private-network access. Physical schema and API details identified below remain implementation-design decisions constrained by this contract.

## 1. Relationship to Sprint 1 and program charter

MOD-1 is the first program initiative after Sprint 1 in the approved pre-CRM order in `MEGA_MODIFICATION_CONTINUATION_CHARTER.md`. Sprint 1 remains closed as **COMPLETE WITH DOCUMENTED EXCEPTIONS**. Its provider registry, workspace-scoped configuration, encrypted credentials, discovery, deterministic routing, retries/fallback, invocation, secure provider HTTP, and existing fixed adapters are the compatibility baseline.

This is a detailed contract that resolves the previously recorded roadmap-level provider questions; the charter's instruction to obtain a bounded contract before implementation is therefore satisfied. It does not contradict the charter's MOD-1 scope or dependency order. No genuine contradiction with the charter or Sprint 1 closure was found; Sprint 1's narrower scope is the preserved baseline this contract extends.

MOD-1 completes the broader provider architecture without reopening Sprint 1 or changing its accepted behavior. MOD-2 owns production custom-model lifecycle and catalog synchronization. MOD-3 owns final Provider Dashboard redesign. CRM remains after MOD-10 closeout.

## 2. Product scope and provider classes

### Built-in native providers

- Provider definitions and native adapter bindings are platform-owned.
- Native adapters are reviewed code, registered through the application adapter registry, and delivered through a release.
- A database provider definition alone never proves that executable behavior exists.
- Existing provider IDs, names, and adapter bindings remain valid.

### Approved OpenAI-compatible providers

MOD-1 approves the explicit **OpenAI Chat Completions Compatible V1** protocol defined in §6. A workspace may define a Custom Provider using this already-approved protocol. Compatibility is established by the protocol contract and successful validation, never inferred from a vendor's marketing claim.

### Custom Providers

“Custom Provider” means a workspace-defined provider endpoint bound to an already-approved protocol adapter. Subject to the protocol contract, its definition may include display name, protocol identifier, public HTTPS base URL, encrypted workspace credential, validation model ID, and protocol-supported configuration.

It does not permit arbitrary methods, request templates, URL templates, arbitrary headers, uploaded/runtime code, arbitrary adapters, or unrestricted network access. A new native protocol requires a reviewed adapter and release.

### Local, private, and self-hosted providers

Ollama, LM Studio, vLLM, private inference services, and other private/self-hosted providers remain in product vision, but are **not authorized in the initial public-endpoint MOD-1 implementation**. They are gated by a later bounded **Private / Self-hosted Provider Network Security Contract**. Until separately approved, all current local/private/loopback/link-local/metadata rejection remains in force. There is no localhost exception, RFC1918 exception, bypass, or insecure-provider toggle. They are deferred behind the gate, not cancelled.

## 3. Ownership and catalog/configuration/credential/adapter separation

Ownership is hybrid and the platform catalog lifecycle remains separate from workspace configuration lifecycle.

1. **Provider definition/catalog:** built-in/native definitions are platform-owned. Workspace Custom Provider definitions are workspace-owned and limited to approved protocol bindings. Model catalog synchronization and production custom-model lifecycle belong to MOD-2.
2. **Workspace configuration:** workspace-owned enablement and protocol-supported settings for a provider, including the authorized public endpoint where applicable.
3. **Credential:** workspace-owned, encrypted credential material. Plaintext is available only during immediate use and must not enter discovery, API responses, audit values, or logs.
4. **Executable adapter:** platform-approved, statically registered executable implementation resolved through an explicit, stable protocol identifier. User data cannot install or supply executable behavior.

Provider execution must no longer depend solely on `providerName` implicitly identifying executable behavior. Persisted architecture must be able to represent provider kind/type, approved protocol binding, and ownership/scope where needed. This contract does not prescribe a table or column layout. A provider with missing, unsupported, or unregistered protocol binding fails closed and is not advertised as usable or routed.

## 4. Lifecycle contract

### Global/built-in catalog

The platform owns global provider definitions. Supported lifecycle states include active, deprecated, and archived. Exact transition mechanics must preserve existing records and historical references. Platform-admin lifecycle operations require explicit permissions; use an existing permission only if semantically correct, otherwise define a new platform-admin permission explicitly.

### Workspace Custom Provider

Workspace lifecycle supports create/register against an approved protocol, configure, enable, disable, update allowed configuration, replace credential, user-triggered validate, archive, and safe restore. Workspace ownership and authorization must be checked on every operation. Permanent deletion must not break invocation history, agent/model references, audit history, or accounting/history; prefer archive/soft lifecycle when references exist.

The present REST API has workspace-scoped discovery, get/configure configuration, and validation routes. Workspace registration is approved. Any additional registration/lifecycle API must follow established REST, tenant-context, validation, permission, and audit conventions. Exact route shape and any new platform-admin permission are implementation-contract subdecisions; this contract does not invent route names.

## 5. Persistence requirements

The current Prisma schema includes global `AiProvider` and `AiModel`, workspace-scoped `AiProviderConfiguration` and `AiProviderCredential`, and workspace-scoped `AiProviderHealthRecord`. Current persisted execution binding is effectively inferred from provider name through the registry.

Persistence must explicitly represent provider kind/type, approved protocol binding, and ownership/scope where necessary. The implementation-design step must inspect the current schema and choose the smallest backward-compatible representation. A migration is allowed only if the existing persistence cannot safely express the approved contract.

If a migration is necessary, it must include deterministic backfill for every existing provider and preserve provider IDs/names, configurations, credentials, model references, Agent selections, routing behavior, and historical references. State migration risk, defaults, rollout/rollback compatibility, and why an application-owned mapping is insufficient before implementation. This contract does not lock a specific schema design. Production custom model persistence and lifecycle remain MOD-2.

## 6. OpenAI Chat Completions Compatible V1

Stable semantic protocol identifier: **`openai-chat-completions-v1`**. The exact code representation may follow repository conventions; semantic identity and version must remain explicit and stable.

Adapter resolution is:

**provider definition → approved protocol identifier → registered executable adapter**

It is never **provider display/name → trusted executable behavior**. Existing built-in adapter names remain backward compatible.

Protocol scope:

- POST only, through the existing provider secure HTTP boundary.
- Fixed Chat Completions-shaped request and response contract using messages, model ID, and bounded maximum output tokens.
- Normalize response content and usage when returned; validate structure and token bounds; map provider errors to normalized internal errors without exposing secrets or raw sensitive payloads.
- Optional SSE streaming only when the provider declares the capability and it is verified against the V1 stream contract, including terminal completion and partial-output rules.
- Optional tool/function calling only when declared and verified against the supported normalized function-tool contract.
- Unsupported protocol, feature, or malformed response behavior fails closed.
- Generic Responses API, arbitrary request templates, arbitrary HTTP methods, and arbitrary headers are excluded.

Implementation details such as precise field allowlists, normalization edge cases, error mapping table, capability verification evidence, fixed path construction, auth header form, and stream terminal rules must be specified in the bounded implementation design while conforming to this V1 scope and existing shared transport. Validation uses the no-tools, no-streaming path in §8.

## 7. Public-host authorization and security contract

Workspace Custom Providers may target **public HTTPS hosts**. Saving/configuring a custom provider must establish an explicitly authorized, workspace-scoped destination under the existing provider destination-security model.

- Require HTTPS and exact hostname authorization; no wildcard hostname grants or arbitrary CIDR grants. The approved exact workspace-scoped hostname grant is the specific authorization for that endpoint; implementation must extend the current platform host-allowlist mechanism if needed, without bypassing destination policy.
- Enforce an exact approved port where applicable.
- Do not implicitly permit private-network access. Reject loopback, private, link-local, metadata, reserved, and otherwise disallowed resolved addresses.
- Resolve DNS and pin the validated address for each outbound request; reject unsafe/mixed resolution according to the existing policy. Do not permit DNS rebinding to bypass validation.
- Do not follow redirects. Apply destination validation to configuration and again to every provider request, including Test Connection.
- Never place credentials in URL paths or query strings. Reject credential-bearing endpoint query parameters; permit only protocol-approved authentication headers.
- Preserve TLS certificate validation, connection/read/provider timeouts, response-size limits, abort handling, workspace authorization, tenant isolation, encrypted credentials, immediate-use handling, redacted errors/logs, and audit trails.
- Audit changes to workspace-authorized destinations. Do not log credential values or sensitive request/response bodies.
- Test Connection is user-triggered, bounded, rate-limited, and uses the same destination security and secure transport as normal invocation.

If the current host-allowlist mechanism cannot safely represent exact workspace-approved public hosts, implementation must extend that mechanism with scoped authorization and auditing. It must not bypass `ProviderDestinationPolicy` or weaken platform restrictions. Any change to public-destination governance must receive security review within the implementation contract.

Private/self-hosted support requires the later network-security sub-contract. No private access is implemented by MOD-1's initial public-endpoint unit.

## 8. User-triggered validation contract

Validation is explicitly initiated by an authorized user. MOD-1 adds no periodic probing or continuous health worker.

Each validation:

- targets exactly the provider and workspace configuration requested;
- uses exactly one selected credential, with no rotation and no provider fallback;
- uses the configured validation model ID for a Custom Provider, or an existing known model for a built-in provider;
- performs one minimal invocation with a very small bounded output;
- uses no streaming, tools, Guard behavior, fallback, or retries/credential rotation;
- uses existing timeout and response-size controls and destination authorization;
- is rate-limited and audited;
- records success/failure, latency, and normalized error without secrets;
- updates existing validation/health evidence only according to its existing semantics.

Implementation must ensure the validation path makes exactly one provider invocation attempt; generic invocation retry/fallback behavior must not add attempts to Test Connection.

For a Custom Provider, the validation model ID is validation-only. Successful validation does not create an `AiModel`, make that model selectable by Agents, or include it in routing. Provider-side usage/cost is borne by the customer/provider account and must remain minimal. A validation result is not continuous provider health monitoring.

## 9. API principles

Reuse existing workspace provider discovery/configuration/validation capabilities where their semantics fit. Preserve authenticated tenant context and permission checks; never trust a workspace identifier supplied in request data in place of server tenant context. Catalog lifecycle and workspace configuration must remain distinct.

Any genuinely new API capability must specify purpose, platform/workspace scope, actor permission, request/response semantics, validation, audit behavior, and backward compatibility. A new platform-admin permission must be explicit. Generated API files may be refreshed only through the official generation process after an approved API contract change.

## 10. Backward compatibility

Preserve all working Sprint 1 provider state without forced reconfiguration:

- existing `AiProvider` IDs and names and registered adapter names;
- provider configurations and endpoint settings;
- encrypted credentials and their workspace/provider associations;
- persisted models, IDs, references, and Agent selections;
- routing eligibility and deterministic ordering, retry/fallback, invocation, accounting, and history.

Backfill explicit protocol/kind/ownership representation deterministically. Preserve existing built-in behavior through explicit mappings. Unknown bindings fail closed without exposing unusable providers, and rollout must not silently reinterpret an existing provider.

## 11. Future extension model

- A provider using an already-approved protocol can be added as a constrained provider definition bound to that registered adapter, after endpoint authorization and validation.
- A provider requiring a new native protocol needs reviewed adapter code conforming to the normalized contract, registration through the platform's static adapter mechanism, tests, security review, and release.
- Runtime-installed native adapters, user code, plugin loading, marketplace installation, and automatic provider installation are not supported or implied.
- Local/private/self-hosted endpoints remain gated by the separate security contract.

## 12. Out-of-scope items

MOD-1 does not include production custom-model CRUD, catalog synchronization/vendor refresh, final model lifecycle, final Provider Dashboard redesign, continuous health worker, full credential balancing, cost/speed/quality routing, provider marketplace, automatic installation, arbitrary runtime adapter plugins, Guard, queue, or CRM. These remain assigned to later MODs/contracts.

Private/self-hosted providers remain in product vision but gate full MOD-1 product-completion claims. MOD-1 closeout must either have completed the later private-network security contract and implementation, or record an explicit human-approved documented exception. They are not silently counted as cancelled or complete.

## 13. Recommended implementation units

These units are ordered implementation planning within the locked contract; this contract-lock task does not begin them.

1. **Persistence and adapter-resolution design:** inspect Prisma and migrations; choose minimal compatible representation for provider kind, protocol and ownership; deterministic legacy mapping; fail-closed resolution by protocol while retaining name compatibility.
2. **Scoped public destination authorization:** extend the existing destination policy to support exact workspace-scoped public hostname/port grants, validation, audit and safe revocation without weakening global DNS/IP/TLS protections.
3. **Custom Provider registration/configuration lifecycle:** implement workspace ownership, approved protocol binding, configuration, credentials, enable/disable, archive/restore and authorization/audit behavior. Keep platform catalog lifecycle separate.
4. **Generic Chat Completions V1 adapter:** implement only the fixed V1 invocation contract using shared secure transport; no Responses API or arbitrary request construction.
5. **Validation flow:** implement the user-triggered, one-credential, one-minimal-request contract and its rate limit, audit and health evidence.
6. **Discovery/routing integration:** advertise and route only approved, executable, configured providers; ensure validation-only model IDs never enter production model selection or routing.
7. **Compatibility/security closeout:** regress current providers and persisted state, complete focused security review, update API/ADR/project-state documentation and official generated types if API changes.

## 14. Focused test requirements

For later implementation, add focused evidence (not necessarily full suites) for:

- explicit protocol resolution, deterministic legacy backfill/mapping, duplicate/unknown protocol fail-closed behavior, and no name-based custom execution or dynamic loading;
- workspace ownership and permission enforcement for registration/configuration/archive/restore, platform catalog separation, audit and cross-workspace isolation;
- exact-host/port workspace authorization; HTTPS enforcement; public versus loopback/private/link-local/metadata/reserved IPv4 and IPv6; DNS mixed answers and rebinding pinning; redirect rejection; TLS validation; query-secret rejection; timeout, response-size, abort and rate limits;
- generic V1 request/path/auth contract, bounded tokens, normalized success/error/usage, invalid payloads, tool-call capability gate, SSE capability/terminal behavior, and no unsupported Responses API behavior;
- validation uses one credential/model/request and never fallback, rotation, streaming, tools, or Guard; minimal output; safe audit/health/error and no secret leakage;
- backward compatibility for every current adapter, existing provider/configuration/credential/model/Agent reference, deterministic routing and Sprint 1 invocation semantics;
- database migration/backfill and historical-reference behavior only if an approved schema migration is shown necessary;
- generated API parity via official generation only if public API contracts change.

## 15. MOD-1 acceptance gates

MOD-1 is complete only when all applicable gates are evidenced:

1. This product, protocol, ownership, lifecycle, validation, and security contract is the implementation authority; any change has explicit human approval.
2. Provider kind/protocol/ownership are represented explicitly in persistence or a proven safe platform-owned mapping; adapter resolution is deterministic and unsupported providers fail closed.
3. Existing Sprint 1 providers and state work without forced reconfiguration and preserve IDs, names, models, Agent selections, routing, and invocation behavior.
4. Workspace Custom Providers bind only to approved protocols and public HTTPS destinations explicitly authorized for that workspace.
5. DNS pinning, public-address restrictions, private/metadata protection, TLS, redirect rejection, timeout/response-size limits, credential encryption/redaction, tenant isolation, audit, and validation rate limits have focused evidence.
6. Generic V1 behavior matches the fixed contract; undeclared/unverified streaming or tools are unavailable; no Responses API or arbitrary HTTP behavior is included.
7. Validation meets §8 and validation-only models do not enter production catalog, Agent selection, or routing.
8. Any schema or API change has documented purpose, compatibility, migration/API review, permissions, and official generated API refresh where applicable.
9. Focused regression and security evidence is recorded; architecture decisions and project-state/API documentation are reconciled; exceptions are explicit.
10. MOD-2/MOD-3 and later features are not misrepresented as delivered.
11. The private/self-hosted security gate is completed before claiming full provider-vision completion, or an explicit human-approved exception is recorded at closeout.

## 16. First implementation unit recommendation

**Recommend Unit 1: persistence and adapter-resolution design.** It should determine whether a platform-owned explicit mapping is sufficient or whether a minimal schema migration is necessary, then specify deterministic backfill and compatibility before code. The public-host grant design is the next security-sensitive dependency. No implementation is performed by this contract-lock task.

## Unit 1 persistence decisions

- Custom Provider display names retain their user-facing form. Uniqueness uses NFKC normalization, trim, collapse Unicode whitespace to one ASCII space, then locale-independent lowercase; punctuation and accents are preserved. `(workspaceId, normalizedName)` is unique, including archived definitions, and a rename collision is a deterministic conflict with no automatic suffix.
- Custom Provider credentials use a dedicated persistence relation with an enforced composite workspace/provider foreign key. Polymorphic or unenforced provider references are prohibited. Credential handling reuses encryption, fingerprinting, metadata-only listing, deterministic priority/last-use ordering, and immediate-use decryption.
- The smallest safe representation is a separate workspace-owned Custom Provider definition and dedicated credential relation. Global built-in `AiProvider` rows remain unchanged and use a platform-owned explicit legacy mapping. A schema migration is required; these decisions do not prescribe table names beyond the implementation record or authorize applying it to a database.

These decisions refine the persistence and adapter-resolution design for Unit 1 without changing the MOD-1 product or protocol contract above.

## 17. Evidence references

- `docs/project-state/MEGA_MODIFICATION_CONTINUATION_CHARTER.md` — approved pre-CRM MOD order and contract-before-code rule.
- `docs/project-state/SPRINT_1_UNIVERSAL_PROVIDER_PLATFORM.md` — Sprint 1 implementation boundary, exclusions, closure and compatibility baseline.
- `docs/project-state/ARCHITECTURE_DECISIONS.md` — ADR-013 provider/credential boundaries; ADR-014 deterministic provider-neutral routing; ADR-019 and ADR-021 channel-runtime boundaries.
- `apps/api/src/modules/ai/providers/provider.registry.ts`, `provider-adapter.interface.ts`, `provider.factory.ts`, `ai.module.ts`, `provider-management.service.ts`, `provider.repository.ts`, `provider-configuration.repository.ts`, `provider-credential.service.ts`, `credential.repository.ts`, and `provider-discovery.service.ts`.
- `apps/api/src/modules/ai/providers/openai-compatible.ts`, `openai-compatible-stream.ts`, built-in provider adapters, and `apps/api/src/modules/ai/security/provider-destination-policy.service.ts`, `provider-dns-resolver.service.ts`, `provider-http-client.service.ts`, and `provider-credential-crypto.service.ts`.
- `apps/api/src/modules/ai/ai.controller.ts` and `apps/api/src/modules/ai/dto/provider-configuration.dto.ts` — current route, permission, request and response conventions.
- `packages/database/prisma/schema.prisma` — `AiProvider`, `AiModel`, `AiProviderConfiguration`, `AiProviderCredential`, and `AiProviderHealthRecord`.
- Official Technical Documentation DOC 24, DOC 25, DOC 38, DOC 39, DOC 15, and DOC 16. These describe broader goals and platform principles; this contract's explicit project-owner decisions control MOD-1 where those documents do not define the detailed behavior.
- Baseline commits `ea5b82831e72efaca6efc178baac12f06ae43900` (Sprint 1 feature) and `ad0ec577401304d766dc8e9e9d0193e956afce45` (validation checkpoint).

## 18. Units 2–4 implementation evidence (working tree, uncommitted)

This section records implementation evidence only; it does not revise the locked product or protocol decisions above.

- Unit 2 extends `ProviderDestinationPolicy` and the existing `ProviderHttpClient`. Custom endpoints are DNS/public-address validated before persistence; each custom outbound request requires an active definition found by both provider ID and workspace ID, checks the saved exact HTTPS origin and persisted capability flags, resolves DNS again, validates every result, and pins the selected public address. SSE remains on the existing transport and now enforces the configured response-byte limit. IPv6 special-use handling rejects `2001::/23` and `3fff::/20`.
- Unit 3 adds workspace lifecycle routes under `/api/v1/ai/custom-providers`. Providers are created disabled, protocol switching is excluded from updates, enable requires a valid public endpoint and active credential, restore returns the same ID as disabled, and archive retains the workspace name reservation. Credential writes reuse the Unit 1 encryption/fingerprint service; API and audit output contain only non-secret metadata, without plaintext, ciphertext, or key fingerprints.
- Unit 4 statically registers `openai-chat-completions-v1`. Its single path rule treats configured base URL as the API root and appends `/chat/completions`; authentication is Bearer; optional tools/streaming require both declared capability metadata and policy verification against persistence. This does not connect Custom Providers to production Agent routing.
- `packages/database/prisma/migrations/000041_custom_ai_provider_definitions/migration.sql` was not edited. Additive false-default capability columns and a safe `DISABLED` database default are in `packages/database/prisma/migrations/000042_custom_ai_provider_capabilities/migration.sql`. No migration was applied.
- Focused implementation and security test evidence is in `apps/api/src/modules/ai/security/provider-destination-policy.service.spec.ts`, `provider-http-client.service.spec.ts`, `apps/api/src/modules/ai/providers/custom-provider-*.spec.ts`, `openai-chat-completions-v1.adapter.spec.ts`, and `apps/api/src/modules/ai/custom-provider.controller.spec.ts`.
- Official API-client regeneration remains pending because the repository generator fetches the live backend `/docs-json` endpoint; no generated API file was manually edited.
- The formal user-triggered Test Connection flow, production routing integration, compatibility/security closeout, and the private/self-hosted security gate remain incomplete.

## 19. Approved MOD-1 closeout

The project owner approved MOD-1 public-provider scope as **COMPLETE WITH DOCUMENTED EXCEPTION** on 2026-09-29. Unit 5 Test Connection and the compatibility/security closeout are complete as recorded in [`MOD_1_CLOSEOUT.md`](MOD_1_CLOSEOUT.md) and [`VALIDATION_HISTORY.md`](VALIDATION_HISTORY.md). This closeout supersedes the pending/incomplete statements in §18 and the private/self-hosted gate language in §12/§15: private/local/self-hosted support remains in product vision, is not cancelled or implemented, and is deferred behind a separate human-approved network/security contract. MOD-1 does not include MOD-2 catalog lifecycle or synchronization, MOD-3 dashboard redesign, continuous health, balancing, routing optimization, Guard, or CRM.
