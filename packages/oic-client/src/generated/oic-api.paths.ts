// Generated from packages/oic-client/src/generated/oic-openapi.json. Do not edit manually.
// Run `pnpm --filter @oic/client openapi:generate` against the OIC API to regenerate.
export type OicApiPaths = {
  "/api/v1/admin/applications": {
    "post": { operationId: "FoundationController_createApplication_v1" };
  };
  "/api/v1/admin/applications/by-key/{key}": {
    "get": { operationId: "FoundationController_getApplicationByKey_v1" };
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
  "/api/v1/admin/applications/{applicationId}/models/{editionId}/visibility": {
    "post": { operationId: "ModelFabricController_setVisibility_v1" };
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
  "/api/v1/admin/applications/{applicationId}/tenants/by-external-reference/{sourceType}/{externalId}": {
    "get": { operationId: "FoundationController_getTenantByExternalReference_v1" };
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
  "/api/v1/admin/model-editions/{editionId}/lifecycle": {
    "patch": { operationId: "ModelFabricController_changeEditionLifecycle_v1" };
  };
  "/api/v1/admin/model-editions/{editionId}/revisions": {
    "post": { operationId: "ModelFabricController_createRevision_v1" };
  };
  "/api/v1/admin/model-editions/{editionId}/runtime-bindings": {
    "post": { operationId: "ModelFabricController_createBinding_v1" };
  };
  "/api/v1/admin/model-families": {
    "post": { operationId: "ModelFabricController_createFamily_v1" };
  };
  "/api/v1/admin/model-families/{familyId}/editions": {
    "post": { operationId: "ModelFabricController_createEdition_v1" };
  };
  "/api/v1/admin/model-revisions/{revisionId}/variants": {
    "post": { operationId: "ModelFabricController_createVariant_v1" };
  };
  "/api/v1/admin/provider-connections": {
    "get": { operationId: "ProviderControlController_listConnections_v1" };
    "post": { operationId: "ProviderControlController_createConnection_v1" };
  };
  "/api/v1/admin/provider-connections/{connectionId}/catalog/sync": {
    "post": { operationId: "ModelFabricController_syncManualCatalog_v1" };
  };
  "/api/v1/admin/provider-connections/{connectionId}/upstream-models": {
    "get": { operationId: "ModelFabricController_listUpstreamModels_v1" };
  };
  "/api/v1/admin/provider-connections/{id}": {
    "get": { operationId: "ProviderControlController_getConnection_v1" };
  };
  "/api/v1/admin/provider-connections/{id}/credentials": {
    "put": { operationId: "ProviderControlController_setCredential_v1" };
  };
  "/api/v1/admin/provider-connections/{id}/credentials/{credentialId}": {
    "delete": { operationId: "ProviderControlController_revokeCredential_v1" };
  };
  "/api/v1/admin/provider-connections/{id}/status": {
    "patch": { operationId: "ProviderControlController_changeConnectionStatus_v1" };
  };
  "/api/v1/admin/provider-connections/{id}/test": {
    "post": { operationId: "ProviderControlController_testConnection_v1" };
  };
  "/api/v1/admin/providers": {
    "get": { operationId: "ProviderControlController_listDefinitions_v1" };
  };
  "/api/v1/admin/runtime-bindings/{bindingId}/status": {
    "patch": { operationId: "ModelFabricController_changeBindingStatus_v1" };
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
