# OIC Security and Product Boundaries

**DECIDED hard boundary:** OIC owns its Console, API, contracts, runtime and persistence. API config validates `OIC_DATABASE_URL` as PostgreSQL with both database name and role matching an OIC-specific prefix. Do not access Responix or Mega Platform Portal databases or import their runtime/product code. Shared repository history does not imply shared runtime or data. Oi Home is a validated HTTP(S) outbound link with `noreferrer`/`no-referrer`; it is navigation only.

## Authentication and secrets

**CURRENT:** Console server auth uses an HMAC-signed operator session cookie. The browser calls Next BFF routes; BFF enforces session and forwards OIC machine credentials from server environment. `server-auth.ts` separates control-plane and runtime credentials and defines API URL, session and origin helpers. Mutating action BFF checks same-origin and operator session, bounds/parses input, maps supported actions to explicit API paths; the OIC API independently authenticates machine credentials and checks scopes. This is a layered boundary, not a single login check.

Operator session ≠ Console control-plane machine credential ≠ runtime service-principal credential ≠ provider credential. Application/tenant scopes are API/domain-enforced. Provider credentials remain encrypted/secret-handled server-side and are not returned by snapshot; Console shows safe credential metadata only. Never put secrets into client props, browser storage, logs, traces, screenshots or docs.

## Hard-stop conditions

Stop and request architecture review before any change that weakens auth/session signing, origin/CSRF checks, credential separation, scope checks, database-name/role validation, secret filtering, customer tenant/application boundaries, OIC-owned storage, auditability, or OIC/Responix/Portal isolation. Do not inspect or ask for human Operator passwords. Do not replace real API evidence with fixtures in ordinary operation. Fixture enablement is an explicit development-only API setting, currently default false. Never bypass BFF by exposing server credentials to the browser.

## Source ownership map

| Boundary | CURRENT source owner | Future surfaces / contract |
|---|---|---|
| Human Console session, signing and same-origin | `apps/oic-console/lib/server-auth.ts`; `app/api/session/route.ts` | Session route reports configured/authenticated state; password/session signing key remain server-only. |
| Console BFF mapping | `apps/oic-console/app/api/console/route.ts`, `app/api/action/route.ts` | Fixed route/action mapping, validated inputs, timeout and safe responses; no arbitrary proxy. |
| API machine authentication/scopes | `apps/oic-api/src/modules/identity/auth.guard.ts`, `foundation-policy.ts`, module controllers | API rechecks principal, scopes and application/tenant access; UI gating is convenience only. |
| Credential verifier | `apps/oic-api/src/modules/identity/credential.crypto.ts`, `foundation.service.ts` | Credential issue/revoke remains API-owned; issued credential shown once only when contract permits. |
| Provider secret custody | `apps/oic-api/src/modules/control-plane/provider-credential.crypto.ts`, `provider-control.service.ts` | Encrypted persistence, server-only decryption, version/revocation and safe metadata. |
| Product database | `apps/oic-api/src/config/oic-config.schema.ts`, `src/database/oic-database.module.ts`, `packages/oic-database/prisma/schema.prisma` | Startup requires OIC-specific DB/role; API imports `@oic/database`, never shared product DB. |
| Audit | `apps/oic-api/src/modules/identity/foundation-audit-writer.ts`, foundation/control-plane services | Mutations record actor/scope/action/target/request/trace; audit UI uses limited projection. |

Security acceptance asks independently whether Console enforces session/origin and whether API enforces machine identity/scope/customer isolation. Passing one does not imply the other. Review changed paths and browser network/bundles for secret leakage.
