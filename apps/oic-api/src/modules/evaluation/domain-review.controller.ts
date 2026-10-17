import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard, RequireScopes } from "../identity/auth.guard";
import { DomainReviewService } from "./domain-review.service";

const uuid = z.string().uuid();
const body = (value: unknown): Record<string, unknown> => {
  const parsed = z.record(z.unknown()).safeParse(value);
  if (!parsed.success) throw new BadRequestException("Invalid domain review request");
  return parsed.data;
};
@ApiTags("OIC Packet 7.5 Domain Content Review")
@ApiBearerAuth()
@Controller("admin/evaluations/domain-review")
@UseGuards(OicAuthenticationGuard, OicScopeGuard)
@RequireScopes("oic:evaluation:manage")
export class DomainReviewController {
  constructor(private readonly reviews: DomainReviewService) {}

  @Version("1") @Get("qualifications") qualifications(@CurrentPrincipal() actor: AuthenticatedPrincipal) {
    return this.reviews.listArabicQualifications(actor);
  }

  @Version("1") @Post("qualifications") attestQualifications(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() raw: unknown) {
    const input = body(raw);
    if (!Array.isArray(input.reviewerIds) || input.reviewerIds.some((id) => typeof id !== "string" || !uuid.safeParse(id).success)) throw new BadRequestException("Two reviewer identities are required");
    return this.reviews.attestArabicQualifications(actor, input.reviewerIds as string[]);
  }

  @Version("1") @Post("batches") prepareBatch(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() raw: unknown) {
    const input = body(raw);
    if (![input.packId, input.primaryReviewerId, input.independentReviewerId].every((id) => typeof id === "string" && uuid.safeParse(id).success)) throw new BadRequestException("Invalid domain review batch request");
    return this.reviews.prepareArabicBatch(actor, { packId: input.packId as string, primaryReviewerId: input.primaryReviewerId as string, independentReviewerId: input.independentReviewerId as string });
  }

  @Version("1") @Get("batches/:id") batch(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) {
    if (!uuid.safeParse(id).success) throw new BadRequestException("Invalid review batch ID");
    return this.reviews.getBatch(actor, id);
  }

  @Version("1") @Post("batches/:id/conflict-scope") publishConflictScope(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) {
    if (!uuid.safeParse(id).success) throw new BadRequestException("Invalid review batch ID");
    return this.reviews.ensureConflictScope(actor, id);
  }

  @Version("1") @Post("batches/:id/reconcile") reconcile(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) {
    if (!uuid.safeParse(id).success) throw new BadRequestException("Invalid review batch ID");
    return this.reviews.reconcileBatch(actor, id);
  }
}
