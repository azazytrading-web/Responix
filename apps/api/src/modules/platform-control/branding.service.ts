import { Injectable, NotFoundException } from "@nestjs/common";
import { PlatformControlRepository } from "./platform-control.repository";
import type { BrandingSnapshot } from "./platform-control.types";

@Injectable()
export class BrandingService {
  constructor(private readonly repository: PlatformControlRepository) {}

  async resolve(workspaceId: string): Promise<BrandingSnapshot> {
    const branding = await this.repository.branding(workspaceId);
    if (!branding) throw new NotFoundException("Workspace branding is not available");
    return branding;
  }
}
