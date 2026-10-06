"use client";

import { Button as AriaButton, Group, Input, Label, NumberField as AriaNumberField } from "react-aria-components/NumberField";
import { useId } from "react";
import { formatNumber } from "../foundation/format";
import type { InterfaceDensity, InterfaceDirection, InterfaceLocale, PermissionState } from "../foundation/types";

export type NumericStepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  help?: string;
  error?: string;
  stateLabel?: string;
  locale?: InterfaceLocale;
  dir?: InterfaceDirection;
  density?: InterfaceDensity;
  disabled?: boolean;
  permission?: PermissionState;
};

export function NumericStepper({ label, value, onChange, min, max, step, unit, help, error, stateLabel, locale = "en", dir = "ltr", density = "standard", disabled = false, permission = { kind: "allowed" } }: NumericStepperProps) {
  const id = useId();
  const blocked = disabled || (permission.kind !== "allowed" && permission.kind !== "read-only");
  return <AriaNumberField className={`oi-number-field oi-density-${density}`} value={value} onChange={onChange} minValue={min} maxValue={max} step={step} isDisabled={blocked} isReadOnly={permission.kind === "read-only"} isInvalid={Boolean(error)} dir={dir} aria-describedby={[help ? `${id}-help` : undefined, error ? `${id}-error` : undefined, permission.kind !== "allowed" ? `${id}-permission` : undefined].filter(Boolean).join(" ") || undefined}>
    <Label className="oi-control-label">{label}</Label>
    <Group className="oi-number-group">
      <AriaButton slot="decrement" className="oi-step-button" aria-label={`${label} ${locale === "ar" ? "إنقاص" : "decrease"}`}>−</AriaButton>
      <Input className="oi-number-input" aria-label={label} />
      <AriaButton slot="increment" className="oi-step-button" aria-label={`${label} ${locale === "ar" ? "زيادة" : "increase"}`}>+</AriaButton>
    </Group>
    {(unit || help) && <span className="oi-number-meta">{unit && <b>{unit}</b>}{help && <small id={`${id}-help`}>{help}</small>}</span>}
    {error && <span className="oi-validation-message is-error" id={`${id}-error`} role="alert">{error}</span>}
    {stateLabel && <span className="oi-control-state">{stateLabel}</span>}
    {permission.kind !== "allowed" && <span className="oi-permission-note" id={`${id}-permission`}>{permission.reason}</span>}
    <span className="oi-visually-hidden">{locale === "ar" ? `من ${formatNumber(min, { locale, unit })} إلى ${formatNumber(max, { locale, unit })} بخطوة ${formatNumber(step, { locale })}` : `${formatNumber(min, { locale, unit })} to ${formatNumber(max, { locale, unit })}, step ${formatNumber(step, { locale })}`}</span>
  </AriaNumberField>;
}

export function IncrementDecrementControl(props: NumericStepperProps) { return <NumericStepper {...props} />; }
