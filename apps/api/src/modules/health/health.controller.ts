import { Controller, Get, Version } from "@nestjs/common";
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";
import { HealthService } from "./health.service";
import { Public } from "../auth/auth.guard";

@ApiTags("System")
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly healthService: HealthService
  ) {}

  @Get()
  @Public()
  @Version("1")
  @HealthCheck()
  @ApiOkResponse({ description: "Service health status" })
  @ApiServiceUnavailableResponse({ description: "A required dependency is unavailable" })
  check() {
    return this.healthCheckService.check([
      () => this.healthService.checkApi(),
      () => this.healthService.checkDatabase(),
      () => this.healthService.checkRedis()
    ]);
  }
}
