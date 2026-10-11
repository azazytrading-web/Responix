import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  apiUrl,
  controlPlaneCredential,
  hasConsoleSession,
  runtimeCredential,
  sameOrigin
} from "@/lib/server-auth";

export const dynamic = "force-dynamic";
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const text = (value: unknown, maximum = 160): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
const decimalText = (value: unknown): value is string =>
  typeof value === "string" && /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value) && value.length <= 60;
const ratingDimension = (value: unknown) => ["inputTokens", "cachedInputTokens", "outputTokens", "reasoningTokens", "internalComputeUnits", "retrievalUnits", "toolUnits", "imageInputUnits", "imageOutputUnits", "audioInputSeconds", "audioOutputSeconds", "videoSeconds", "embeddingTokens", "rerankUnits", "requestUnits", "cacheWriteTokens", "batchTokens", "priorityTokens", "storageByteHours"].includes(String(value));
const customerRules = (value: unknown): Record<string, unknown>[] | null => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return null;
  const result: Record<string, unknown>[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const row = candidate as Record<string, unknown>;
    if (row.dimension !== undefined && !ratingDimension(row.dimension)) return null;
    if (row.unit !== undefined && (typeof row.unit !== "string" || !/^[A-Z][A-Z0-9_]{1,63}$/.test(row.unit))) return null;
    for (const field of ["pricePerUnit", "quantityDivisor", "fixedAmount", "includedQuantity"]) if (row[field] !== undefined && !decimalText(row[field])) return null;
    if (row.tiers !== undefined && (!Array.isArray(row.tiers) || row.tiers.length > 64 || !row.tiers.every((tier) => !!tier && typeof tier === "object" && !Array.isArray(tier) && ((tier as Record<string, unknown>).upTo === null || decimalText((tier as Record<string, unknown>).upTo)) && decimalText((tier as Record<string, unknown>).pricePerUnit)))) return null;
    result.push(Object.fromEntries(["dimension", "unit", "pricePerUnit", "quantityDivisor", "fixedAmount", "includedQuantity", "tiers"].filter((field) => row[field] !== undefined).map((field) => [field, row[field]])));
  }
  return result;
};
const knowledgeDependencies = (value: unknown) =>
  value === undefined ||
  (Array.isArray(value) &&
    value.length <= 16 &&
    value.every(
      (item) =>
        !!item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        text((item as Record<string, unknown>).sourceKey, 128) &&
        /^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(String((item as Record<string, unknown>).sourceKey)) &&
        text((item as Record<string, unknown>).sourceRef, 512)
    ));
