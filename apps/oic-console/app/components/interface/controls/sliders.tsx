"use client";

import { Label as AriaLabel } from "react-aria-components/Label";
import { Slider as AriaSlider, SliderFill, SliderOutput, SliderThumb, SliderTrack } from "react-aria-components/Slider";
import type { ReactNode } from "react";
import { formatNumber } from "../foundation/format";
import type { ControlMarker, InterfaceDensity, InterfaceDirection, InterfaceLocale, PermissionState, SemanticTone } from "../foundation/types";

function scalarValue(value: unknown, fallback: number): number {
  if (typeof value === "number") return value;
  if (Array.isArray(value) && typeof value[0] === "number") return value[0];
  return fallback;
}

function rangeValue(value: unknown, min: number, max: number): [number, number] {
  if (Array.isArray(value)) {
    return [scalarValue(value[0], min), scalarValue(value[1], max)];
  }
  return [min, max];
}

export type SliderControlProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  help?: string;
  locale?: InterfaceLocale;
  dir?: InterfaceDirection;
  permission?: PermissionState;
  tone?: SemanticTone;
  markers?: readonly ControlMarker[];
  ticks?: readonly { value: number; label: string; major?: boolean }[];
  density?: InterfaceDensity;
  stateLabel?: string;
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
  onChangeEnd?: (value: number) => void;
  className?: string;
  children?: ReactNode;
};

function OiSlider({ label, value, onChange, min, max, step, unit, help, locale = "en", dir = "ltr", permission = { kind: "allowed" }, tone = "amber", markers = [], ticks = [], density = "standard", stateLabel, disabled = false, readOnly = false, id, onChangeEnd, className = "", children }: SliderControlProps) {
  const locked = disabled || permission.kind !== "allowed" || readOnly;
  const readOnlyState = readOnly || permission.kind === "read-only";
  const exact = Number.isFinite(value) ? value : min;
  const describedBy = [help ? `${id ?? "oi-slider"}-help` : undefined, stateLabel ? `${id ?? "oi-slider"}-state` : undefined, permission.kind !== "allowed" ? `${id ?? "oi-slider"}-permission` : undefined].filter(Boolean).join(" ") || undefined;
  return <AriaSlider
    className={`oi-control oi-slider oi-density-${density} oi-tone-${tone} ${locked ? "is-read-only" : ""} ${className}`.trim()}
    minValue={min}
    maxValue={max}
    step={step}
    value={exact}
    onChange={(next) => onChange(scalarValue(next, min))}
    onChangeEnd={(next) => onChangeEnd?.(scalarValue(next, min))}
    isDisabled={locked}
    data-readonly={readOnlyState || undefined}
    aria-disabled={locked || undefined}
    dir={dir}
    aria-describedby={describedBy}
    id={id}
  >
    <div className="oi-control-head">
      <AriaLabel className="oi-control-label">{label}</AriaLabel>
      <SliderOutput className="oi-control-readout">{formatNumber(exact, { locale, unit, maximumFractionDigits: 3 })}</SliderOutput>
    </div>
    {help && <p className="oi-control-help" id={`${id ?? "oi-slider"}-help`}>{help}</p>}
    <div className="oi-slider-geometry">
      <SliderTrack className="oi-slider-track">
        <SliderFill className="oi-slider-fill" />
        {markers.map((marker) => <span key={`${marker.kind}-${marker.value}`} className={`oi-slider-marker is-${marker.kind}`} style={{ "--marker-position": `${((marker.value - min) / (max - min)) * 100}%` } as React.CSSProperties} aria-hidden="true" />)}
        <SliderThumb className="oi-slider-thumb" aria-label={label} data-readout={formatNumber(exact, { locale, unit, maximumFractionDigits: 3 })} />
      </SliderTrack>
      {ticks.length > 0 && <div className="oi-slider-ticks" aria-hidden="true">{ticks.map((tick) => <span key={`${tick.value}-${tick.label}`} className={tick.major ? "is-major" : ""} style={{ "--tick-position": `${((tick.value - min) / (max - min)) * 100}%` } as React.CSSProperties}><i />{tick.major && <small>{tick.label}</small>}</span>)}</div>}
    </div>
    <div className="oi-slider-limits" aria-hidden="true"><span>{formatNumber(min, { locale, unit, maximumFractionDigits: 3 })}</span><span>{formatNumber(max, { locale, unit, maximumFractionDigits: 3 })}</span></div>
    {stateLabel && <span className="oi-control-state" id={`${id ?? "oi-slider"}-state`}>{stateLabel}</span>}
    {permission.kind !== "allowed" && <span className="oi-permission-note" id={`${id ?? "oi-slider"}-permission`}>{permission.reason}</span>}
    {children}
  </AriaSlider>;
}

export function ScalarSlider(props: SliderControlProps) { return <OiSlider {...props} />; }
export function PrecisionSlider(props: SliderControlProps & { precision?: number }) { return <OiSlider {...props} className={`oi-precision-slider ${props.className ?? ""}`} />; }
export function SteppedSlider(props: SliderControlProps) { return <OiSlider {...props} className={`oi-stepped-slider ${props.className ?? ""}`} />; }
export function IntensitySlider(props: SliderControlProps) { return <OiSlider {...props} tone="amber" className={`oi-intensity-slider ${props.className ?? ""}`} />; }
export function BudgetSlider(props: SliderControlProps) { return <OiSlider {...props} tone="good" className={`oi-budget-slider ${props.className ?? ""}`} />; }
export function WeightSlider(props: SliderControlProps) { return <OiSlider {...props} className={`oi-weight-slider ${props.className ?? ""}`} />; }
export function ThresholdSlider(props: SliderControlProps) { return <OiSlider {...props} tone="warning" className={`oi-threshold-slider ${props.className ?? ""}`} />; }

