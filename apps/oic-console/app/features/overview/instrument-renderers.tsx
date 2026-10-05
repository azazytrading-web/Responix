"use client";

import { useEffect, useRef } from "react";
import { ArcMeter, CapacityRail, DistributionRail, NumericInstrument, RadialGauge, StatusRing, TelemetryStrip, VerticalPressureGauge } from "../../components/instruments";
import type { MetricDefinition, MetricInstance } from "./metric-registry";
import { InstrumentRegistry, resolveInstrument } from "./instrument-registry";
import { StableInstrumentCell } from "./flight-deck-composition";

export type DeckText = (key: string, fallback?: string) => string;
type Props = { definition: MetricDefinition; instance: MetricInstance; title: string; compact?: boolean; onSelect?: () => void; t: DeckText };
const stateTone = (value: unknown) => {
  const state = typeof value === "string" || typeof value === "number" ? String(value).toUpperCase() : "UNKNOWN";
  if (["OK", "READY", "LIVE", "HEALTHY", "ACTIVE", "COMPLETED", "SUCCESS"].includes(state)) return "good";
  if (["UNHEALTHY", "FAULT", "FAILED", "ERROR"].includes(state)) return "fault";
  if (["DEGRADED", "WARNING", "CANARY"].includes(state)) return "warn";
  return "neutral";
};
const rendererRegistry = new InstrumentRegistry();

export function Instrument({ definition, instance, title, compact = false, onSelect, t }: Props) {
  const clickable = !!onSelect;
  const value = instance.value;
  const label = t(definition.labelKey, definition.labelKey);
  const unit = definition.unit === "state" || definition.unit === "timestamp" ? "" : t(`unit_${definition.unit}`, definition.unit === "evaluation result" ? t("evaluationResult", "evaluation result") : definition.unit);
  const content = value === null ? instance.maturity === "PLANNED" ? t("unmeasured", "UNMEASURED") : t("noFeed", "NO FEED") : definition.valueType === "state" && typeof value === "string" ? <span className={`fd-state ${stateTone(value)}`}>{t(value.toUpperCase(), value)}</span> : typeof value === "object" ? (
    <span className="fd-distribution" aria-label={`${value.sampleSize} ${t("sample", "sample")}`}>
      {value.categories.map((category) => <span key={category.key} className={`fd-distribution-item ${stateTone(category.state ?? category.key)}`}><span><i aria-hidden="true" />{t(category.key.toLowerCase(), category.key)} <b>{category.count}</b></span><i className="fd-dist-track" aria-hidden="true"><i style={{ width: `${value.sampleSize ? Math.min(100, category.count / value.sampleSize * 100) : 0}%` }} /></i></span>)}
      <small>{t("sample", "sample")}: {value.sampleSize}</small>
    </span>
  ) : <><strong className="fd-value">{value}</strong>{unit && <small className="fd-unit">{unit}</small>}</>;
  const valueType = value && typeof value === "object" ? "distribution" : definition.valueType;
  const resolution = resolveInstrument(definition, rendererRegistry, valueType);
  const renderer = resolution.renderer?.key ?? "UNSUPPORTED";
  const readout = resolution.fallback ? <span className="fd-state neutral">{value === null ? "--" : content}</span> : content;
  const tone = value === null ? "neutral" : stateTone(value);
  const freshness = instance.freshness.state === "STALE" || instance.freshness.state === "AGING" ? t("stale", "STALE / AGING") : instance.state === "LIVE" && instance.freshness.state === "UNKNOWN" ? t("snapshot", "SNAPSHOT") : instance.maturity === "PLANNED" ? t("awaitingOic7", "AWAITING OIC-7") : t(instance.maturity, instance.maturity);
  const accessibleValue = value === null ? instance.maturity === "PLANNED" ? t("unmeasured", "UNMEASURED") : t("noFeed", "NO FEED") : typeof value === "object" ? `${value.sampleSize} ${t("sample", "sample")}` : definition.valueType === "state" ? t(String(value).toUpperCase(), String(value)) : String(value);
  const stableState = value === null ? instance.maturity === "PLANNED" ? t("unmeasured", "UNMEASURED") : t("noFeed", "NO FEED") : t(instance.state, instance.state);
  const instrumentReadout = value === null ? "--" : t(instance.state, instance.state);
  const visualState = instance.state === "DEGRADED" || instance.state === "FAULT" ? instance.state : value === null ? instance.maturity === "PLANNED" ? "UNMEASURED" : "UNAVAILABLE" : "LIVE";
  const statusValue = typeof value === "string" ? value.toUpperCase() : visualState;
  const visualSize = compact ? "SM" : "MD";
  let visual = resolution.fallback ? <div className="fd-unavailable-instrument"><span>{label}</span><b>{readout}</b><small>{t("source", "SOURCED VALUE")}</small></div> : null;
  if (renderer === "STATUS") visual = <StatusRing state={statusValue as never} stateLabel={value === null ? "--" : t(statusValue)} label={label} size={visualSize} />;
  else if (renderer === "NUMERIC") visual = <NumericInstrument value={typeof value === "number" || typeof value === "string" ? value : null} state={visualState} stateLabel={instrumentReadout} label={label} unit={unit} size={visualSize} />;
  else if (renderer === "RADIAL" && definition.normalRange) visual = <RadialGauge value={typeof value === "number" ? value : undefined} min={definition.normalRange[0]} max={definition.normalRange[1]} unit={unit} label={label} state={visualState} stateLabel={instrumentReadout} size={compact ? "SM" : "MD"} />;
  else if (renderer === "ARC" && definition.normalRange) visual = <ArcMeter value={typeof value === "number" ? value : undefined} min={definition.normalRange[0]} max={definition.normalRange[1]} unit={unit} label={label} state={visualState} stateLabel={instrumentReadout} size={compact ? "SM" : "MD"} />;
  else if (renderer === "CAPACITY_RAIL" && definition.normalRange) visual = <CapacityRail value={typeof value === "number" ? value : undefined} max={definition.normalRange[1]} unit={unit} label={label} state={visualState} stateLabel={instrumentReadout} size={compact ? "SM" : "MD"} />;
  else if (renderer === "VERTICAL_PRESSURE" && definition.normalRange) visual = <VerticalPressureGauge value={typeof value === "number" ? value : undefined} min={definition.normalRange[0]} max={definition.normalRange[1]} unit={unit} label={label} state={visualState} stateLabel={instrumentReadout} size={compact ? "SM" : "MD"} />;
  else if (renderer === "DISTRIBUTION" && value && typeof value === "object") visual = <DistributionRail label={label} sampleSize={value.sampleSize} categories={value.categories.map((category) => ({ key: category.key, label: t(category.key.toUpperCase(), category.key), count: category.count, stateLabel: t(String(category.state ?? category.key).toUpperCase(), String(category.state ?? category.key)), state: category.state as never }))} size={compact ? "SM" : "MD"} />;
  else if (renderer === "SPARKLINE" || renderer === "TEMPORAL") visual = <TelemetryStrip size={visualSize} label={label} source={freshness} />;
  return <div className={`fd-instrument ${compact ? "compact" : ""} renderer-${renderer.toLowerCase()} tone-${tone} ${value === null ? "is-dormant" : ""} ${clickable ? "interactive" : ""}`}>
    {clickable ? <button type="button" className="fd-instrument-hit" onClick={onSelect} aria-label={`${title}: ${label}, ${accessibleValue} / ${freshness}`}>
      <StableInstrumentCell label={label} state={stableState}>{visual}</StableInstrumentCell>
    </button> : <div className="fd-instrument-hit"><StableInstrumentCell label={label} state={stableState}>{visual}</StableInstrumentCell></div>}
  </div>;
}

