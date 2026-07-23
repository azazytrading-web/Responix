import { Injectable } from "@nestjs/common";
import { HealthIndicatorResult } from "@nestjs/terminus";

@Injectable()
export class HealthService {
  checkApi(): Promise<HealthIndicatorResult> {
    return Promise.resolve({
      api: {
        status: "up"
      }
    });
  }
}
