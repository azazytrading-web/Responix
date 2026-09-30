# OIC — Oi Intelligence Core Master Architecture Charter

**Status:** APPROVED / LOCKED
**Authority:** Owner's OIC Master Architecture Human Decision Lock, 2026-09-30
**Initial baseline:** `79f7230ca51da60f950d21f3bc26a0b673658c93`
**Scope:** Product and architectural boundaries. This charter does not authorize any specific implementation phase without its bounded contract and acceptance criteria.

## 1. Product identity and ownership

Oi Smart Solutions owns OIC, Responix, Oi Trading Follow, Leviathan, and future products as peer systems. OIC is the company-wide reusable intelligence platform. Responix is its first consumer; OIC is not a Responix module or child product.

The governing principle is **one intelligence core, many products**. Reusable intelligence belongs in OIC when it can be safely shared. Product-specific business rules, customer relationships, and private product data remain with the product that owns them. Shared intelligence does not authorize shared customer data.

OIC is intended to evolve over time. Keep a small stable kernel and contracts, with replaceable and versioned engines behind them. Do not optimize the architecture only for current Responix requests.

## 2. Responix preservation contract

OIC integration must preserve Responix as a complete customer-experience and automated-response product. Responix permanently retains ownership of:

- Workspaces, memberships, Agents, conversations, messages, conversation history, and customer data.
- Responix Memory layer/runtime, Responix Knowledge Base, product RAG workflows, and product tools/actions.
- CRM, workflows, human handoff, and channel-specific business behavior.
- Channels, Channel Protection Guard, queues, scheduling, typing/read/presence, humanization, serialization, and delivery behavior.

OIC may reuse patterns and generic algorithms, extract genuinely generic libraries after boundaries are understood, build independent equivalents, or consume authorized Responix context through explicit contracts/connectors. Avoid blind permanent duplication, but do not erase product ownership to reduce duplication.

OIC must not become the owner of Responix business state, directly access Responix tables, or make Responix directly access OIC tables. OIC adoption must not reduce Responix to a thin gateway.

## 3. Memory, history, and knowledge ownership

The following are distinct ownership and access boundaries:

- OIC Core Intelligence Memory.
- OIC Application Memory.
- Responix Product Memory.
- Tenant/workspace memory.
- User/entity/conversation memory.

Responix's current memory remains Responix-owned. OIC Core Memory contains only controlled company-intelligence assets promoted through an approved learning pipeline. Raw production interactions never enter OIC Core Memory automatically.

Responix remains source of truth for conversations, messages, customer interaction history, and Agent/channel events. OIC owns separate intelligence/runtime history: execution traces, evaluation and experiment history, learning/promotion history, and model revision/release history.

The Responix Knowledge Base remains a Responix capability and data store. OIC develops reusable knowledge/retrieval intelligence independently. Authorized product knowledge can be supplied by bounded context, an authorized connector, or a retrieval contract. No bulk migration or ownership transfer is approved.

## 4. OIC architecture

### 4.1 Logical planes

OIC has two logical planes. They may initially share a deployable where operationally appropriate; the boundary must remain explicit.

**Control Plane:** Applications and Service Principals; provider/connection administration; upstream catalog administration; Oi Models, revisions, variants and releases; policy, entitlement and quota configuration; evaluations, plans and economics.

**Runtime Plane:** request intake and identity resolution; Oi Model/release resolution; policy and resource checks; Context Compiler; memory, knowledge/retrieval and tool interfaces; internal intelligence; provider routing and inference; unified result, usage, trace and audit events.

Do not introduce a distributed service topology before deployment and scaling evidence requires it.

### 4.2 OIC Kernel

Keep the kernel small and relatively stable. Its responsibilities are:

- Authenticate application/service identity and carry tenant/resource scope.
- Establish request, idempotency, trace and compatibility versions.
- Resolve requested Oi Model and approved release binding.
- Resolve applicable policy, entitlement, quota and resource budget.
- Coordinate the execution lifecycle through versioned engine interfaces.
- Return a unified result, error, usage and trace envelope.

The kernel is not a provider-specific switchboard, business-logic container, or substitute for replaceable intelligence engines.

### 4.3 Application and tenant identity

OIC identity is independent of Responix Workspace:

`Organization → Application → Tenant → Actor/Entity → Conversation/Resource`

Responix is an OIC Application; a Responix workspace maps to a tenant within that application. Future products receive distinct application identities. Each application has explicit principals, credentials, model entitlements, tool/memory/knowledge namespaces, resource policy, quotas, security policy, and observability scope.

### 4.4 Security and Service Principals

Non-human consumers require explicit Application and Service Principal identities. Credentials are scoped, revocable, rotatable, audited, and limited by scopes, models, tools, tenants and resource policy. A leaked application credential must not grant access to all OIC resources.

