export interface DashboardPlugin {
  id: string;
  name: string;
  version: string;
  icon?: string;
  permissions: string[];
  featureFlags?: string[];
  routes: PluginRoute[];
  navigation?: PluginNavigationItem[];
  widgets?: PluginWidgetRegistration[];
}

export interface PluginRoute {
  path: string;
  labelKey: string;
  icon?: string;
  permissions?: string[];
}

export interface PluginNavigationItem {
  labelKey: string;
  route: string;
  icon?: string;
  children?: PluginNavigationItem[];
  permissions?: string[];
}

export interface PluginWidgetRegistration {
  id: string;
  name: string;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  maxSize?: { w: number; h: number };
}
