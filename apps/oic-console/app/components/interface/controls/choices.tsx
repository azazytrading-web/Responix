"use client";

import { useId } from "react";
import { Button as SelectButton, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components/Select";
import { Radio, RadioGroup } from "react-aria-components/RadioGroup";
import { Switch, SwitchField } from "react-aria-components/Switch";
import type { InterfaceDirection, InterfaceLocale, PermissionState } from "../foundation/types";

export type ChoiceOption = { id: string; label: string; description?: string; disabled?: boolean };

export function SegmentedControl({ label, value, onChange, options, dir = "ltr", permission = { kind: "allowed" } }: { label: string; value: string; onChange: (value: string) => void; options: readonly ChoiceOption[]; dir?: InterfaceDirection; permission?: PermissionState }) {
  const blocked = permission.kind !== "allowed" && permission.kind !== "read-only";
  return <RadioGroup className="oi-segmented-control" aria-label={label} value={value} onChange={onChange} isDisabled={blocked} isReadOnly={permission.kind === "read-only"} orientation="horizontal" dir={dir}>
    {options.map((option) => <Radio className="oi-segment" key={option.id} value={option.id} isDisabled={option.disabled}><span>{option.label}</span>{option.description && <small>{option.description}</small>}</Radio>)}
    {permission.kind !== "allowed" && <span className="oi-permission-note">{permission.reason}</span>}
  </RadioGroup>;
}

export function ToggleControl({ label, value, onChange, help, dir = "ltr", permission = { kind: "allowed" } }: { label: string; value: boolean; onChange: (value: boolean) => void; help?: string; dir?: InterfaceDirection; permission?: PermissionState }) {
  const id = useId();
  const blocked = permission.kind !== "allowed" && permission.kind !== "read-only";
  return <SwitchField className="oi-switch-field" isSelected={value} onChange={onChange} isDisabled={blocked} isReadOnly={permission.kind === "read-only"} dir={dir}>
    <Switch className="oi-switch" aria-describedby={help ? `${id}-help` : undefined}><span className="oi-switch-track" aria-hidden="true"><span /></span><span className="oi-switch-label">{label}</span></Switch>
    {help && <span className="oi-control-help" id={`${id}-help`}>{help}</span>}
    {permission.kind !== "allowed" && <span className="oi-permission-note">{permission.reason}</span>}
  </SwitchField>;
}

export const Toggle = ToggleControl;
export const BinarySwitch = ToggleControl;

export function MultiStateSwitch({ label, value, onChange, options, dir = "ltr" }: { label: string; value: string; onChange: (value: string) => void; options: readonly ChoiceOption[]; dir?: InterfaceDirection }) {
  return <SegmentedControl label={label} value={value} onChange={onChange} options={options} dir={dir} />;
}

export function DiscreteStepSelector({ label, value, onChange, options, placeholder, dir = "ltr", locale = "en", permission = { kind: "allowed" } }: { label: string; value: string; onChange: (value: string) => void; options: readonly ChoiceOption[]; placeholder: string; dir?: InterfaceDirection; locale?: InterfaceLocale; permission?: PermissionState }) {
  const disabled = permission.kind !== "allowed" && permission.kind !== "read-only";
  return <Select className={`oi-choice-select ${permission.kind === "read-only" ? "is-read-only" : ""}`} selectedKey={value} onSelectionChange={(key) => { if (key !== null) onChange(String(key)); }} isDisabled={disabled || permission.kind === "read-only"} aria-disabled={disabled || permission.kind === "read-only" || undefined} data-permission={permission.kind} dir={dir}>
    <Label className="oi-control-label">{label}</Label>
    <SelectButton className="oi-choice-trigger"><SelectValue>{({ selectedText }) => selectedText || placeholder}</SelectValue><span aria-hidden="true">⌄</span></SelectButton>
    <Popover className="oi-choice-popover"><ListBox className="oi-choice-list">{options.map((option) => <ListBoxItem key={option.id} id={option.id} textValue={option.label} isDisabled={option.disabled} className="oi-choice-option"><span>{option.label}</span>{option.description && <small>{option.description}</small>}</ListBoxItem>)}</ListBox></Popover>
    {permission.kind !== "allowed" && <span className="oi-permission-note">{permission.reason}</span>}
    <span className="oi-visually-hidden">{locale === "ar" ? "اختيار واحد" : "Choose one option"}</span>
  </Select>;
}

export function ParameterMatrix({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`oi-parameter-matrix ${className}`.trim()} role="table" aria-label={label}>{children}</div>;
}