Human operator access and machine-to-machine identity are separate authorization flows. OIC secrets remain within OIC provider-security boundaries; they are not returned to consumers or exposed through product databases.

### 4.5 Provider Fabric and Connections

OIC owns provider runtime infrastructure. The conceptual relationship is:

`Provider Definition → Provider Connection → Authentication Strategy → Transport Profile → Connection Entitlements → Upstream Models`

Connections may be PLATFORM scoped or explicitly APPLICATION/TENANT/WORKSPACE BYOS scoped. Credentials remain under OIC security boundaries. Connection availability, entitlement, billing/usage profile and transport capability are distinct from upstream model identity and model capability.

Adapter execution remains behind reviewed versioned interfaces. Provider identity is hidden from normal product/customer contracts. Private/local/self-hosted provider support remains behind its separately approved network/security contract.

### 4.6 Upstream Model Catalog

MOD-2 Sprint A `AiModel` is the foundation for the **upstream provider model catalog**. It represents provider-side models and their catalog evidence. It does not represent Oi proprietary model products.

Preserve the accepted MOD-2 contract, IDs, migration and history. Keep provider capabilities and pricing evidence distinct from final runtime capability, connection availability, OIU metering, billing and customer economics.

### 4.7 Oi Model Fabric

Oi Models are first-class Oi Smart Solutions products with identities independent of upstream providers. The approved conceptual hierarchy is:

`Product/Family → Edition/Specialization → Revision → Implementation Variant → Runtime Binding`

Do not lock public naming syntax in this charter. An Oi Model identity remains stable when an implementation changes. A revision describes evaluated behavior; variants implement that behavior through upstream or internal components; runtime bindings select approved releases for environments or policy scopes.

Model lifecycle is separate from upstream AiModel lifecycle. A proposed lifecycle for phase review is draft, experimental, candidate, canary, production, maintenance, deprecated, retired; exact transitions and vocabulary require the phase contract. Rollback uses previously approved release bindings.

### 4.8 Specialization and portfolio

Specialization is core Oi Model functionality. An Edition/Specialization Profile may define domain, instructions, knowledge and tool requirements, memory/retrieval profile, resource policy, evaluation suite, and release thresholds. Use a derivative/fork only where behavior or specification ownership meaningfully diverges.

The portfolio supports research, experimental, candidate, production, premium, specialized, maintenance, deprecated and retired models concurrently. Research/development must not destabilize existing production identities.

### 4.9 Model Factory, Evolution Lab, and Evaluation

The Model Factory and Evolution Lab are core OIC pillars, delivered iteratively. Their eventual flow covers behavior specification and assets, prompt/policy/model optimization, implementation variants, evaluation, red team, shadow, canary, promotion, monitoring, evolution and retirement. “Training” includes more than fine-tuning, but provider terms must separately permit any use of data.

Evaluation is first-class and versioned. OMI summarizes product quality; domain scores preserve dimensions such as language, customer service, finance, trading, tool use, memory, RAG, reliability, safety and efficiency; OES expresses quality relative to resources. Provider brand earns no quality credit. Formulae, thresholds, evidence requirements and statistical policy belong in bounded evaluation contracts.

### 4.10 Internal intelligence and external dependency

OIC must progressively develop internal intelligence and reduce reliance on external inference while preserving quality, safety, reliability, latency and domain scores. External models can serve as escalation or teacher resources where authorized; OIC should not remain only a routing gateway.

EIDR (External Intelligence Dependency Ratio) is an approved metric direction. Define its denominator, weighting, versioning and companion quality/safety measures before using it as a release objective. Internal/student paths may begin with specialized components and later include validated small/open-weight or Oi-owned models. No foundation LLM is assumed at launch.

### 4.11 Context, efficiency and cache

The Context Compiler is a core engine. It compiles the minimum effective runtime context from model revision, application and tenant policy, authorized memory/knowledge, tools, conversation and current request. Each injected item has a scope, provenance, reason and budget.

Keep stable, semi-stable and dynamic context conceptually separate; translate provider-specific caching only at adapters. The Efficiency & Cache Engine is a core pillar covering token/context budgets, compiled artifacts, prefix reuse, memory/retrieval compression and safe cache strategies over time.

Cache scope includes all security-relevant application, tenant, actor/resource, version and policy dimensions. Cross-tenant semantic cache reuse is prohibited by default. Dynamic user state and product data must not leak into reusable static artifacts.

### 4.12 Memory and controlled learning

OIC Core, OIC Application, Responix Product, tenant/workspace, and user/entity/conversation memory are strictly separated namespaces and access controls. Database, authorization, retrieval and cache design must enforce the distinctions.

Learning is controlled and versioned:

