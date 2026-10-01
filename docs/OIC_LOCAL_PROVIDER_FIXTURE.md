# OIC local provider fixture

The OIC API includes an in-process provider fixture for local development and acceptance. It follows the normal authenticated provider connection, credential, catalog, Oi Model, visibility, and native runtime APIs. It never opens a socket and never calls an external provider.

## Enable for local development

Set these values in the ignored `.env.oic.local` file used by the OIC API:

```dotenv
NODE_ENV=development
OIC_ENABLE_LOCAL_PROVIDER_FIXTURE=true
```

Start the API and OIC Console using the normal local OIC workflow. The provider appears in the Console as **OIC Local Acceptance Fixture (development only)**. Create its connection through Provider Fabric, set a non-sensitive fixture credential, and use the connection test and fixture catalog controls. The built-in catalog uses stable `acceptance-oic45-*` upstream IDs.

The API stores the development-only provider definition through the normal control-plane connection creation path. It is not inserted into migrations or included in the production provider registry. The reserved `https://local-fixture.oic.invalid/v1` endpoint is an identity marker: OIC handles that exact provider and endpoint in-process and does not resolve or request it over the network.

## Disable

Set `OIC_ENABLE_LOCAL_PROVIDER_FIXTURE=false` or remove it, then restart the API. The fixture is unavailable unless the value is exactly `true` and `NODE_ENV` is exactly `development`. It remains unavailable under `NODE_ENV=production`, including when the flag is mistakenly set. Existing fixture connections cannot execute while the feature is disabled.

Normal provider endpoint validation remains unchanged: generic HTTP, loopback, private, and non-public DNS destinations continue to be rejected.

## Acceptance cleanup

Use the normal OIC Console lifecycle actions after an acceptance run: revoke fixture credentials, disable runtime bindings, revoke application visibility, retire the test editions, archive the provider connection, and archive the fixture upstream catalog entries. The stable `acceptance-oic45-*` IDs and audit events remain for traceability; they are not deleted from the database.
