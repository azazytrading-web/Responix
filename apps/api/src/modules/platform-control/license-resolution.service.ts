import { Injectable } from "@nestjs/common";
import { PlatformControlRepository } from "./platform-control.repository";
import type { LicenseSnapshot } from "./platform-control.types";

@Injectable()
export class LicenseResolutionService {
  constructor(private readonly repository: PlatformControlRepository) {}

  async resolve(workspaceId: string, now = new Date()): Promise<LicenseSnapshot & { active: boolean }> {
    const license = await this.repository.licenseSnapshot(workspaceId);
    const validUntil = license.expiresAt ?? license.graceEndsAt;
    const active = license.status === "ACTIVE" || license.status === "TRIAL" || (validUntil !== null && validUntil > now);
    return { ...license, active };
  }
}
