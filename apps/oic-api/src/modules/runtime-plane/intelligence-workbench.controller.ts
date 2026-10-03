import { BadRequestException, Body, Controller, Post, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard, RequireScopes } from "../identity/auth.guard";
import { parseTenantSelector } from "./runtime-request";
import { IntelligenceWorkbenchService } from "./intelligence-workbench.service";

const bodySchema = z.object({ model: z.string().regex(/^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$/i).max(64), profileRevisionId: z.string().uuid(), prompt: z.string().trim().min(1).max(12_000), tenant: z.unknown().optional(), sessionId: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/).optional(), maxOutputUnits: z.number().int().min(1).max(8192).optional() }).strict();
@ApiTags("OIC Intelligence Workbench") @ApiBearerAuth() @Controller("admin/intelligence/workbench") @UseGuards(OicAuthenticationGuard, OicScopeGuard)
export class IntelligenceWorkbenchController {
  constructor(private readonly workbench: IntelligenceWorkbenchService) {}
  @Version("1") @Post("run") @RequireScopes("oic:runtime:invoke")
  run(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown) {
    const parsed = bodySchema.safeParse(body); if (!parsed.success) throw new BadRequestException("Request validation failed");
    const { tenant: rawTenant, ...input } = parsed.data;
    const tenant = rawTenant === undefined ? undefined : parseTenantSelector(rawTenant);
    return this.workbench.run(actor, { ...input, ...(tenant ? { tenant } : {}) });
  }
}
