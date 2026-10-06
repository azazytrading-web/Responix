import type { CSSProperties, ReactNode } from "react";
import { ArcMeter, CapacityRail, DistributionRail, NumericInstrument, RadialGauge, resolveThresholdZone, StatusRing, TelemetryStrip, VerticalPressureGauge } from "../../components/instruments";
import type { InstrumentState, SemanticScale } from "../../components/instruments";
import type { Locale } from "../../i18n";

export type CompositionSize = "XS" | "SM" | "MD" | "LG";
export const compositionMinimumWidth: Record<CompositionSize, number> = { XS: 96, SM: 164, MD: 210, LG: 276 };

export type ShowcaseSignalKind = "status" | "radial" | "arc" | "pressure" | "rail" | "numeric" | "distribution" | "telemetry";
export type ShowcaseSignal = {
  id: string;
  label: string;
  labelAr: string;
  kind: ShowcaseSignalKind;
  value?: number | string | null;
  min?: number;
  max?: number;
  unit?: string;
  state: InstrumentState;
  stateLabel: string;
  stateLabelAr: string;
  scale?: SemanticScale;
  samples?: readonly number[];
  categories?: readonly { key: string; label: string; labelAr: string; count: number; state: InstrumentState }[];
  sampleSize?: number;
};
export type ShowcaseModelTelemetry = {
  state: InstrumentState;
  stateLabel: string;
  stateLabelAr: string;
  profile: string;
  provider: string;
  intelligence: number;
  reliability: number;
  utilization: number;
  latency: number;
  context: number;
  dna: readonly { id: string; label: string; labelAr: string; state: "MEASURED" | "UNMEASURED" | "INSUFFICIENT_DATA"; value?: number; confidence?: number }[];
};
export type ShowcaseOverviewData = {
  system: readonly ShowcaseSignal[];
  vitals?: readonly ShowcaseSignal[];
  coreLoadEnergyDraw?: number | null;
  models: Readonly<Record<string, ShowcaseModelTelemetry>>;
  providers: Readonly<Record<string, { load: number; latency: number; throughput: number }>>;
  factory: { throughput: number; completed: number; warningStage: string | null; dormant: boolean };
  lab: { runs: number; verification: number; evaluation: number; samples: readonly number[] };
  cognitive: readonly ShowcaseSignal[];
  operations: readonly ShowcaseSignal[];
};

