import type { MetricDefinition } from "./metric-registry";

export type InstrumentRenderer = {
  key: string;
  family: string;
  accessibleFallback: "TEXT_VALUE" | "STATUS_TEXT" | "DISTRIBUTION_LIST" | "UNAVAILABLE";
  accepts: readonly ("number" | "state" | "distribution")[];
  description: string;
};

export const instrumentRenderers: readonly InstrumentRenderer[] = [
  { key: "STATUS", family: "status", accessibleFallback: "STATUS_TEXT", accepts: ["state"], description: "Text-first categorical source state." },
  { key: "NUMERIC", family: "numeric", accessibleFallback: "TEXT_VALUE", accepts: ["number"], description: "Scalar with its registered unit and source." },
  { key: "RADIAL", family: "radial", accessibleFallback: "TEXT_VALUE", accepts: ["number"], description: "Bounded value with explicit registered range." },
  { key: "ARC", family: "arc", accessibleFallback: "TEXT_VALUE", accepts: ["number"], description: "Bounded one-dimensional value with explicit registered range." },
  { key: "CAPACITY_RAIL", family: "capacity-rail", accessibleFallback: "TEXT_VALUE", accepts: ["number"], description: "Used/limit only when both are returned for the same scope." },
  { key: "VERTICAL_PRESSURE", family: "vertical-pressure", accessibleFallback: "TEXT_VALUE", accepts: ["number"], description: "Ordered pressure with registered direction and range." },
  { key: "DISTRIBUTION", family: "distribution", accessibleFallback: "DISTRIBUTION_LIST", accepts: ["distribution"], description: "Categorical counts with a visible sample denominator." },
  { key: "SPARKLINE", family: "sparkline", accessibleFallback: "UNAVAILABLE", accepts: ["number"], description: "Requires timestamped source-retained samples and explicit gaps." },
  { key: "TEMPORAL", family: "temporal", accessibleFallback: "UNAVAILABLE", accepts: ["number"], description: "Requires source-supported retained time windows." },
  { key: "DNA", family: "dna", accessibleFallback: "UNAVAILABLE", accepts: ["number"], description: "Requires versioned evaluator output and sample provenance." }
];

export class InstrumentRegistry {
  private readonly renderers = new Map<string, InstrumentRenderer>();
  constructor(initial: readonly InstrumentRenderer[] = instrumentRenderers) { for (const renderer of initial) this.register(renderer); }
  register(renderer: InstrumentRenderer) {
    if (!renderer.key.trim() || !renderer.family.trim() || renderer.accepts.length === 0) throw new Error("Invalid instrument renderer definition.");
    if (this.renderers.has(renderer.key)) throw new Error(`Instrument renderer ${renderer.key} is already registered.`);
    this.renderers.set(renderer.key, Object.freeze({ ...renderer, accepts: Object.freeze([...renderer.accepts]) }));
  }
  get(key: string) { return this.renderers.get(key); }
}

export type InstrumentResolution = { renderer: InstrumentRenderer | null; fallback: "UNSUPPORTED_INSTRUMENT" | "VALUE_TYPE_MISMATCH" | null; textOnly: boolean };

export function resolveInstrument(definition: MetricDefinition, registry: InstrumentRegistry, valueType: "number" | "state" | "distribution"): InstrumentResolution {
  const renderer = definition.visualizationHints.map((hint) => registry.get(hint)).find((candidate) => candidate?.accepts.includes(valueType));
  if (renderer) return { renderer, fallback: null, textOnly: false };
  const knownHints = definition.visualizationHints.some((hint) => !!registry.get(hint));
  return { renderer: null, fallback: knownHints ? "VALUE_TYPE_MISMATCH" : "UNSUPPORTED_INSTRUMENT", textOnly: true };
}

export function supportsHistoricalSamples(definition: MetricDefinition, renderer: InstrumentRenderer) {
  return definition.historySupport === "SOURCE_RETAINED" && (renderer.key === "SPARKLINE" || renderer.key === "TEMPORAL");
}