`Production Signals → Candidate Asset → Sanitization/Privacy Review → Deduplication/Quality Filtering → Evaluation → Required Human/Policy Gate → Core Learning Asset`

No automatic production-to-core-memory path or uncontrolled self-modification. Every promoted change is observable, reversible and associated with evidence.

### 4.13 Knowledge and Tool Fabric

OIC owns reusable retrieval capability; applications and tenants own their authorized knowledge namespaces and content. Retrieval implementations can evolve behind contracts. No Responix knowledge bulk migration is approved.

OIC owns shared tool contracts, registration metadata, eligibility, permission resolution and orchestration. Products retain actual product/domain operations unless explicitly promoted as shared Oi services. Namespaces and authorization are application-, tenant- and actor-aware. OIC receives no arbitrary product database access.

### 4.14 Routing and runtime bindings

Resolve an entitled Oi Model to an approved revision and binding, then choose eligible variants/connections under policy, resource, quality and cost constraints. Persist protected resolution/trace evidence. Reuse MOD-1 deterministic eligibility and ordering principles while routing Oi Model implementations rather than exposing upstream identity to consumers.

No silent paid fallback, unexpected cost increase, or automatic customer repricing. Degradation and fallback policies must be explicit and auditable.

### 4.15 OIU, quota, entitlement, plans, billing and economics

Oi Units (OIU) are a core versioned intelligence-consumption unit, not simply tokens or messages. Preserve raw usage facts and historical accounting as conversion rules evolve.

Keep four concepts separate:

- **Metering:** what was consumed?
- **Quota:** how much may be consumed?
- **Entitlement:** what can this application/tenant use?
- **Billing:** what is commercially charged?

Plans and plan versions map price, entitlement, quota and effective dates. Economics may calculate COGS, costs, margin, break-even and price recommendations, but recommendations do not automatically alter customer prices. Provider model-price metadata is distinct from connection billing/usage profiles, BYOS and OIU/customer economics. ChatGPT Plan usage is not “free.”

### 4.16 APIs and compatibility

The OIC Native API is canonical. Consumers request an Oi Model and provide authorized request/context references; OIC resolves implementation details and returns a unified result. Exact DTOs are set by the implementation contract.

The OpenAI Compatibility Gateway is required foundation scope, above the OIC runtime. Its initial surface is based on actual Oi application needs and must explicitly support or reject endpoints/features such as `GET /v1/models`, chat completions, responses and streaming. It exposes only entitled Oi Models/aliases, not upstream provider models by default. Compatibility translation must not become OIC's internal architecture.

Application-specific legacy aliases may be explicit, scoped and auditable; global ambiguous aliases are prohibited.

### 4.17 Observability, isolation and versioning

Observability follows OIC → Application → Tenant → Oi Model/Revision → Variant → Route/Connection. Track OIU, latency, quality/evaluation signals, cache effectiveness, provider usage, fallback, EIDR, costs, errors and tool/retrieval activity. Do not log secrets or raw sensitive payloads by default.

Carry organization/application/tenant/workspace/actor/entity/conversation/resource scope through storage, authorization, cache, retrieval, audit and telemetry. Missing or inconsistent scopes fail closed.

Version native APIs, compatibility behavior, kernel/engine interfaces, model revisions, evaluation suites, tool contracts, OIU conversions and runtime bindings independently with explicit compatibility/deprecation policy.

## 5. Persistence, deployment, and Responix integration

OIC owns its persistence, schema and migrations. Preferred initial production-development topology is a separately permissioned OIC database on approved PostgreSQL infrastructure when practical. A transitional shared server/database setup still requires explicit OIC schema, credential and migration ownership. Responix has no direct OIC table access; OIC has no direct Responix table access. Move interaction toward APIs, SDKs and explicit contracts.

Keep OIC and Responix logically separate in the same repository initially. Progress from logical ownership → stable contracts → independent deployability → optional physical extraction. No second repository or big-bang rewrite is approved.

### 5.1 Unified-by-default deployment clarification (APPROVED / LOCKED, 2026-09-30)

OIC and Responix are independently designed services/products, but they are not required to run on separate physical servers. The default Oi deployment topology is a unified/co-hosted platform deployment: one Oi platform server or deployment stack may contain shared ingress/reverse proxy and frontend/control surfaces, Responix API/runtime, OIC API/runtime, product workers, and appropriate shared infrastructure.

Co-hosting does not change service or data ownership. Responix and OIC retain separate application/service boundaries, database ownership, and security identities. Neither product owns the other's tables; communication crosses approved APIs and contracts. Responix consumes OIC through the OIC contract/API boundary. OIC's database is never merged into the Responix database, and OIC runtime code is not merged into the Responix API.