const supportedScope = (value: unknown) =>
  [
    "oic:applications:read",
    "oic:applications:manage",
    "oic:tenants:read",
    "oic:tenants:manage",
    "oic:principals:read",
    "oic:principals:manage",
    "oic:credentials:rotate",
    "oic:credentials:revoke",
    "oic:audit:read",
    "oic:providers:read",
    "oic:providers:manage",
    "oic:connections:manage",
    "oic:catalog:read",
    "oic:catalog:manage",
    "oic:models:read",
    "oic:models:manage",
    "oic:runtime:invoke",
    "oic:runtime:models:read",
    "oic:usage:evidence:read",
    "oic:economics:read",
    "oic:economics:manage",
    "oic:admission:read",
    "oic:admission:manage",
    "oic:rating:read",
    "oic:rating:manage"
  ].includes(String(value));

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  if (!(await hasConsoleSession()))
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 64_000)
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const action = body.action;
  let path: string | null = null;
  let method = "POST";
  let payload: unknown = {};
  let runtime = false;
  if (
    action === "application.create" &&
    text(body.key, 64) &&
    /^[A-Z][A-Z0-9_]{1,63}$/.test(String(body.key)) &&
    text(body.displayName)
  ) {
    path = "/api/v1/admin/applications";
    payload = { key: body.key, displayName: body.displayName.trim() };
  }
  const applicationId = body.applicationId;
  const id = body.id;

  if (
    !path &&
    action === "tenant.create" &&
    uuid(applicationId) &&
    text(body.displayName) &&
    (body.key === undefined || body.key === "" || text(body.key, 64))
  ) {
    path = `/api/v1/admin/applications/${applicationId}/tenants`;
    payload = { displayName: body.displayName.trim(), ...(body.key ? { key: body.key } : {}) };
  } else if (
    !path &&
    action === "principal.create" &&
    uuid(applicationId) &&
    text(body.key, 64) &&
    text(body.displayName)
  ) {
    path = `/api/v1/admin/applications/${applicationId}/service-principals`;
    payload = { key: body.key, displayName: body.displayName.trim() };
  } else if (
    !path &&
    action === "externalReference.create" &&
    uuid(applicationId) &&
    uuid(body.tenantId) &&
    text(body.sourceType, 64) &&
    /^[A-Za-z0-9._:-]+$/.test(String(body.sourceType)) &&
    text(body.externalId, 256)
  ) {
    path = `/api/v1/admin/applications/${applicationId}/tenants/${body.tenantId}/external-references`;
    payload = { sourceType: body.sourceType, externalId: body.externalId };
  } else if (!path && action === "externalReference.revoke" && uuid(applicationId) && uuid(id)) {
    path = `/api/v1/admin/applications/${applicationId}/external-references/${id}`;
    method = "DELETE";
  } else if (
    !path &&
    action === "externalReference.remap" &&
    uuid(applicationId) &&
    uuid(id) &&
    uuid(body.tenantId)
  ) {
    path = `/api/v1/admin/applications/${applicationId}/external-references/${id}`;
    method = "PATCH";
    payload = { tenantId: body.tenantId };
  } else if (
    !path &&
    action === "principal.scope.grant" &&
    uuid(applicationId) &&
    uuid(id) &&
    supportedScope(body.scope)
  ) {
    path = `/api/v1/admin/applications/${applicationId}/service-principals/${id}/scopes`;
    payload = { scope: body.scope };
  } else if (
    !path &&
    action === "principal.scope.revoke" &&
    uuid(applicationId) &&
    uuid(id) &&
    supportedScope(body.scope)
  ) {
    path = `/api/v1/admin/applications/${applicationId}/service-principals/${id}/scopes`;
    method = "DELETE";
    payload = { scope: body.scope };
  } else if (
    !path &&
    ["principal.tenant.grant", "principal.tenant.revoke"].includes(String(action)) &&
    uuid(applicationId) &&
    uuid(id) &&
    uuid(body.tenantId)
  ) {
    path = `/api/v1/admin/applications/${applicationId}/service-principals/${id}/tenants/${body.tenantId}/grant`;
    if (action === "principal.tenant.revoke") method = "DELETE";
  } else if (
    !path &&
    action === "credential.issue" &&
    uuid(applicationId) &&
    uuid(id) &&
    (body.replacesId === undefined || body.replacesId === null || uuid(body.replacesId)) &&
    (body.expiresAt === undefined ||
      body.expiresAt === null ||
      (typeof body.expiresAt === "string" &&
        Number.isFinite(Date.parse(body.expiresAt)) &&
        Date.parse(body.expiresAt) > Date.now()))
  ) {
    path = `/api/v1/admin/applications/${applicationId}/service-principals/${id}/credentials`;
    payload = { expiresAt: body.expiresAt ?? null, ...(body.replacesId ? { replacesId: body.replacesId } : {}) };
  } else if (!path && action === "credential.revoke" && uuid(applicationId) && uuid(id)) {
    path = `/api/v1/admin/applications/${applicationId}/credentials/${id}`;
    method = "DELETE";
  } else if (
    !path &&
    action === "identity.status" &&
    uuid(applicationId) &&
    uuid(id) &&
    ["application", "tenant", "principal"].includes(String(body.kind)) &&
    ["ACTIVE", "SUSPENDED", "ARCHIVED"].includes(String(body.status))
  ) {
    path = `/api/v1/admin/applications/${applicationId}/${String(body.kind)}/${id}/status`;
    payload = { status: body.status };
  } else if (!path && action === "connection.test" && uuid(id)) {
    path = `/api/v1/admin/provider-connections/${id}/test`;
  } else if (
    !path &&
    action === "provider.credential.revoke" &&
    uuid(id) &&
    uuid(body.credentialId)
  ) {
    path = `/api/v1/admin/provider-connections/${id}/credentials/${body.credentialId}`;
    method = "DELETE";
  } else if (
    !path &&
    ["catalog.preview", "catalog.sync"].includes(String(action)) &&
    uuid(id) &&
    (Array.isArray(body.models) || body.source === "provider")
  ) {
    path = `/api/v1/admin/provider-connections/${id}/catalog/${action === "catalog.preview" ? "preview" : "sync"}`;
    payload = body.source === "provider" ? { source: "provider" } : { models: body.models };
  } else if (
    !path &&
    action === "connection.create" &&
    text(body.providerKey, 64) &&
    /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(body.providerKey)) &&
    ["PLATFORM", "APPLICATION", "TENANT"].includes(String(body.scope)) &&
    text(body.displayName) &&
    text(body.transportProfile, 128) &&
    /^[a-z0-9][a-z0-9-]{1,127}$/.test(String(body.transportProfile)) &&
    (body.applicationId === undefined || body.applicationId === "" || uuid(body.applicationId)) &&
    (body.tenantId === undefined || body.tenantId === "" || uuid(body.tenantId)) &&
    (body.endpointUrl === undefined ||
      body.endpointUrl === "" ||
      (typeof body.endpointUrl === "string" &&
        body.endpointUrl.length <= 2048 &&
        (() => {
          try {
            const url = new URL(body.endpointUrl);
            return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
          } catch {
            return false;
          }
        })()))
  ) {
    path = "/api/v1/admin/provider-connections";
    payload = {
      providerKey: body.providerKey,
      scope: body.scope,
      displayName: body.displayName.trim(),
      transportProfile: body.transportProfile,
      ...(body.applicationId ? { applicationId: body.applicationId } : {}),
      ...(body.tenantId ? { tenantId: body.tenantId } : {}),
      ...(body.endpointUrl ? { endpointUrl: body.endpointUrl } : {})
    };
  } else if (
    !path &&
    action === "connection.credential" &&
    uuid(id) &&
    typeof body.credential === "string" &&
    body.credential.length >= 8 &&
    body.credential.length <= 4096
  ) {
    path = `/api/v1/admin/provider-connections/${id}/credentials`;
    method = "PUT";
    payload = { credential: body.credential };
  } else if (
    !path &&
    action === "connection.status" &&
    uuid(id) &&
    ["ACTIVE", "SUSPENDED", "ARCHIVED"].includes(String(body.status))
  ) {
    path = `/api/v1/admin/provider-connections/${id}/status`;
    method = "PATCH";
    payload = { status: body.status };
  } else if (
    !path &&
    action === "binding.status" &&
    uuid(id) &&
    ["DRAFT", "ACTIVE", "DISABLED"].includes(String(body.status))
  ) {
    path = `/api/v1/admin/runtime-bindings/${id}/status`;
    method = "PATCH";
    payload = { status: body.status };
  } else if (
    !path &&
    action === "catalog.model.lifecycle" &&
    uuid(id) &&
    ["ACTIVE", "DISABLED", "DEPRECATED", "ARCHIVED"].includes(String(body.lifecycle))
  ) {
    path = `/api/v1/admin/upstream-models/${id}/lifecycle`;
    method = "PATCH";
    payload = { lifecycle: body.lifecycle };
  } else if (
    !path &&
    action === "edition.lifecycle" &&
    uuid(id) &&
    [
      "DRAFT",
      "EXPERIMENTAL",
      "CANDIDATE",
      "CANARY",
      "PRODUCTION",
      "MAINTENANCE",
      "DEPRECATED",
      "RETIRED"
    ].includes(String(body.lifecycle))
  ) {
    path = `/api/v1/admin/model-editions/${id}/lifecycle`;
    method = "PATCH";
    payload = { lifecycle: body.lifecycle };
  } else if (
    !path &&
    action === "model.family.create" &&
    text(body.familyKey, 64) &&
    /^[a-z0-9][a-z0-9._-]{0,63}$/.test(String(body.familyKey)) &&
    text(body.displayName)
  ) {
    path = "/api/v1/admin/model-families";
    payload = { familyKey: body.familyKey, displayName: body.displayName.trim() };
  } else if (!path && action === "model.family.retire" && uuid(id)) {
    path = `/api/v1/admin/model-families/${id}/lifecycle`;
    method = "PATCH";
  } else if (
    !path &&
    action === "model.edition.create" &&
    uuid(body.familyId) &&
    text(body.publicId, 64) &&
    /^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(String(body.publicId)) &&
    text(body.editionKey, 64) &&
    /^[a-z0-9][a-z0-9._-]{0,63}$/.test(String(body.editionKey)) &&
    text(body.displayName) &&
    (body.domain === undefined || body.domain === "" || text(body.domain, 128))
  ) {
    path = `/api/v1/admin/model-families/${body.familyId}/editions`;
    payload = { publicId: body.publicId, editionKey: body.editionKey, displayName: body.displayName.trim(), ...(body.domain ? { domain: body.domain.trim() } : {}) };
  } else if (
    !path &&
    action === "model.revision.create" &&
    uuid(body.editionId) &&
    (body.intelligenceProfileRevisionId === undefined || uuid(body.intelligenceProfileRevisionId)) &&
    (body.instructions === undefined || (typeof body.instructions === "string" && body.instructions.length <= 100_000)) &&
    (body.specification === undefined || (typeof body.specification === "string" && body.specification.length <= 100_000))
  ) {
    path = `/api/v1/admin/model-editions/${body.editionId}/revisions`;
    payload = { ...(body.instructions ? { instructions: body.instructions } : {}), ...(body.specification ? { specification: body.specification } : {}), ...(body.intelligenceProfileRevisionId ? { intelligenceProfileRevisionId: body.intelligenceProfileRevisionId } : {}) };
  } else if (!path && action === "intelligence.profile.create" && text(body.profileKey, 64) && /^[a-z][a-z0-9._-]{1,63}$/.test(String(body.profileKey)) && text(body.displayName) && body.policy && typeof body.policy === "object" && !Array.isArray(body.policy)) {
    path = "/api/v1/admin/intelligence/profiles";
    payload = { profileKey: body.profileKey, displayName: body.displayName.trim(), ...(text(body.description, 1000) ? { description: body.description.trim() } : {}), policy: body.policy };
  } else if (!path && action === "intelligence.profile.clone" && uuid(body.sourceRevisionId) && text(body.profileKey, 64) && /^[a-z][a-z0-9._-]{1,63}$/.test(String(body.profileKey)) && text(body.displayName)) {
    path = `/api/v1/admin/intelligence/profiles/${body.sourceRevisionId}/clone`;
    payload = { profileKey: body.profileKey, displayName: body.displayName.trim(), ...(text(body.description, 1000) ? { description: body.description.trim() } : {}) };
  } else if (!path && action === "intelligence.profile.revision" && uuid(body.profileId) && body.policy && typeof body.policy === "object" && !Array.isArray(body.policy)) {
    path = `/api/v1/admin/intelligence/profiles/${body.profileId}/revisions`;
    payload = body.policy;
  } else if (!path && action === "intelligence.profile.lifecycle" && uuid(body.profileId) && typeof body.lifecycle === "string" && ["ACTIVE", "DISABLED", "ARCHIVED"].includes(body.lifecycle)) {
    path = `/api/v1/admin/intelligence/profiles/${body.profileId}/lifecycle`;
    method = "PATCH";
    payload = { lifecycle: body.lifecycle };
  } else if (!path && action === "intelligence.knowledge.create" && (body.tenantId === undefined || body.tenantId === "" || uuid(body.tenantId)) && text(body.sourceKey, 128) && /^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(String(body.sourceKey)) && text(body.sourceRef, 512) && text(body.title, 240) && typeof body.content === "string" && body.content.trim().length > 0 && body.content.length <= 200_000 && knowledgeDependencies(body.dependsOn)) {
    path = "/api/v1/admin/intelligence/knowledge";
    payload = { ...(body.tenantId ? { tenantId: body.tenantId } : {}), sourceKey: body.sourceKey, sourceRef: body.sourceRef, title: body.title, content: body.content, ...(body.dependsOn !== undefined ? { dependsOn: body.dependsOn } : {}), authority: Number.isInteger(body.authority) ? body.authority : 50, sourcePriority: Number.isInteger(body.sourcePriority) ? body.sourcePriority : 50 };
  } else if (!path && action === "intelligence.knowledge.update" && uuid(body.id) && (body.title === undefined || text(body.title, 240)) && (body.lifecycle === undefined || typeof body.lifecycle === "string" && ["ACTIVE", "DISABLED", "ARCHIVED"].includes(body.lifecycle)) && (body.authority === undefined || Number.isInteger(body.authority) && Number(body.authority) >= 0 && Number(body.authority) <= 100) && (body.sourcePriority === undefined || Number.isInteger(body.sourcePriority) && Number(body.sourcePriority) >= 0 && Number(body.sourcePriority) <= 100) && knowledgeDependencies(body.dependsOn)) {
    path = `/api/v1/admin/intelligence/knowledge/${body.id}`; method = "PATCH";
    payload = { ...(body.title ? { title: body.title } : {}), ...(body.lifecycle ? { lifecycle: body.lifecycle } : {}), ...(body.authority !== undefined ? { authority: body.authority } : {}), ...(body.sourcePriority !== undefined ? { sourcePriority: body.sourcePriority } : {}), ...(body.dependsOn !== undefined ? { dependsOn: body.dependsOn } : {}) };
  } else if (!path && action === "intelligence.memory.create" && (body.tenantId === undefined || body.tenantId === "" || uuid(body.tenantId)) && ["EPISODIC", "SEMANTIC", "PROCEDURAL", "APPLICATION"].includes(String(body.kind)) && (body.sensitivity === undefined || typeof body.sensitivity === "string" && ["PUBLIC", "INTERNAL", "SENSITIVE", "RESTRICTED"].includes(body.sensitivity)) && text(body.title, 240) && typeof body.content === "string" && body.content.trim().length > 0 && body.content.length <= 20_000 && text(body.sourceType, 128) && (body.sourceRef === undefined || text(body.sourceRef, 256)) && (body.confidence === undefined || Number.isInteger(body.confidence) && Number(body.confidence) >= 0 && Number(body.confidence) <= 100) && (body.salience === undefined || Number.isInteger(body.salience) && Number(body.salience) >= 0 && Number(body.salience) <= 100) && (body.validUntil === undefined || body.validUntil === null || typeof body.validUntil === "string" && Number.isFinite(Date.parse(body.validUntil)))) {
    path = "/api/v1/admin/intelligence/memory";
    payload = { ...(body.tenantId ? { tenantId: body.tenantId } : {}), kind: body.kind, sensitivity: typeof body.sensitivity === "string" ? body.sensitivity : "INTERNAL", title: body.title, content: body.content, sourceType: body.sourceType, ...(body.sourceRef ? { sourceRef: body.sourceRef } : {}), confidence: Number.isInteger(body.confidence) ? body.confidence : 50, salience: Number.isInteger(body.salience) ? body.salience : 50, ...(body.validUntil !== undefined ? { validUntil: body.validUntil } : {}) };
  } else if (!path && action === "intelligence.memory.update" && uuid(body.id) && (body.lifecycle === undefined || typeof body.lifecycle === "string" && ["ACTIVE", "STALE", "SUPERSEDED", "CONFLICTED", "UNVERIFIED", "ARCHIVED"].includes(body.lifecycle)) && (body.sensitivity === undefined || typeof body.sensitivity === "string" && ["PUBLIC", "INTERNAL", "SENSITIVE", "RESTRICTED"].includes(body.sensitivity)) && (body.validUntil === undefined || body.validUntil === null || typeof body.validUntil === "string" && Number.isFinite(Date.parse(body.validUntil))) && (body.lifecycle !== undefined || body.sensitivity !== undefined || body.validUntil !== undefined)) {
    path = `/api/v1/admin/intelligence/memory/${body.id}`; method = "PATCH";
    payload = { ...(body.lifecycle !== undefined ? { lifecycle: body.lifecycle } : {}), ...(body.sensitivity !== undefined ? { sensitivity: body.sensitivity } : {}), ...(body.validUntil !== undefined ? { validUntil: body.validUntil } : {}) };
  } else if (!path && action === "intelligence.memory.lifecycle" && uuid(body.id) && typeof body.lifecycle === "string" && ["ACTIVE", "STALE", "SUPERSEDED", "CONFLICTED", "UNVERIFIED", "ARCHIVED"].includes(body.lifecycle)) {
    path = `/api/v1/admin/intelligence/memory/${body.id}`; method = "PATCH"; payload = { lifecycle: body.lifecycle };
  } else if (!path && action === "intelligence.workbench.run" && text(body.model, 64) && uuid(body.profileRevisionId) && text(body.prompt, 12_000) && (body.tenantId === undefined || body.tenantId === "" || uuid(body.tenantId))) {
    path = "/api/v1/admin/intelligence/workbench/run"; runtime = true;
    payload = { model: body.model, profileRevisionId: body.profileRevisionId, prompt: body.prompt, ...(body.tenantId ? { tenant: { kind: "id", tenantId: body.tenantId } } : {}), ...(text(body.sessionId, 128) ? { sessionId: body.sessionId } : {}), ...(Number.isInteger(body.maxOutputUnits) ? { maxOutputUnits: body.maxOutputUnits } : {}) };
  } else if (
    !path &&
    action === "model.variant.create" &&
    uuid(body.revisionId) &&
    text(body.variantKey, 64) &&
    /^[a-z0-9][a-z0-9._-]{0,63}$/.test(String(body.variantKey)) &&
    uuid(body.upstreamModelId) &&
    text(body.transportProfile, 128) &&
    /^[a-z0-9][a-z0-9-]{1,127}$/.test(String(body.transportProfile))
  ) {
    path = `/api/v1/admin/model-revisions/${body.revisionId}/variants`;
    payload = { variantKey: body.variantKey, upstreamModelId: body.upstreamModelId, transportProfile: body.transportProfile };
  } else if (
    !path &&
    action === "model.binding.create" &&
    uuid(body.editionId) &&
    uuid(body.variantId) &&
    uuid(body.connectionId) &&
    ["PLATFORM", "APPLICATION", "TENANT"].includes(String(body.scope)) &&
    (body.applicationId === undefined || body.applicationId === "" || uuid(body.applicationId)) &&
    (body.tenantId === undefined || body.tenantId === "" || uuid(body.tenantId)) &&
    (body.environment === undefined || body.environment === "" || (typeof body.environment === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(body.environment))) &&
    ((body.scope === "PLATFORM" && !body.applicationId && !body.tenantId) ||
      (body.scope === "APPLICATION" && uuid(body.applicationId) && !body.tenantId) ||
      (body.scope === "TENANT" && uuid(body.applicationId) && uuid(body.tenantId)))
  ) {
    path = `/api/v1/admin/model-editions/${body.editionId}/runtime-bindings`;
    payload = { variantId: body.variantId, connectionId: body.connectionId, scope: body.scope, ...(body.applicationId ? { applicationId: body.applicationId } : {}), ...(body.tenantId ? { tenantId: body.tenantId } : {}), ...(body.environment ? { environment: body.environment } : {}) };
  } else if (
    !path &&
    ["model.visibility", "model.visibility.grant", "model.visibility.revoke"].includes(String(action)) &&
    uuid(body.applicationId) &&
    uuid(body.editionId) &&
    typeof body.visible === "boolean"
  ) {
    path = `/api/v1/admin/applications/${body.applicationId}/models/${body.editionId}/visibility`;
    payload = { visible: body.visible };
  } else if (
    !path && action === "admission.plan.create" && uuid(body.applicationId) && text(body.planKey, 64) && /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(body.planKey)) && text(body.displayName) && Array.isArray(body.models) && body.models.length <= 100 && body.models.every((model) => text(model, 96) && /^oi-[a-z0-9._-]+$/i.test(String(model))) && typeof body.effectiveFrom === "string" && Number.isFinite(Date.parse(body.effectiveFrom)) && (body.effectiveTo === undefined || typeof body.effectiveTo === "string" && Number.isFinite(Date.parse(body.effectiveTo))) && (body.maxOutputUnits === undefined || Number.isInteger(body.maxOutputUnits) && Number(body.maxOutputUnits) > 0 && Number(body.maxOutputUnits) <= 65536) && (body.maxConcurrency === undefined || Number.isInteger(body.maxConcurrency) && Number(body.maxConcurrency) > 0 && Number(body.maxConcurrency) <= 100000)
  ) {
    path = "/api/v1/admin/admission/plans";
    payload = { applicationId: body.applicationId, planKey: String(body.planKey).trim(), displayName: String(body.displayName).trim(), entitlements: { models: body.models }, effectiveFrom: body.effectiveFrom, ...(body.effectiveTo ? { effectiveTo: body.effectiveTo } : {}), ...(body.maxOutputUnits ? { maxOutputUnits: body.maxOutputUnits } : {}), ...(body.maxConcurrency ? { maxConcurrency: body.maxConcurrency } : {}) };
  } else if (
    !path && action === "admission.plan.revision" && uuid(body.planId) && Array.isArray(body.models) && body.models.length <= 100 && body.models.every((model) => text(model, 96) && /^oi-[a-z0-9._-]+$/i.test(String(model))) && typeof body.effectiveFrom === "string" && Number.isFinite(Date.parse(body.effectiveFrom)) && (body.effectiveTo === undefined || typeof body.effectiveTo === "string" && Number.isFinite(Date.parse(body.effectiveTo))) && (body.maxOutputUnits === undefined || Number.isInteger(body.maxOutputUnits) && Number(body.maxOutputUnits) > 0 && Number(body.maxOutputUnits) <= 65536) && (body.maxConcurrency === undefined || Number.isInteger(body.maxConcurrency) && Number(body.maxConcurrency) > 0 && Number(body.maxConcurrency) <= 100000)
  ) {
    path = `/api/v1/admin/admission/plans/${body.planId}/revisions`;
    payload = { entitlements: { models: body.models }, effectiveFrom: body.effectiveFrom, ...(body.effectiveTo ? { effectiveTo: body.effectiveTo } : {}), ...(body.maxOutputUnits ? { maxOutputUnits: body.maxOutputUnits } : {}), ...(body.maxConcurrency ? { maxConcurrency: body.maxConcurrency } : {}) };
  } else if (!path && action === "admission.plan.publish" && uuid(body.id)) {
    path = `/api/v1/admin/admission/plans/revisions/${body.id}/publish`;
  } else if (
    !path && action === "admission.assignment.create" && uuid(body.applicationId) && (body.tenantId === undefined || body.tenantId === null || uuid(body.tenantId)) && uuid(body.planRevisionId) && text(body.subjectKey, 128) && typeof body.effectiveFrom === "string" && Number.isFinite(Date.parse(body.effectiveFrom)) && (body.effectiveTo === undefined || typeof body.effectiveTo === "string" && Number.isFinite(Date.parse(body.effectiveTo)))
  ) {
    path = "/api/v1/admin/admission/assignments";
    payload = { applicationId: body.applicationId, tenantId: body.tenantId ?? null, planRevisionId: body.planRevisionId, subjectKey: String(body.subjectKey).trim(), priority: Number.isInteger(body.priority) ? body.priority : 0, effectiveFrom: body.effectiveFrom, ...(body.effectiveTo ? { effectiveTo: body.effectiveTo } : {}) };
  } else if (
    !path && action === "admission.quota.create" && uuid(body.applicationId) && uuid(body.planRevisionId) && text(body.quotaKey, 64) && /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(body.quotaKey)) && ["APPLICATION", "TENANT", "PRINCIPAL", "MODEL", "TIER", "CAPABILITY"].includes(String(body.subject)) && text(body.dimension, 64) && text(body.unit, 64) && ["LIFETIME", "UTC_DAY", "UTC_MONTH", "ROLLING", "CONTRACT_PERIOD"].includes(String(body.window)) && ["HARD", "SOFT"].includes(String(body.enforcement)) && typeof body.limitValue === "string" && /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(body.limitValue) && typeof body.effectiveFrom === "string" && Number.isFinite(Date.parse(body.effectiveFrom))
  ) {
    path = "/api/v1/admin/admission/quotas";
    payload = { applicationId: body.applicationId, ...(uuid(body.tenantId) ? { tenantId: body.tenantId } : {}), planRevisionId: body.planRevisionId, quotaKey: body.quotaKey, subject: body.subject, dimension: body.dimension, unit: body.unit, window: body.window, enforcement: body.enforcement, limitValue: body.limitValue, ...(typeof body.reservationUpperBound === "string" && /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(body.reservationUpperBound) ? { reservationUpperBound: body.reservationUpperBound } : {}), safetyMargin: typeof body.safetyMargin === "string" ? body.safetyMargin : "0", unknownLiabilityRule: body.unknownLiabilityRule === "HOLD_MAXIMUM" ? "HOLD_MAXIMUM" : "DENY", effectiveFrom: body.effectiveFrom, ...(typeof body.effectiveTo === "string" ? { effectiveTo: body.effectiveTo } : {}), ...(body.window === "ROLLING" && Number.isInteger(body.windowSeconds) ? { windowSeconds: body.windowSeconds } : {}) };
  } else if (!path && action === "admission.quota.publish" && uuid(body.id)) {
    path = `/api/v1/admin/admission/quotas/revisions/${body.id}/publish`;
  } else if (
    !path && action === "admission.budget.create" && uuid(body.applicationId) && uuid(body.planRevisionId) && text(body.budgetKey, 64) && /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(body.budgetKey)) && ["OIU", "CURRENCY"].includes(String(body.unit)) && (body.unit === "OIU" ? body.currency === undefined || body.currency === "" : typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency)) && ["HARD", "SOFT"].includes(String(body.enforcement)) && typeof body.amount === "string" && /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(body.amount) && text(body.purpose, 128) && typeof body.effectiveFrom === "string" && Number.isFinite(Date.parse(body.effectiveFrom))
  ) {
    path = "/api/v1/admin/admission/budgets";
    payload = { applicationId: body.applicationId, ...(uuid(body.tenantId) ? { tenantId: body.tenantId } : {}), planRevisionId: body.planRevisionId, budgetKey: body.budgetKey, unit: body.unit, ...(body.currency ? { currency: body.currency } : {}), enforcement: body.enforcement, amount: body.amount, ...(typeof body.reservationUpperBound === "string" && /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(body.reservationUpperBound) ? { reservationUpperBound: body.reservationUpperBound } : {}), safetyMargin: typeof body.safetyMargin === "string" ? body.safetyMargin : "0", purpose: body.purpose, unknownLiabilityRule: body.unknownLiabilityRule === "HOLD_MAXIMUM" ? "HOLD_MAXIMUM" : "DENY", effectiveFrom: body.effectiveFrom, ...(body.effectiveTo ? { effectiveTo: body.effectiveTo } : {}), ...(body.deadline ? { deadline: body.deadline } : {}) };
  } else if (!path && action === "admission.budget.publish" && uuid(body.id)) {
    path = `/api/v1/admin/admission/budgets/revisions/${body.id}/publish`;
  } else if (!path && action === "admission.reconcile-expired" && (body.limit === undefined || Number.isInteger(body.limit) && Number(body.limit) >= 1 && Number(body.limit) <= 100)) {
    path = "/api/v1/admin/admission/reconcile-expired";
    payload = { limit: body.limit ?? 100 };
  } else if (
    !path && action === "rating.price-book.draft" && uuid(body.applicationId) && uuid(body.planRevisionId) && text(body.priceBookKey, 64) && /^[a-z][a-z0-9-]{1,63}$/.test(String(body.priceBookKey)) && ["OIU_RATE", "RESOURCE_RATE", "REQUEST", "TASK", "FEATURE", "TIERED", "INCLUDED_PLUS_OVERAGE", "FIXED_PLUS_VARIABLE"].includes(String(body.strategy)) && typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency) && text(body.sourceReference, 256) && typeof body.effectiveFrom === "string" && Number.isFinite(Date.parse(body.effectiveFrom)) && (body.effectiveTo === undefined || typeof body.effectiveTo === "string" && Number.isFinite(Date.parse(body.effectiveTo))) && (body.tenantId === undefined || body.tenantId === null || uuid(body.tenantId)) && customerRules(body.rules) !== null
  ) {
    path = "/api/v1/admin/economics/customer-price-books";
    payload = { applicationId: body.applicationId, ...(body.tenantId ? { tenantId: body.tenantId } : {}), planRevisionId: body.planRevisionId, priceBookKey: String(body.priceBookKey).trim(), strategy: body.strategy, currency: body.currency, sourceReference: String(body.sourceReference).trim(), effectiveFrom: body.effectiveFrom, ...(body.effectiveTo ? { effectiveTo: body.effectiveTo } : {}), rules: customerRules(body.rules) };
  } else if (!path && action === "rating.price-book.publish" && uuid(body.id)) {
    path = `/api/v1/admin/economics/customer-price-books/${body.id}/publish`;
  } else if (!path && action === "rating.usage.rate" && uuid(body.usageEventId) && (body.kind === undefined || body.kind === "ORIGINAL" || body.kind === "REPLAY")) {
    path = `/api/v1/admin/economics/rated/${body.usageEventId}/rate${body.kind === "REPLAY" ? "?kind=REPLAY" : ""}`;
  } else if (!path && action === "rating.adjustment.create" && uuid(body.ratedUsageEventId) && text(body.sourceKey, 128) && /^[A-Za-z0-9._:-]{1,128}$/.test(String(body.sourceKey)) && ["CREDIT", "REVERSAL"].includes(String(body.kind)) && text(body.reason, 256) && (body.kind === "CREDIT" ? decimalText(body.amount) : body.amount === undefined)) {
    path = `/api/v1/admin/economics/rated/${body.ratedUsageEventId}/adjustments`;
    payload = { sourceKey: body.sourceKey, kind: body.kind, ...(body.amount === undefined ? {} : { amount: body.amount }), reason: String(body.reason).trim() };
  } else if (!path && action === "rating.fx.create" && typeof body.baseCurrency === "string" && /^[A-Z]{3}$/.test(body.baseCurrency) && typeof body.quoteCurrency === "string" && /^[A-Z]{3}$/.test(body.quoteCurrency) && decimalText(body.rate) && text(body.source, 128) && text(body.sourceReference, 256) && text(body.policyRevision, 64) && typeof body.effectiveAt === "string" && Number.isFinite(Date.parse(body.effectiveAt))) {
    path = "/api/v1/admin/economics/fx-evidence";
    payload = { baseCurrency: body.baseCurrency, quoteCurrency: body.quoteCurrency, rate: body.rate, source: body.source, sourceReference: body.sourceReference, policyRevision: body.policyRevision, effectiveAt: body.effectiveAt };
  } else if (
    !path &&
    action === "runtime.invoke" &&
    text(body.model, 64) &&
    Array.isArray(body.input) &&
    body.input.length > 0 &&
    body.input.length <= 100 &&
    body.input.every((message) => {
      if (!message || typeof message !== "object" || Array.isArray(message)) return false;
      const row = message as Record<string, unknown>;
      return (
        ["instruction", "user", "assistant", "context"].includes(String(row.speaker)) &&
        Array.isArray(row.content) &&
        row.content.length > 0 &&
        row.content.length <= 100 &&
        row.content.every(
          (part) =>
            !!part &&
            typeof part === "object" &&
            !Array.isArray(part) &&
            (part as Record<string, unknown>).type === "text" &&
            typeof (part as Record<string, unknown>).text === "string" &&
            ((part as Record<string, unknown>).text as string).length <= 12000
        )
      );
    }) &&
    (body.maxOutputUnits === undefined ||
      (Number.isInteger(body.maxOutputUnits) &&
        Number(body.maxOutputUnits) >= 1 &&
        Number(body.maxOutputUnits) <= 65536)) &&
    (!body.tenant ||
      (typeof body.tenant === "object" &&
        !Array.isArray(body.tenant) &&
        (body.tenant as Record<string, unknown>).kind === "id" &&
        uuid((body.tenant as Record<string, unknown>).tenantId)))
  ) {
    path = "/api/v1/runtime/invocations";
    payload = {
      model: body.model,
      input: body.input,
      ...(body.tenant ? { tenant: body.tenant } : {}),
      ...(body.maxOutputUnits ? { maxOutputUnits: body.maxOutputUnits } : {})
    };
    runtime = true;
  }
  if (!path)
    return NextResponse.json(
      { error: "This operation is unavailable or its input is invalid." },
      { status: 400 }
    );

  try {
    const credential = runtime ? runtimeCredential() : controlPlaneCredential();
    const requestId = randomUUID();
    const traceId = randomUUID();
    const response = await fetch(apiUrl(path), {
      method,
      headers: {
        Authorization: `Bearer ${credential}`,
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        "X-Trace-Id": traceId,
        "Idempotency-Key": randomUUID()
      },
      ...(method === "POST" ||
      method === "PUT" ||
      method === "PATCH" ||
      (method === "DELETE" && Object.keys(payload as Record<string, unknown>).length > 0)
        ? { body: JSON.stringify(payload) }
        : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(runtime ? 120_000 : 15_000)
    });
    const result: unknown = await response
      .json()
      .catch(() => ({ error: "OIC API returned an unreadable response." }));
    return NextResponse.json(runtime ? { result, requestId, traceId, httpStatus: response.status } : result, {
      status: response.status,
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json(
      { error: "OIC API is unavailable or this console operation is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
