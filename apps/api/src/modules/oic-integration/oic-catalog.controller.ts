import { Controller, Get, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import { OicRuntimeService } from "./oic-runtime.service";

@ApiTags("Internal OIC Catalog")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "A valid workspace-bound internal operator token is required" })
@ApiForbiddenResponse({ description: "The internal OIC catalog permission is required" })
@Controller("internal/oic")
export class OicCatalogController {
  constructor(private readonly oic: OicRuntimeService) {}

  @Get("models")
  @Version("1")
  @Permissions("oic.catalog.read")
  @ApiOkResponse({ description: "Oi Model references visible to the Responix OIC runtime principal" })
  models() { return this.oic.listVisibleModels(); }
}
