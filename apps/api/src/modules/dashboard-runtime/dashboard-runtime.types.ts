import type { JsonRecord } from "../platform-control/platform-control.types";

export const DASHBOARD_LAYOUTS = ["grid", "flex", "tabs", "accordion", "wizard", "sidebar", "drawer", "modal", "split-view"] as const;
export type DashboardLayout = (typeof DASHBOARD_LAYOUTS)[number];

export interface DashboardWidgetDefinition {
  kind: string;
  version: string;
}

export interface DashboardRuntimeBootstrap {
  version: string;
  compatibilityVersion: string;
  revision: number;
  generatedAt: string;
  manifestHash: string;
  manifest: JsonRecord;
  navigation: JsonRecord;
  branding: JsonRecord | null;
  features: string[];
  permissions: string[];
  layouts: DashboardLayout[];
  widgets: DashboardWidgetDefinition[];
}
