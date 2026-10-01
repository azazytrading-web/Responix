# OIC Operator Console

Independent Next.js application for internal Oi operators. Development and production default to port `3002`; the OIC API defaults to `4100`.

## Server configuration

Copy `.env.example` into the console process environment and set:

- `OIC_API_URL`: OIC API origin, default `http://127.0.0.1:4100`.
- `OI_PLATFORM_URL`: launcher destination for the fixed Oi Home control, default `http://localhost:3000`.
- `OIC_CONSOLE_OPERATOR_PASSWORD`: private operator sign-in secret.
- `OIC_CONSOLE_SESSION_SECRET`: at least 32 bytes used to sign the eight-hour HttpOnly session cookie.
- `OIC_CONSOLE_API_CREDENTIAL`: dedicated OIC platform administration service-principal credential, available only to the console server.
- `OIC_CONSOLE_RUNTIME_CREDENTIAL`: separate OIC runtime invocation identity, available only to the console server.
- `OIC_CONSOLE_RUNTIME_PRINCIPAL_ID`: the matching runtime principal UUID, used server-side to scope the visible application and granted tenant choices.

The control-plane identity must have `oic:console:read`, `oic:console:manage`, and only the domain scopes required by current Console actions. `oic:console:read` provides global read-only Console snapshot access. `oic:console:manage` permits cross-application targeting only when a route also authorizes its specific domain scope. Only a platform foundation administrator can grant either Console scope. The runtime identity is separate and needs `oic:runtime:invoke` plus an explicit tenant grant. Do not use the recovery credential for either setting. These values are server-only and must never use a `NEXT_PUBLIC_` prefix. The browser receives only the operator password during sign-in and then a signed, HttpOnly, SameSite=Strict session cookie; OIC machine credentials are never sent to the browser.

If the required private settings are absent, sign-in remains disabled. The API snapshot requires `oic:console:read` and omits provider secrets, machine credential verifiers, and audit metadata. Runtime invocation is an explicit operator action and uses its separate runtime identity.

## Run

From this package, use `pnpm dev` for local development or `pnpm build` then `pnpm start` for production. Configure `OIC_API_URL` and the server-only authentication variables in the process environment.

## Current-scope surfaces

The console shell, navigation, bilingual messages, shared controls, and feature views live in separate OIC-owned modules. Overview, applications, tenants and external references, service principals and credential lifecycle metadata, provider definitions and connections, upstream catalog evidence, Oi Model hierarchy and bindings, a native runtime request tester, API health/readiness, and recent audit events are included. The UI provides identity and connection creation/status controls, external-reference management, principal grants and credential issuance/revocation, provider credential setting/testing/revocation, model hierarchy authoring, lifecycle controls, and application visibility changes.

Catalog synchronization has a non-mutating OIC API preview. It validates the current manual sync schema and reports create/update counts, each capability evidence state, unknown pricing separately from known zero pricing, and model-level evidence before the operator confirms synchronization.

## Local acceptance requirements

The console sign-in and BFF require a dedicated operator password, session-signing secret, operator service-principal credential, runtime credential, and matching runtime-principal ID in the console server environment. The control-plane credential needs `oic:console:read`, `oic:console:manage`, `oic:applications:read`, `oic:applications:manage`, `oic:tenants:read`, `oic:tenants:manage`, `oic:principals:read`, `oic:principals:manage`, `oic:credentials:rotate`, `oic:credentials:revoke`, `oic:audit:read`, `oic:providers:read`, `oic:connections:manage`, `oic:catalog:read`, `oic:catalog:manage`, `oic:models:read`, and `oic:models:manage`. It does not need `oic:foundation:admin` or provider-definition management. Runtime invocation uses its separate identity with `oic:runtime:invoke` and a tenant grant. Without these private settings, sign-in remains disabled. No machine credential is exposed to browser code.
