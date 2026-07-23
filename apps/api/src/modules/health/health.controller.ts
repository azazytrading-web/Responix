import { Controller, Get, Version } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";
import { HealthService } from "./health.service";

@ApiTags("System")
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly healthService: HealthService
  ) {}

  @Get()
  @Version("1")
  @HealthCheck()
  @ApiOkResponse({ description: "Service health status" })
  check() {
    return this.healthCheckService.check([() => this.healthService.checkApi()]);
  }
}