The locked principle is **independent by design, unified by default deployment, separable when scale requires**. Independent deployability remains a capability; future scaling may place OIC, Responix, databases, or workers on separate machines or clusters without redesigning product boundaries. The normal operator experience should ultimately start/deploy the Oi platform as one stack. A future Platform Deployment / Integration gate owns orchestration; this clarification does not add deployment implementation to OIC-2.

### 5.2 Customer exposure boundary (APPROVED / LOCKED, 2026-09-30)

OIC is an internal Oi Smart Solutions platform capability and is never a customer-facing product surface under the current approved architecture. Normal Responix customers do not log into OIC, receive OIC or Service Principal credentials, call OIC administration or Native Runtime APIs, or call the OIC OpenAI Compatibility Gateway. They do not see OIC provider connections, upstream provider identities, Oi Model implementation details, or OIC memory/factory/evaluation internals.

Oi operates the central platform and its internal control dashboard. A future standalone Responix customer application is a separate product deliverable; it connects only to the product-facing Responix API over HTTPS, and Responix calls OIC internally when needed. Customer-visible pages, features, permissions, and data are server-authorized for the customer/workspace; hiding frontend code is not authorization. Customers never receive OIC credentials.

If Oi sells API access later, the customer-facing edge remains an Oi/Responix product API or another explicitly approved public API product. A commercial API offering does not grant direct OIC access. No customer-facing OIC product is approved by this lock; changing that requires a new explicit owner decision.

Responix invokes OIC and receives intelligence results, then continues its own Agent/conversation/product and channel lifecycle. OIC does not own Responix channels, customer experience or delivery.

## 6. Reuse of completed MOD work

MOD-1 supplies reviewed provider adapters, credentials, security and Custom Provider foundations; its private/local/self-hosted exception remains subject to a separate security contract.

MOD-2 Sprint A supplies the accepted upstream catalog foundation and compatibility safeguards. MOD-2 Sprint B requirements (discovery, sync, merge authority, history, validation and operational evidence) become OIC-owned provider/model work. MOD-2 Sprint C requirements (production eligibility, Agent integration, Custom Provider model runtime, accounting compatibility and closeout) map into OIC and Responix integration phases. These requirements are resequenced, not cancelled. Preserve historical contracts and evidence.

## 7. Approved program direction

1. MOD-2 Sprint A — COMPLETE / HUMAN ACCEPTED.
2. OIC Master Architecture — APPROVED / LOCKED by this record.
3. OIC development branch/worktree established.
4. OIC Foundation Phase 1.
5. OIC Native Runtime + Compatibility Foundation.
6. Minimum provider-backed Oi Model path.
7. Responix ↔ OIC integration.
8. Stable contract/integration gate.
9. Responix Channel Protection Guard continues after the contract is stable enough not to disrupt it.
10. Remaining provider/model work evolves inside OIC.
11. Advanced Model Factory, Evolution, Evaluation, Efficiency and Economics proceed iteratively.

This direction does not alter unrelated Responix roadmaps or authorize implementation of these phases. Each phase requires a bounded contract and acceptance gate.

## 8. Delivery classification

**Foundation now:** application/tenant/service-principal identity; OIC-owned persistence/security boundaries; native contract; required compatibility surface; minimal Oi Model/release binding; one provider-backed runtime path; trace, audit, raw usage and resource bounds; isolation, failure and rollback evidence.

**Next OIC phase:** provider connection lifecycle; upstream catalog discovery/sync/validation; Context Compiler; authorized retrieval/memory/tool connections; entitlement/quota foundations; supported streaming behavior.

**Advanced OIC:** Model Factory automation, Evolution Lab, calibrated OMI/OES/domain evaluation, plans/economics, advanced cache engines, controlled learning and sophisticated routing.

**Future research:** teacher/student systems, distillation/training, synthetic data, internal models and lowering EIDR at scale.

**Not authorized yet:** product/runtime implementation, OIC schema/migrations, Responix data migration, Provider Fabric implementation, uncontrolled learning, or product behavior changes. Each needs its own approved implementation contract.

## 9. Prohibitions and change control

Prohibit scattered provider-specific logic across products; independent AI cores where shared OIC capability belongs; leaking provider identity into normal consumer contracts; tying Oi identity permanently to upstream identity; automatic production-data promotion to Core Memory; arbitrary JSON capability decisions; unbounded context or full-history replay; unscoped cache; silent paid fallback; automatic customer repricing; direct product access to OIC secrets/tables; uncontrolled self-learning; OIC ownership of product business logic; and big-bang extraction.

This charter records the approved architecture direction, not every API, schema, security control, lifecycle transition, commercial rule or deployment procedure. A bounded, human-approved implementation contract must define those details, dependencies, migration safety, security review and acceptance evidence before work begins. Changes to locked ownership or product boundaries require a human decision recorded in an authoritative project-state record.