export function DetailDrawer({ definition, instance, entity, onClose, onDrilldown, t }: { definition: MetricDefinition; instance: MetricInstance; entity: string; onClose: () => void; onDrilldown: () => void; t: DeckText }) {
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => { drawerRef.current?.querySelector<HTMLElement>("button")?.focus(); }, []);
  return <div className="fd-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside ref={drawerRef} className="fd-drawer" role="dialog" aria-modal="true" aria-labelledby="fd-drawer-title" dir="auto" onKeyDown={(event) => { if (event.key !== "Tab") return; const controls = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex]:not([tabindex="-1"])') ?? []); if (!controls.length) { event.preventDefault(); return; } const first = controls[0]; const last = controls.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }}>
    <header><div><small>{t("instrumentDetails", "INSTRUMENT DETAIL")} / {entity}</small><h3 id="fd-drawer-title">{t(definition.labelKey, definition.labelKey)}</h3></div><button type="button" className="button subtle" onClick={onClose}>{t("close", "Close")}</button></header>
    <dl><dt>{t("value", "Value")}</dt><dd>{instance.value === null ? t("unavailable", "UNAVAILABLE") : typeof instance.value === "object" ? `${instance.value.sampleSize} ${t("sample", "sample")}` : String(instance.value)}</dd><dt>{t("state", "State")}</dt><dd>{t(instance.state, instance.state)}</dd><dt>{t("maturity", "Maturity")}</dt><dd>{t(instance.maturity, instance.maturity)}</dd><dt>{t("freshness", "Freshness")}</dt><dd>{t(instance.freshness.state, instance.freshness.state)}{instance.freshness.observedAt ? ` / ${instance.freshness.observedAt}` : ""}</dd><dt>{t("source", "Source")}</dt><dd>{instance.source.service} / {instance.source.endpoint} / {instance.source.scope}</dd><dt>{t("semantics", "Meaning")}</dt><dd>{t(definition.descriptionKey, definition.valueSemantics)}</dd><dt>{t("thresholdContract", "Threshold contract")}</dt><dd>{definition.thresholdSemantics ?? "NO THRESHOLD CONTRACT"}</dd>{instance.reason && <><dt>{t("reason", "Availability")}</dt><dd>{t(instance.reason, instance.reason)}</dd></>}</dl>
    {definition.drilldown && <button type="button" className="button primary" onClick={onDrilldown}>{t("openWorkspace", "Open workspace")} <span aria-hidden="true">â†—</span></button>}
  </aside></div>;
}
