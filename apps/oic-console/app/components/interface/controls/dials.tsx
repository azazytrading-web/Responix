"use client";

import { useId, useRef } from "react";
import { Label } from "react-aria-components/Label";
import { Slider as AriaSlider, SliderOutput, SliderThumb, SliderTrack } from "react-aria-components/Slider";
import { clampValue, formatNumber } from "../foundation/format";
import type { InterfaceDensity, InterfaceDirection, InterfaceLocale, PermissionState } from "../foundation/types";

export type RotaryDialProps = {
  label: string; value: number; onChange: (value: number) => void; min: number; max: number; step: number;
  unit?: string; help?: string; locale?: InterfaceLocale; dir?: InterfaceDirection; permission?: PermissionState;
  fineStep?: number; ticks?: number; density?: InterfaceDensity;
};

function scalarValue(value: unknown, fallback: number): number {
  if (typeof value === "number") return value;
  if (Array.isArray(value) && typeof value[0] === "number") return value[0];
  return fallback;
}

export function RotaryDial({ label, value, onChange, min, max, step, unit, help, locale = "en", dir = "ltr", permission = { kind: "allowed" }, fineStep, ticks = 9, density = "standard" }: RotaryDialProps) {
  const id = useId();
  const faceRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<number | null>(null);
  const disabled = permission.kind !== "allowed" && permission.kind !== "read-only";
  const ratio = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const rotation = -135 + ratio * 270;

  const setFromPointer = (clientX: number, clientY: number) => {
    const face = faceRef.current;
    if (!face || disabled || permission.kind === "read-only") return;
    const rect = face.getBoundingClientRect();
    const angle = (Math.atan2(clientY - rect.top - rect.height / 2, clientX - rect.left - rect.width / 2) * 180 / Math.PI + 360) % 360;
    const relative = (angle - 225 + 360) % 360;
    const nextRatio = Math.min(1, relative / 270);
    onChange(clampValue(min + nextRatio * (max - min), min, max, step));
  };

  const onDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || disabled || permission.kind === "read-only") return;
    pointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromPointer(event.clientX, event.clientY);
  };
  const onMove = (event: React.PointerEvent<HTMLDivElement>) => { if (pointerRef.current === event.pointerId) setFromPointer(event.clientX, event.clientY); };
  const onUp = (event: React.PointerEvent<HTMLDivElement>) => { if (pointerRef.current === event.pointerId) pointerRef.current = null; };

  return <section className={`oi-dial oi-density-${density} ${disabled ? "is-disabled" : ""}`} dir={dir}>
    <div className="oi-control-head"><span className="oi-control-label">{label}</span><output className="oi-control-readout">{formatNumber(value, { locale, unit })}</output></div>
    {help && <p className="oi-control-help" id={`${id}-help`}>{help}</p>}
    <div className="oi-dial-stage">
      <div ref={faceRef} className="oi-dial-face" style={{ "--oi-dial-angle": `${rotation}deg`, "--oi-dial-sweep": `${ratio * 270}deg` } as React.CSSProperties} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className="oi-dial-arc" aria-hidden="true" />
        {Array.from({ length: ticks }, (_, index) => <i key={index} className={index % 2 === 0 ? "is-major" : ""} style={{ "--tick-angle": `${-135 + index * 270 / Math.max(1, ticks - 1)}deg` } as React.CSSProperties} aria-hidden="true" />)}
        <span className="oi-dial-pointer" aria-hidden="true" />
        <span className="oi-dial-value" aria-hidden="true">{formatNumber(value, { locale, maximumFractionDigits: 2 })}<small>{unit ?? ""}</small></span>
        <span className="oi-dial-limit is-min" aria-hidden="true">{formatNumber(min, { locale })}</span><span className="oi-dial-limit is-max" aria-hidden="true">{formatNumber(max, { locale })}</span>
      </div>
      <AriaSlider className={permission.kind === "read-only" ? "oi-dial-keyboard is-read-only" : "oi-dial-keyboard"} minValue={min} maxValue={max} step={step} value={value} onChange={(next) => onChange(scalarValue(next, min))} isDisabled={disabled || permission.kind === "read-only"} aria-disabled={permission.kind !== "allowed" || undefined} data-permission={permission.kind} dir={dir} aria-describedby={help ? `${id}-help` : undefined}>
        <Label>{label}</Label><SliderOutput>{formatNumber(value, { locale, unit })}</SliderOutput><SliderTrack><SliderThumb aria-label={label} /></SliderTrack>
      </AriaSlider>
    </div>
    <div className="oi-dial-controls"><button type="button" className="oi-dial-adjust" disabled={disabled || permission.kind === "read-only"} aria-label={`${label} ${locale === "ar" ? "إنقاص" : "decrease"}`} onClick={() => onChange(clampValue(value - (fineStep ?? step / 10), min, max, fineStep ?? step / 10))}>−</button><span>{help ?? (locale === "ar" ? "ضبط دقيق" : "Fine adjust")}</span><button type="button" className="oi-dial-adjust" disabled={disabled || permission.kind === "read-only"} aria-label={`${label} ${locale === "ar" ? "زيادة" : "increase"}`} onClick={() => onChange(clampValue(value + (fineStep ?? step / 10), min, max, fineStep ?? step / 10))}>+</button></div>
    {permission.kind !== "allowed" && <p className="oi-permission-note">{permission.reason}</p>}
  </section>;
}

export function FineAdjustDial(props: RotaryDialProps) { return <RotaryDial {...props} fineStep={props.fineStep ?? props.step / 10} />; }
export function PrecisionKnob(props: RotaryDialProps) { return <FineAdjustDial {...props} />; }
