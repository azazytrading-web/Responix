import { Injectable } from "@nestjs/common";

export type BaileysDiagnosticStage = "SOCKET" | "QR" | "INBOUND" | "NORMALIZED" | "PERSISTED" | "DUPLICATE" |
  "RUNTIME" | "AGENT" | "OUTBOUND" | "DELIVERED" | "ERROR" | "SESSION";

export type BaileysDiagnosticEvent = Readonly<{
  at: string;
  stage: BaileysDiagnosticStage;
  detail: string;
  correlationId?: string;
}>;

@Injectable()
export class BaileysDiagnosticsService {
  private readonly events = new Map<string, BaileysDiagnosticEvent[]>();

  record(connectionId: string, stage: BaileysDiagnosticStage, detail: string, correlationId?: string) {
    const event = Object.freeze({ at: new Date().toISOString(), stage, detail, ...(correlationId ? { correlationId } : {}) });
    const next = [...(this.events.get(connectionId) ?? []), event].slice(-50);
    this.events.set(connectionId, next);
    return event;
  }

  recent(connectionId: string) { return Object.freeze([...(this.events.get(connectionId) ?? [])].reverse()); }

  latest(connectionId: string, stages: readonly BaileysDiagnosticStage[]) {
    const events = this.events.get(connectionId) ?? [];
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event && stages.includes(event.stage)) return event;
    }
    return undefined;
  }
}