export function FlightDeckSection({ index, title, help, action, className = "", children }: { index: string; title: string; help?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return <section className={`fd-section fd-composition-section ${className}`.trim()}>
    <header className="fd-section-head"><span className="fd-index">{index}</span><h3>{title}</h3>{help && <p>{help}</p>}{action}</header>
    {children}
  </section>;
}

export function InstrumentRack({ children, size = "SM", className = "" }: { children: ReactNode; size?: CompositionSize; className?: string }) {
  return <div className={`fd-instrument-rack fd-rack-${size.toLowerCase()} ${className}`.trim()} style={{ "--fd-rack-min": `${compositionMinimumWidth[size]}px` } as CSSProperties}>{children}</div>;
}

export function GaugeCluster({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`fd-gauge-cluster ${className}`.trim()}>{children}</div>;
}

export function MetricBay({ title, className = "", children }: { title: string; className?: string; children: ReactNode }) {
  return <section className={`fd-metric-bay ${className}`.trim()} aria-label={title}><h4>{title}</h4>{children}</section>;
}

export function SubsystemDeck({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`fd-subsystem-deck ${className}`.trim()}>{children}</div>;
}

export function SensorRack({ children, label }: { children: ReactNode; label: string }) {
  return <div className="fd-sensor-rack" role="group" aria-label={label}>{children}</div>;
}

export function StableInstrumentCell({ label, state, children, className = "" }: { label: string; state?: string; children: ReactNode; className?: string }) {
  return <div className={`fd-stable-instrument-cell ${className}`.trim()} role="group" aria-label={state ? `${label}: ${state}` : label}>
    <span className="fd-stable-instrument-label">{label}</span>
    <div className="fd-stable-instrument-geometry">{children}</div>
    {state && <small className="fd-stable-instrument-state" title={state}>{state}</small>}
  </div>;
}

export function DNAStation({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <section className={`fd-dna-station ${className}`.trim()} aria-label={label}>{children}</section>;
}

export function OperationsStrip({ children }: { children: ReactNode }) {
  return <div className="fd-operations-strip">{children}</div>;
}

export function FlightDeckBoard({ children, label }: { children: ReactNode; label: string }) {
  return <div className="fd-board" role="group" aria-label={label} data-layout="12-column-responsive">{children}</div>;
}

export function ShowcaseSignalInstrument({ signal, locale, size = "SM", onSelect }: { signal: ShowcaseSignal; locale: Locale; size?: CompositionSize; onSelect?: () => void }) {
  const label = locale === "ar" ? signal.labelAr : signal.label;
  const rangeState = typeof signal.value === "number" ? resolveThresholdZone(signal.value, signal.scale)?.label ?? resolveThresholdZone(signal.value, signal.scale)?.state : undefined;
  const localizedRangeState = locale === "ar" ? ({ NORMAL: "طبيعي", TARGET: "ضمن النطاق", ELEVATED: "مرتفع", WARNING: "تحذير", SEVERE: "شديد", CRITICAL: "حرج" } as Record<string, string>)[rangeState ?? ""] : rangeState;
  const sourceStateLabel = signal.state === "LIVE" ? (locale === "ar" ? signal.stateLabelAr : signal.stateLabel) : signal.state;
  const fullStateLabel = localizedRangeState && signal.state === "LIVE" ? localizedRangeState : sourceStateLabel;
  const stateLabel = signal.state === "LIVE" ? fullStateLabel : "--";
  const instrumentSize = size === "XS" ? "SM" : size;
  const common = { label, state: signal.state, stateLabel, size: instrumentSize };
  const value = typeof signal.value === "number" ? signal.value : undefined;
  const visual = signal.kind === "status" ? <StatusRing {...common} />
    : signal.kind === "radial" ? <RadialGauge {...common} value={value} min={signal.min} max={signal.max} unit={signal.unit} semanticScale={signal.scale} />
    : signal.kind === "arc" ? <ArcMeter {...common} value={value} min={signal.min} max={signal.max} unit={signal.unit} semanticScale={signal.scale} />
    : signal.kind === "pressure" ? <VerticalPressureGauge {...common} value={value} min={signal.min} max={signal.max} unit={signal.unit} semanticScale={signal.scale} />
    : signal.kind === "rail" ? <CapacityRail {...common} value={value} min={signal.min} max={signal.max} unit={signal.unit} semanticScale={signal.scale} variant="WIDE" />
    : signal.kind === "numeric" ? <NumericInstrument {...common} value={typeof signal.value === "string" || typeof signal.value === "number" ? signal.value : null} unit={signal.unit} />
    : signal.kind === "distribution" ? <DistributionRail label={label} size={instrumentSize} sampleSize={signal.sampleSize ?? 0} sampleLabel={locale === "ar" ? "العينات" : "SAMPLES"} categories={(signal.categories ?? []).map((item) => ({ key: item.key, label: locale === "ar" ? item.labelAr : item.label, count: item.count, state: item.state, stateLabel: item.state }))} />
    : <TelemetryStrip label={label} samples={signal.samples} min={signal.min} max={signal.max} mode="HYBRID" size={instrumentSize} />;
  const className = `fd-showcase-signal fd-showcase-signal-${signal.kind} fd-signal-${signal.state.toLowerCase()}${onSelect ? " interactive" : ""}`;
  const accessible = `${label}: ${signal.value ?? fullStateLabel} / ${fullStateLabel}`;
  const stateText = signal.state === "UNMEASURED" || signal.state === "UNAVAILABLE" ? (locale === "ar" ? "لا توجد إشارة" : signal.state === "UNMEASURED" ? "UNMEASURED" : "NO FEED") : signal.state === "NOT_CONFIGURED" ? (locale === "ar" ? "غير مهيأ" : "NOT CONFIG.") : fullStateLabel;
  const slotState = signal.state !== "LIVE" ? stateText : ["radial", "arc", "status", "rail"].includes(signal.kind) ? fullStateLabel : "";
  const cell = <StableInstrumentCell label={label} state={slotState} className="fd-signal-cell">{visual}</StableInstrumentCell>;
  return onSelect
    ? <button type="button" className={className} title={accessible} aria-label={accessible} onClick={onSelect}>{cell}</button>
    : <div className={className} title={accessible} aria-label={accessible}>{cell}</div>;
}
