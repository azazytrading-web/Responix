"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { entryText } from "../format";
import type { Locale } from "../i18n";
import type { Row } from "../types";
import { EntityPicker } from "./interface";

export function FilterBox({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="filter-box">
      <span>⌕</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export function FormButton({
  title,
  fields,
  submitLabel,
  onSubmit,
  locale = "en"
}: {
  title: string;
  fields: {
    name: string;
    label: string;
    required?: boolean;
    type?: "text" | "textarea";
    maxLength?: number;
    pattern?: string;
    options?: { value: string; label: string }[];
  }[];
  submitLabel: string;
  onSubmit: (values: Row) => Promise<Row | null>;
  locale?: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const missingRequiredOption = fields.some((field) => field.options && field.required !== false && !field.options.some((option) => option.value && option.value === selectedOptions[field.name]));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (missingRequiredOption) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const values: Row = {};
    fields.forEach((field) => {
      values[field.name] = entryText(form.get(field.name)).trim();
    });
    const result = await onSubmit(values);
    setBusy(false);
    if (result) { setOpen(false); setSelectedOptions({}); }
  };
  return (
    <div className="inline-form-wrap">
      {!open ? (
        <button type="button" className="button subtle" onClick={() => { setSelectedOptions({}); setOpen(true); }}>
          {title} <span>＋</span>
        </button>
      ) : (
        <form
          className="inline-form"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          {fields.map((field) => field.options ? (
            <div key={field.name} className="inline-form-choice">
              <EntityPicker name={field.name} required={field.required !== false} density="compact" label={field.label} value={field.options.some((option) => option.value === selectedOptions[field.name]) ? selectedOptions[field.name] : ""} onChange={(value) => setSelectedOptions((current) => ({ ...current, [field.name]: value }))} options={field.options.map((option) => ({ id: option.value, label: option.label }))} placeholder="—" searchLabel={field.label} emptyLabel="—" locale={locale} dir={locale === "ar" ? "rtl" : "ltr"} />
            </div>
          ) : (
            <label key={field.name}>
              {field.label}
              {field.type === "textarea" ? (
                <textarea
                  name={field.name}
                  required={field.required !== false}
                  maxLength={field.maxLength}
                  rows={3}
                />
              ) : (
                <input
                  name={field.name}
                  required={field.required !== false}
                  maxLength={field.maxLength ?? (field.name === "displayName" ? 160 : 64)}
                  pattern={field.pattern}
                />
              )}
            </label>
          ))}
          <button className="button primary small-button" disabled={busy || missingRequiredOption}>
            {busy ? "…" : submitLabel}
          </button>
          <button
            className="button subtle small-button"
            type="button"
            onClick={() => { setOpen(false); setSelectedOptions({}); }}
          >
            ×
          </button>
        </form>
      )}
    </div>
  );
}
