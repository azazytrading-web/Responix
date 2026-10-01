"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { entryText } from "../format";
import type { Row } from "../types";

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
  onSubmit
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
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const values: Row = {};
    fields.forEach((field) => {
      values[field.name] = entryText(form.get(field.name)).trim();
    });
    const result = await onSubmit(values);
    setBusy(false);
    if (result) setOpen(false);
  };
  return (
    <div className="inline-form-wrap">
      {!open ? (
        <button type="button" className="button subtle" onClick={() => setOpen(true)}>
          {title} <span>＋</span>
        </button>
      ) : (
        <form
          className="inline-form"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          {fields.map((field) => (
            <label key={field.name}>
              {field.label}
              {field.options ? (
                <select name={field.name} required={field.required !== false} defaultValue="">
                  {" "}
                  <option value="" disabled>
                    —
                  </option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
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
          <button className="button primary small-button" disabled={busy}>
            {busy ? "…" : submitLabel}
          </button>
          <button
            className="button subtle small-button"
            type="button"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </form>
      )}
    </div>
  );
}
