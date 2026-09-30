// Generated from packages/oic-client/src/generated/oic-openapi.json. Do not edit manually.
// Run `pnpm --filter @oic/client openapi:generate` against the OIC API to regenerate.
export type OicApiPaths = {
  "/api/v1/admin/applications": {
    "post": { operationId: "FoundationController_createApplication_v1" };
  };
  "/api/v1/admin/applications/{applicationId}": {
    "get": { operationId: "FoundationController_getApplication_v1" };
  };
  "/api/v1/admin/applications/{applicationId}/credentials/{credentialId}": {
    "delete": { operationId: "FoundationController_revokeCredential_v1" };
  };
  "/api/v1/admin/applications/{applicationId}/external-references/{referenceId}": {
    "delete": { operationId: "FoundationController_revokeExternalReference_v1" };
    "patch": { operationId: "FoundationController_remapExternalReference_v1" };
  };
  "/api/v1/admin/applications/{applicationId}/service-principals": {
    "post": { operationId: "FoundationController_createPrincipal_v1" };
  };
  "/api/v1/admin/applications/{applicationId}/service-principals/{principalId}": {
    "get": { operationId: "FoundationController_getPrincipal_v1" };
  };
  "/api/v1/admin/applications/{applicationId}/service-principals/{principalId}/credentials": {
    "post": { operationId: "FoundationController_issueCredential_v1" };
  };
  "/api/v1/admin/applications/{applicationId}/service-principals/{principalId}/scopes": {
    "delete": { operationId: "FoundationController_revokeScope_v1" };
    "post": { operationId: "FoundationController_grantScope_v1" };
  };
  "/api/v1/admin/applications/{applicationId}/service-principals/{principalId}/tenants/{tenantId}/grant": {
    "delete": { operationId: "FoundationController_revokeTenant_v1" };
    "post": { operationId: "FoundationController_grantTenant_v1" };
  };
  "/api/v1/admin/applications/{applicationId}/tenants": {
    "post": { operationId: "FoundationController_createTenant_v1" };
  };
  "/api/v1/admin/applications/{applicationId}/tenants/{tenantId}/external-references": {
    "post": { operationId: "FoundationController_createExternalReference_v1" };
  };
  "/api/v1/admin/applications/{applicationId}/{kind}/{id}/status": {
    "post": { operationId: "FoundationController_changeLifecycle_v1" };
  };
  "/api/v1/admin/audit": {
    "get": { operationId: "FoundationController_readAudit_v1" };
  };
  "/api/v1/admin/tenants/{tenantId}": {
    "get": { operationId: "FoundationController_getTenant_v1" };
  };
  "/api/v1/health/live": {
    "get": { operationId: "HealthController_live_v1" };
  };
  "/api/v1/health/ready": {
    "get": { operationId: "HealthController_ready_v1" };
  };
  "/api/v1/runtime/invocations": {
    "post": { operationId: "OicRuntimeController_invoke_v1" };
  };
  "/api/v1/runtime/stream": {
    "post": { operationId: "OicRuntimeController_stream_v1" };
  };
  "/v1/chat/completions": {
    "post": { operationId: "OpenAICompatibilityController_chatCompletions" };
  };
  "/v1/models": {
    "get": { operationId: "OpenAICompatibilityController_listModels" };
  };
  "/v1/responses": {
    "post": { operationId: "OpenAICompatibilityController_responses" };
  };
};
export type OicApiPath = keyof OicApiPaths;
