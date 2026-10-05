import type { ShowcaseSignal } from "./flight-deck-composition";
import { coreVitalById } from "./core-vital-registry";

export type CoreLoadBand = "LOW" | "NOMINAL" | "ELEVATED" | "HIGH" | "CRITICAL";
export type CoreLoadState = "MEASURED" | "PARTIAL" | "UNMEASURED" | "STALE" | "DEMO";

export type CoreLoadContributor = {
  id: string;
  label: string;
  labelAr: string;
  unit: string;
  productionWeight?: number;
  demoWeight: number;
  sourceAdapter: string;
  maturity: "CURRENT_SOURCE" | "FUTURE_CAPABILITY";
  demoNormalization?: readonly [number, number];
};

const vital = (id: string, demoWeight = 1): CoreLoadContributor => {
  const definition = coreVitalById.get(id);
  if (!definition) throw new Error(`Core Load contributor has no Core Vital definition: ${id}`);
  return {
    id,
    label: definition.label,
    labelAr: definition.labelAr,
    unit: definition.unit,
    demoWeight,
    sourceAdapter: definition.sourceAdapter,
    maturity: definition.maturity === "CURRENT_SOURCE" ? "CURRENT_SOURCE" : "FUTURE_CAPABILITY"
  };
};

export const energyDrawContract = {
  id: "energy-draw",
  label: "Energy draw",
  labelAr: "استهلاك الطاقة",
  unit: "kW",
  supportedUnits: ["W", "kW", "Wh", "kWh"] as const,
  productionWeight: undefined,
  demoWeight: 1,
  demoNormalization: [0, 120] as const,
  sourceAdapter: "Future authoritative OIC facility or runtime energy telemetry",
  maturity: "FUTURE_CAPABILITY" as const,
  thresholdContract: "PLANNED / UNMEASURED until an authoritative power or energy meter exists. Never infer from tokens or provider cost."
};

export const coreLoadContributorRegistry: readonly CoreLoadContributor[] = [
  vital("vital.inbound-pressure"),
  vital("vital.compute-pressure"),
  vital("vital.reasoning-pressure"),
  vital("vital.context-saturation"),
  vital("vital.retrieval-load"),
  vital("vital.memory-pressure"),
  vital("vital.verification-load"),
  vital("vital.tool-execution-load"),
  vital("vital.provider-pressure"),
  vital("vital.queue-pressure"),
  vital("vital.fault-pressure"),
  energyDrawContract
];

export type CoreLoadContributorReading = CoreLoadContributor & {
  value: number | null;
  state: ShowcaseSignal["state"] | "PLANNED";
};

export type CoreLoadSummary = {
  state: CoreLoadState;
  band: CoreLoadBand | null;
  value: number | null;
  measured: number;
  total: number;
  freshness: string;
  contributors: readonly CoreLoadContributorReading[];
};

export function buildProductionCoreLoad(): CoreLoadSummary {
  return {
    state: "UNMEASURED",
    band: null,
    value: null,
    measured: 0,
    total: coreLoadContributorRegistry.length,
    freshness: "UNKNOWN · no authoritative composite source or approved weights",
    contributors: coreLoadContributorRegistry.map((definition) => ({ ...definition, value: null, state: "PLANNED" }))
  };
}

export function buildDemoCoreLoad(vitals: readonly ShowcaseSignal[], energyDraw: number | null): CoreLoadSummary {
  const byId = new Map(vitals.map((signal) => [signal.id, signal]));
  const contributors: CoreLoadContributorReading[] = coreLoadContributorRegistry.map((definition) => {
    const signal = definition.id === energyDrawContract.id ? undefined : byId.get(definition.id);
    const value = definition.id === energyDrawContract.id
      ? energyDraw
      : typeof signal?.value === "number" ? signal.value : null;
    const state = value == null ? "UNMEASURED" : signal?.state === "UNAVAILABLE" || signal?.state === "DEGRADED" || signal?.state === "FAULT" ? signal.state : "LIVE";
    return { ...definition, value, state };
  });
  const measured = contributors.filter((item) => item.value !== null && !["UNMEASURED", "UNAVAILABLE", "STALE"].includes(item.state)).length;
  const totalWeight = contributors.reduce((sum, item) => sum + (item.value !== null && !["UNMEASURED", "UNAVAILABLE", "STALE"].includes(item.state) ? item.demoWeight : 0), 0);
  const weightedLoad = contributors.reduce((sum, item) => {
    if (item.value === null || ["UNMEASURED", "UNAVAILABLE", "STALE"].includes(item.state)) return sum;
    const [minimum, maximum] = item.demoNormalization ?? [0, 100];
    const normalized = Math.max(0, Math.min(100, ((item.value - minimum) / (maximum - minimum)) * 100));
    return sum + normalized * item.demoWeight;
  }, 0);
  const value = totalWeight ? Math.round(weightedLoad / totalWeight) : null;
  return {
    state: measured === contributors.length ? "DEMO" : measured > 0 ? "PARTIAL" : "UNMEASURED",
    band: value === null ? null : coreLoadBand(value),
    value,
    measured,
    total: contributors.length,
    freshness: "DETERMINISTIC DEVELOPMENT FIXTURE · reduced-motion aware",
    contributors
  };
}

export function coreLoadBand(value: number): CoreLoadBand {
  if (value < 20) return "LOW";
  if (value < 55) return "NOMINAL";
  if (value < 70) return "ELEVATED";
  if (value < 85) return "HIGH";
  return "CRITICAL";
}
