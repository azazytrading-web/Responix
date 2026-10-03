export function knowledgeScopeWhere(applicationId: string, tenantId: string | null) {
  return { applicationId, OR: tenantId ? [{ tenantId: null }, { tenantId }] : [{ tenantId: null }], lifecycle: "ACTIVE" as const };
}
