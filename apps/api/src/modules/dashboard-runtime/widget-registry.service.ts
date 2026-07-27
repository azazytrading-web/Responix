import { Injectable } from "@nestjs/common";
import type { DashboardWidgetDefinition } from "./dashboard-runtime.types";

@Injectable()
export class WidgetRegistryService {
  private readonly definitions = new Map<string, DashboardWidgetDefinition>();

  constructor() {
    for (const kind of ["table", "card", "metric", "chart", "timeline", "form", "list", "calendar", "kanban", "markdown", "custom"]) {
      this.register({ kind, version: "1.0" });
    }
  }

  register(definition: DashboardWidgetDefinition): void {
    if (this.definitions.has(definition.kind)) throw new Error(`Dashboard widget '${definition.kind}' is already registered`);
    this.definitions.set(definition.kind, Object.freeze({ ...definition }));
  }

  has(kind: string): boolean { return this.definitions.has(kind); }
  list(): DashboardWidgetDefinition[] { return [...this.definitions.values()].map((definition) => ({ ...definition })); }
}
