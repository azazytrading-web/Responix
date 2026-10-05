export type ArcSweep = "SEMI" | "EXTENDED_SEMI" | "THREE_QUARTER";
export const ARC_SWEEPS: Readonly<Record<ArcSweep, number>> = { SEMI: 180, EXTENDED_SEMI: 220, THREE_QUARTER: 270 };
export function arcSweepDegrees(sweep: ArcSweep = "EXTENDED_SEMI") { return ARC_SWEEPS[sweep]; }
export function tickPlan(size: "XS" | "SM" | "MD" | "LG") {
  return ({ XS: { count: 8, majorEvery: 4 }, SM: { count: 14, majorEvery: 4 }, MD: { count: 24, majorEvery: 4 }, LG: { count: 36, majorEvery: 4 } } as const)[size];
}

export type Polarity = "HIGH_IS_BAD" | "LOW_IS_BAD" | "HIGH_IS_GOOD" | "LOW_IS_GOOD" | "TARGET_RANGE" | "NEUTRAL" | "CUSTOM";
export type ThresholdState = "NORMAL" | "ELEVATED" | "WARNING" | "SEVERE" | "CRITICAL" | "TARGET";
export type ThresholdZone = { from: number; to: number; state: ThresholdState; label?: string; tone?: "good" | "lime" | "amber" | "warn" | "fault" };
export type SemanticScale = { polarity: Polarity; zones?: readonly ThresholdZone[]; targetRange?: readonly [number, number] };
export type GradientStop = { offset: number; color: string };

const semanticColors: Record<ThresholdState, string> = { NORMAL: "var(--oii-green)", ELEVATED: "var(--oii-lime)", WARNING: "var(--oii-amber)", SEVERE: "var(--oii-orange)", CRITICAL: "var(--oii-red)", TARGET: "var(--oii-green)" };
const semanticTones: Record<ThresholdState, "good" | "lime" | "amber" | "warn" | "fault"> = { NORMAL: "good", ELEVATED: "lime", WARNING: "amber", SEVERE: "warn", CRITICAL: "fault", TARGET: "good" };

export function resolveThresholdZone(value: number | undefined, scale?: SemanticScale): ThresholdZone | null {
  if (!Number.isFinite(value) || !scale) return null;
  const zones = [...(scale.zones ?? [])].sort((a, b) => a.from - b.from);
  if (zones.some((zone) => !Number.isFinite(zone.from) || !Number.isFinite(zone.to) || zone.to <= zone.from) || zones.some((zone, i) => i > 0 && zones[i - 1].to !== zone.from)) return null;
  const explicit = zones.find((zone, i) => value! >= zone.from && (value! < zone.to || (i === zones.length - 1 && value! <= zone.to)));
  if (explicit) return explicit;
  if (scale.polarity === "TARGET_RANGE" && scale.targetRange && value! >= scale.targetRange[0] && value! <= scale.targetRange[1]) return { from: scale.targetRange[0], to: scale.targetRange[1], state: "TARGET", label: "TARGET" };
  return null;
}

export function semanticTone(value: number | undefined, scale?: SemanticScale): "good" | "lime" | "amber" | "warn" | "fault" {
  const zone = resolveThresholdZone(value, scale);
  if (!zone) return "amber";
  return zone.tone ?? semanticTones[zone.state];
}

/** Returns no gradient unless explicit contiguous bands span the declared metric range and polarity is directional. */
export function semanticGradientStops(min: number, max: number, scale?: SemanticScale): GradientStop[] | null {
  if (!scale || !["HIGH_IS_BAD", "LOW_IS_BAD", "HIGH_IS_GOOD", "LOW_IS_GOOD"].includes(scale.polarity) || max <= min) return null;
  const zones = [...(scale.zones ?? [])].sort((a, b) => a.from - b.from);
  if (!zones.length || zones.some((zone) => !Number.isFinite(zone.from) || !Number.isFinite(zone.to) || zone.to <= zone.from) || zones[0].from !== min || zones.at(-1)!.to !== max) return null;
  for (let i = 1; i < zones.length; i++) if (zones[i - 1].to !== zones[i].from) return null;
  const normalized = zones.map((zone) => ({ from: Math.max(min, zone.from), to: Math.min(max, zone.to), tone: zone.tone ?? semanticTones[zone.state] })).filter((zone) => zone.to >= zone.from);
  if (!normalized.length || normalized[0].from !== min || normalized.at(-1)!.to !== max) return null;
  const ascendingRisk = scale.polarity === "HIGH_IS_BAD" || scale.polarity === "LOW_IS_GOOD";
  const rank = (tone: string) => ({ good: 0, lime: 1, amber: 2, warn: 3, fault: 4 }[tone] ?? -1);
  if (ascendingRisk && normalized.some((zone, i) => i > 0 && rank(zone.tone) < rank(normalized[i - 1].tone))) return null;
  if (!ascendingRisk && normalized.some((zone, i) => i > 0 && rank(zone.tone) > rank(normalized[i - 1].tone))) return null;
  return normalized.flatMap((zone) => [
    { offset: (zone.from - min) / (max - min) * 100, color: zone.tone === "good" ? semanticColors.NORMAL : zone.tone === "lime" ? semanticColors.ELEVATED : zone.tone === "amber" ? semanticColors.WARNING : zone.tone === "warn" ? semanticColors.SEVERE : semanticColors.CRITICAL },
    { offset: (zone.to - min) / (max - min) * 100, color: zone.tone === "good" ? semanticColors.NORMAL : zone.tone === "lime" ? semanticColors.ELEVATED : zone.tone === "amber" ? semanticColors.WARNING : zone.tone === "warn" ? semanticColors.SEVERE : semanticColors.CRITICAL }
  ]);
}
