import { Controller, Get, ServiceUnavailableException, Version } from "@nestjs/common";
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { OicDatabaseService } from "@oic/database";
import { OIC_CONTRACT_VERSION } from "@oic/contracts";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly database: OicDatabaseService) {}

  @Get("live")
  @Version("1")
  @ApiOkResponse({ description: "OIC process is alive" })
  live() {
    return { status: "ok", service: "oic-api", contractVersion: OIC_CONTRACT_VERSION };
  }

  @Get("ready")
  @Version("1")
  @ApiOkResponse({ description: "OIC is ready" })
  @ApiServiceUnavailableResponse({ description: "A required OIC dependency is unavailable" })
  async ready() {
    try {
      await this.database.$queryRaw`SELECT 1`;
      return { status: "ok", service: "oic-api", checks: { database: "ok" } };
    } catch {
      throw new ServiceUnavailableException({
        status: "error",
        service: "oic-api",
        checks: { database: "unavailable" }
      });
    }
  }
}