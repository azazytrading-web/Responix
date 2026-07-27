import { Injectable } from "@nestjs/common";
import type { DashboardRuntimeBootstrap } from "./dashboard-runtime.types";

@Injectable()
export class DashboardRuntimeCacheService {
  private readonly entries = new Map<string, DashboardRuntimeBootstrap>();
  get(key: string): DashboardRuntimeBootstrap | undefined { return this.entries.get(key); }
  set(key: string, value: DashboardRuntimeBootstrap): void { this.entries.set(key, value); }
  invalidateWorkspace(workspaceId: string): void {
    for (const key of this.entries.keys()) if (key.startsWith(`${workspaceId}:`)) this.entries.delete(key);
  }
}
