"use client";

import { Input, Label, TextField } from "react-aria-components/TextField";

export function TextInput({ label, value, onChange, placeholder, required = false, maxLength, dir = "ltr", type = "text", disabled = false, description }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; maxLength?: number; dir?: "ltr" | "rtl"; type?: "text" | "email" | "search" | "datetime-local"; disabled?: boolean; description?: string }) {
  return <TextField className="oi-text-field" isRequired={required} maxLength={maxLength} isDisabled={disabled} dir={dir}>
    <Label className="oi-control-label">{label}</Label>
    <Input className="oi-text-input" type={type} value={value} onChange={(event) => onChange(event.currentTarget.value)} placeholder={placeholder} />
    {description && <span className="oi-control-help">{description}</span>}
  </TextField>;
}
