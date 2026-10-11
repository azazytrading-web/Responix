import { BadRequestException, Controller, ForbiddenException, Get, Query, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { OicDatabaseService } from "@oic/database";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { hasOicConsoleRead } from "../identity/foundation-policy";

const uuid = z.string().uuid();
function parseLimit(raw?: string): number {
  if (raw === undefined) return 50;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new BadRequestException("Invalid page size");
  return value;
}

@ApiTags("OIC Usage Evidence")
@ApiBearerAuth()
@Controller("admin/usage")
@UseGuards(OicAuthenticationGuard, OicScopeGuard)
export class UsageEvidenceController {
  constructor(private readonly db: OicDatabaseService) {}

  @Get("events")
  @Version("1")
  async events(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("limit") rawLimit?: string, @Query("cursor") cursor?: string, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string, @Query("attemptId") attemptId?: string) {
    const limit = parseLimit(rawLimit);
    for (const candidate of [cursor, applicationId, tenantId, attemptId]) if (candidate !== undefined && !uuid.safeParse(candidate).success) throw new BadRequestException("Invalid usage evidence scope");
    const consoleReader = hasOicConsoleRead(actor.scopes);
    if (!consoleReader && !actor.scopes.includes("oic:usage:evidence:read")) throw new ForbiddenException();
    if (!consoleReader && applicationId && applicationId !== actor.applicationId) return { items: [], nextCursor: null };
    if (!consoleReader && tenantId && !actor.tenantIds.includes(tenantId)) return { items: [], nextCursor: null };
    const where = {
      applicationId: consoleReader ? applicationId : actor.applicationId,
      ...(!consoleReader ? { providerAttempt: { principalId: actor.id } } : {}),
      ...(tenantId ? { tenantId } : !consoleReader ? { OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] } : {}),
      ...(attemptId ? { providerAttemptId: attemptId } : {})
    };
    const rows = await this.db.oicUsageEvent.findMany({
      where,
      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
      select: { id: true, applicationId: true, tenantId: true, providerAttemptId: true, receiptSequence: true, sourceDigest: true, providerKey: true, transportProfile: true, rawDimensions: true, normalizedDimensions: true, occurredAt: true, recordedAt: true }
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }

  @Get("attempts")
  @Version("1")
  async attempts(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("limit") rawLimit?: string, @Query("cursor") cursor?: string, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) {
    const limit = parseLimit(rawLimit);
    for (const candidate of [cursor, applicationId, tenantId]) if (candidate !== undefined && !uuid.safeParse(candidate).success) throw new BadRequestException("Invalid usage evidence scope");
    const consoleReader = hasOicConsoleRead(actor.scopes);
    if (!consoleReader && !actor.scopes.includes("oic:usage:evidence:read")) throw new ForbiddenException();
    if (!consoleReader && applicationId && applicationId !== actor.applicationId) return { items: [], nextCursor: null };
    if (!consoleReader && tenantId && !actor.tenantIds.includes(tenantId)) return { items: [], nextCursor: null };
    const where = {
      applicationId: consoleReader ? applicationId : actor.applicationId,
      ...(!consoleReader ? { principalId: actor.id } : {}),
      ...(tenantId ? { tenantId } : !consoleReader ? { OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] } : {})
    };
    const rows = await this.db.oicProviderAttempt.findMany({
      where,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
      select: { id: true, applicationId: true, tenantId: true, principalId: true, connectionId: true, bindingId: true, traceId: true, requestId: true, attemptKey: true, providerKey: true, upstreamModelId: true, transportProfile: true, status: true, usageStatus: true, sourceDigest: true, safeErrorCode: true, startedAt: true, completedAt: true, _count: { select: { usageEvents: true } } }
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }
}
