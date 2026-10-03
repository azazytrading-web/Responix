# OIC Permission-Aware Operator UX

**Status:** DECIDED UX contract; server authorization remains authoritative. Read with [security boundaries](16_OIC_SECURITY_AND_PRODUCT_BOUNDARIES.md), [command pipeline](22_OIC_ACTION_COMMAND_EVENT_ARCHITECTURE.md), and [compatibility](26_OIC_VERSIONING_CAPABILITY_AND_COMPATIBILITY.md).

## Current authorization model

The OIC API authenticates a machine service principal and applies scopes plus application/tenant grants. Current scope families include application, tenant, principal, credential, audit, provider, model and Console read/manage scopes (see `apps/oic-api/src/modules/identity/foundation-policy.ts`; enforcement in `auth.guard.ts` and `scope.guard.ts`). The Console human operator session is separately checked by its server BFF. Do not confuse a signed-in human with a delegated human-role/capability API: no such granular capability feed is established here. Do not infer human permissions from navigation or machine credential grants. A 403 or domain denial from the API is authoritative.

The Console may present an operation as actionable only when its currently available operation metadata supports that statement. If no capability metadata exists, show the normal affordance with the result governed by server authorization, or conservatively label it “availability not confirmed”; do not fabricate a role matrix. Capability responses must be scoped and must not disclose credential values or reveal protected entity existence.

## Distinct presentation states

| State | Meaning and interaction |
|---|---|
| VISIBLE | Entity/action can be presented in the current scope; says nothing by itself about write permission. |
| READ_ONLY | View is available and no permitted mutation is currently exposed. Explain view-only context where useful. |
| ACTIONABLE | The user can attempt this supported operation; final API decision still applies. |
| NOT_AUTHORIZED | Explicit server denial or trustworthy scoped capability denial. Preserve safe context and explain required access without exposing protected details. |
| NOT_APPLICABLE | Operation does not make sense for this entity state/type. Explain the domain condition. |
| UNAVAILABLE | Required service/feature/source is unavailable; distinct from authorization denial. |

Use text/icon/state shape plus semantic color; never color alone. Do not make disabled controls visually indistinguishable from active ones.

## Hide, disable, explain, confirm

- Hide navigation or an operation only when the API/capability contract explicitly says it is absent from this product/scope, or when showing its existence itself would disclose protected information.
- Keep a visible disabled action with explanation when its existence is useful and a known prerequisite/state prevents use (for example, missing configuration or unsupported lifecycle transition).
- Keep an operation visible with a clear access explanation after an explicit authorization denial when the entity itself is safe to display. Do not disguise 403 as empty data or network failure.
- Require explicit confirmation for destructive, credential, broad-scope, irreversible or consequential actions; identify target and scope, consequence, and whether undo is actually supported. Confirmation is not a substitute for API checks.
- Read operations, list filters and drilldowns preserve current application and tenant scope. Scope changes are explicit and reflected in the page context and request.

## Resource-family behavior

| Resource | Permission-aware rule |
|---|---|
| Applications / Tenants | Preserve selected scope in lists, detail and mutations. Distinguish inaccessible from empty only where server response safely allows it. |
| Service Principals | Separate read metadata from create/manage actions and credential lifecycle; never display issued secret again unless API explicitly returns it once. |
| Provider connections | Show view, test, create/update and credential changes as separate supported actions; a test result does not imply permission to edit. |
| Credentials | Never include secret content in capability, diff, event or denial. Revoke/rotate confirmation names the credential metadata and scope only. |
| Models / Profiles | Read revisions independently from lifecycle, bind and assignment permissions. Preserve expected revision and app/tenant context. |
| Memory / Knowledge | Respect entity scope and sensitivity. Show permitted records; avoid cross-tenant counts or suggestions that disclose hidden records. |
| Runtime / Workbench | Invocation permission is distinct from viewing prior traces. Show authorization failure before suggesting retry; do not replay an invocation automatically. |
| Audit | Apply API filtering and authorization before pagination/export. Never broaden scope in the client to “complete” a result. |

Permission changes during an open page are handled by fresh server decisions. A prior successful read or stale capability cache never authorizes a later write. Preserve authentication, origin, CSRF/session protections and machine credential boundaries without exception.
