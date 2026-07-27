import { Injectable } from "@nestjs/common";
import { DASHBOARD_LAYOUTS, type DashboardLayout } from "./dashboard-runtime.types";

@Injectable()
export class LayoutRegistryService {
  private readonly layouts = new Set<string>(DASHBOARD_LAYOUTS);
  has(layout: string): boolean { return this.layouts.has(layout); }
  list(): DashboardLayout[] { return [...DASHBOARD_LAYOUTS]; }
}