export type RangeSliderProps = Omit<SliderControlProps, "value" | "onChange" | "onChangeEnd" | "markers"> & {
  value: readonly [number, number];
  onChange: (value: [number, number]) => void;
  onChangeEnd?: (value: [number, number]) => void;
  lowerLabel?: string;
  upperLabel?: string;
  target?: number | readonly [number, number];
  targetLabel?: string;
};

export function RangeSlider({ label, value, onChange, min, max, step, unit, help, locale = "en", dir = "ltr", permission = { kind: "allowed" }, density = "standard", stateLabel, disabled = false, readOnly = false, lowerLabel, upperLabel, target, targetLabel, onChangeEnd, className = "", id }: RangeSliderProps) {
  const locked = disabled || permission.kind !== "allowed" || readOnly;
  const readOnlyState = permission.kind === "read-only" || readOnly;
  const safe = [Math.max(min, Math.min(max, value[0])), Math.max(min, Math.min(max, value[1]))] as [number, number];
  const safeTargets: number[] =
    target === undefined ? [] : typeof target === "number" ? [target] : [...target];
  const safeLowerLabel = lowerLabel ?? (locale === "ar" ? "الحد الأدنى" : "Minimum");
  const safeUpperLabel = upperLabel ?? (locale === "ar" ? "الحد الأعلى" : "Maximum");
  const describedBy = [help ? `${id ?? "oi-range"}-help` : undefined, stateLabel ? `${id ?? "oi-range"}-state` : undefined, permission.kind !== "allowed" ? `${id ?? "oi-range"}-permission` : undefined].filter(Boolean).join(" ") || undefined;
  const setRange = (next: unknown) => onChange(rangeValue(next, min, max));
  return <AriaSlider
    className={`oi-control oi-slider oi-range-slider oi-density-${density} ${locked ? "is-read-only" : ""} ${className}`.trim()}
    minValue={min} maxValue={max} step={step} value={safe} onChange={setRange}
    onChangeEnd={(next) => onChangeEnd?.(rangeValue(next, min, max))}
    isDisabled={locked} data-readonly={readOnlyState || undefined} aria-disabled={locked || undefined} dir={dir} aria-describedby={describedBy} id={id}
  >
    <div className="oi-control-head"><AriaLabel className="oi-control-label">{label}</AriaLabel><SliderOutput className="oi-control-readout">{`${formatNumber(safe[0], { locale, unit })} – ${formatNumber(safe[1], { locale, unit })}`}</SliderOutput></div>
    {help && <p className="oi-control-help" id={`${id ?? "oi-range"}-help`}>{help}</p>}
    <div className="oi-slider-geometry"><SliderTrack className="oi-slider-track"><SliderFill className="oi-slider-fill"/>{safeTargets.map((targetValue, index) => <span key={`${targetValue}-${index}`} className="oi-slider-marker is-target" style={{ "--marker-position": `${((targetValue - min) / (max - min)) * 100}%` } as React.CSSProperties} role="img" aria-label={`${targetLabel ?? label} ${formatNumber(targetValue, { locale, unit })}`}/>)}<SliderThumb className="oi-slider-thumb" aria-label={`${label} ${safeLowerLabel}`} data-readout={formatNumber(safe[0], { locale, unit })} /><SliderThumb className="oi-slider-thumb" aria-label={`${label} ${safeUpperLabel}`} data-readout={formatNumber(safe[1], { locale, unit })} /></SliderTrack></div>
    <div className="oi-slider-limits"><span>{formatNumber(min, { locale, unit })}</span><span>{formatNumber(max, { locale, unit })}</span></div>
    <div className="oi-range-values"><span>{safeLowerLabel}: <b>{formatNumber(safe[0], { locale, unit })}</b></span><span>{safeUpperLabel}: <b>{formatNumber(safe[1], { locale, unit })}</b></span></div>
    {stateLabel && <span className="oi-control-state" id={`${id ?? "oi-range"}-state`}>{stateLabel}</span>}
    {permission.kind !== "allowed" && <span className="oi-permission-note" id={`${id ?? "oi-range"}-permission`}>{permission.reason}</span>}
  </AriaSlider>;
}

export function TargetRangeControl(props: RangeSliderProps) { return <RangeSlider {...props} className={`oi-target-range ${props.className ?? ""}`} />; }

export function SliderNumericInput({ label, value, onChange, min, max, step, unit, locale = "en", dir = "ltr", help, density = "standard", permission, disabled = false, readOnly = false, stateLabel }: SliderControlProps) {
  return <div className="oi-slider-number-combo" dir={dir}>
    <ScalarSlider label={label} value={value} onChange={onChange} min={min} max={max} step={step} unit={unit} locale={locale} dir={dir} help={help} density={density} permission={permission} disabled={disabled} readOnly={readOnly} stateLabel={stateLabel} />
    <NumericStepper label={`${label} ${locale === "ar" ? "قيمة دقيقة" : "exact value"}`} value={value} onChange={onChange} min={min} max={max} step={step} unit={unit} locale={locale} dir={dir} density={density} permission={permission} disabled={disabled} stateLabel={stateLabel} />
  </div>;
}

import { NumericStepper } from "./numeric";
