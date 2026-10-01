"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { entryText } from "../../format";
import type { Row } from "../../types";

export function SecretAction({
  title,
  label,
  submitLabel,
  onSubmit
}: {
  title: string;
  label: string;
  submitLabel: string;
  onSubmit: (values: Row) => Promise<Row | null>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const credential = entryText(new FormData(form).get("credential"));
    if (!credential) return;
    setBusy(true);
    let result: Row | null = null;
    try {
      result = await onSubmit({ credential });
    } finally {
      form.reset();
      setBusy(false);
    }
    if (result) setOpen(false);
  };
  return (
    <div className="inline-form-wrap">
      {!open ? (
        <button type="button" className="button subtle small-button" onClick={() => setOpen(true)}>
          {title}
        </button>
      ) : (
        <form
          className="inline-form secret-input-form"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <label>
            {label}
            <input
              type="password"
              name="credential"
              autoComplete="new-password"
              minLength={8}
              maxLength={4096}
              required
            />
          </label>
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
