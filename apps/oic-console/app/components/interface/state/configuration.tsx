"use client";

import { useReducer } from "react";
import type { CommandStatus } from "./command-machine";
import type { SourceState, ValidationIssue } from "../foundation/types";
import type { InterfaceLocale } from "../foundation/types";

export type DraftPhase = "pristine" | "dirty" | "validating" | "valid" | "invalid" | "preview" | "applying" | "applied-not-verified" | "verified" | "failed" | "conflict" | "unknown-result";
export type ConfigurationDraft<T> = {
  current: T;
  proposed: T;
  revision?: string;
  phase: DraftPhase;
  issues: readonly ValidationIssue[];
  preview?: { label: string; source: SourceState };
  result?: { command: CommandStatus; message: string };
  remote?: { value: T; revision?: string };
};

export type DraftAction<T> =
  | { type: "edit"; value: T }
  | { type: "validate"; issues: readonly ValidationIssue[] }
  | { type: "preview"; label: string }
  | { type: "apply-start" }
  | { type: "apply-result"; status: CommandStatus; message: string }
  | { type: "verified"; value: T; revision?: string; message: string }
  | { type: "refresh"; value: T; revision?: string }
  | { type: "conflict"; value: T; revision?: string }
  | { type: "dismiss-conflict" }
  | { type: "reset" };

export function createDraft<T>(value: T, revision?: string): ConfigurationDraft<T> {
  return { current: value, proposed: value, revision, phase: "pristine", issues: [] };
}

export function reduceDraft<T>(state: ConfigurationDraft<T>, action: DraftAction<T>): ConfigurationDraft<T> {
  switch (action.type) {
    case "edit": return { ...state, proposed: action.value, phase: "dirty", issues: [], preview: undefined, result: undefined };
    case "validate": return { ...state, issues: action.issues, phase: action.issues.some((issue) => issue.severity === "error") ? "invalid" : "valid" };
    case "preview": return { ...state, phase: "preview", preview: { label: action.label, source: { kind: "local-preview" } } };
    case "apply-start": return state.phase === "invalid" || state.phase === "conflict" ? state : { ...state, phase: "applying", result: undefined };
    case "apply-result": return { ...state, phase: action.status === "UNKNOWN_RESULT" ? "unknown-result" : action.status === "SUCCEEDED" ? "applied-not-verified" : "failed", result: { command: action.status, message: action.message } };
    case "verified": return { ...state, current: action.value, proposed: action.value, revision: action.revision, phase: "verified", issues: [], remote: undefined, result: { command: "SUCCEEDED", message: action.message } };
    case "refresh": return isEqual(state.current, state.proposed) ? createDraft(action.value, action.revision) : { ...state, phase: "conflict", remote: { value: action.value, revision: action.revision } };
    case "conflict": return { ...state, phase: "conflict", remote: { value: action.value, revision: action.revision } };
    case "dismiss-conflict": return { ...state, phase: "dirty", remote: undefined };
    case "reset": return createDraft(state.current, state.revision);
  }
}

function isEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

export function useConfigurationDraft<T>(initial: T, revision?: string) {
  const [state, dispatch] = useReducer(reduceDraft<T>, undefined, () => createDraft(initial, revision));
  return {
    state,
    isDirty: !isEqual(state.current, state.proposed),
    edit: (value: T) => dispatch({ type: "edit", value }),
    validate: (issues: readonly ValidationIssue[]) => dispatch({ type: "validate", issues }),
    preview: (label: string) => dispatch({ type: "preview", label }),
    beginApply: () => dispatch({ type: "apply-start" }),
    applyResult: (status: CommandStatus, message: string) => dispatch({ type: "apply-result", status, message }),
    verify: (value: T, nextRevision: string | undefined, message: string) => dispatch({ type: "verified", value, revision: nextRevision, message }),
    refresh: (value: T, nextRevision?: string) => dispatch({ type: "refresh", value, revision: nextRevision }),
    markConflict: (value: T, nextRevision?: string) => dispatch({ type: "conflict", value, revision: nextRevision }),
    dismissConflict: () => dispatch({ type: "dismiss-conflict" }),
    reset: () => dispatch({ type: "reset" })
  };
}

export function ConfigurationDiff<T extends Record<string, unknown>>({ current, proposed, labels, locale = "en", columnLabels, modifiedLabel, unchangedLabel, formatValue }: { current: T; proposed: T; labels: Partial<Record<keyof T, string>>; locale?: InterfaceLocale; columnLabels?: { parameter: string; current: string; proposed: string; change: string }; modifiedLabel?: string; unchangedLabel?: string; formatValue?: (value: unknown, key: keyof T) => string }) {
  const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(proposed)])) as (keyof T)[];
  const numberFormat = new Intl.NumberFormat(locale === "ar" ? "ar" : "en", { maximumFractionDigits: 3 });
  const columns = columnLabels ?? (locale === "ar" ? { parameter: "المعامل", current: "الحالي", proposed: "المقترح", change: "التغيير" } : { parameter: "Parameter", current: "Current", proposed: "Proposed", change: "Change" });
  const valueLabel = (value: unknown, key: keyof T) => formatValue ? formatValue(value, key) : typeof value === "number" ? numberFormat.format(value) : String(value);
  return <div className="oi-diff" role="table" aria-label={locale === "ar" ? "القيم الحالية والمقترحة" : "Current and proposed values"}><div className="oi-diff-heading" role="row"><span role="columnheader">{columns.parameter}</span><span role="columnheader">{columns.current}</span><span role="columnheader">{columns.proposed}</span><span role="columnheader">{columns.change}</span></div>{keys.map((key) => {
    const changed = !isEqual(current[key], proposed[key]);
    return <div className={`oi-diff-row ${changed ? "is-changed" : ""}`} role="row" key={String(key)}><b role="rowheader">{labels[key] ?? String(key)}</b><span role="cell">{valueLabel(current[key], key)}</span><span role="cell">{valueLabel(proposed[key], key)}</span><span role="cell" className="oi-diff-change">{changed ? modifiedLabel ?? (locale === "ar" ? "معدّل" : "Modified") : unchangedLabel ?? (locale === "ar" ? "دون تغيير" : "Unchanged")}</span></div>;
  })}</div>;
}

export function PermissionPanel({ state, label, stateLabel }: { state: "allowed" | "read-only" | "denied" | "unsupported" | "unavailable"; label: string; stateLabel: string }) { return <div className={`oi-permission-panel is-${state}`} role="status"><i aria-hidden="true" /><b>{label}</b><span>{stateLabel}</span></div>; }

export function ConflictPanel({ title, detail, onKeepDraft, onUseRemote, keepLabel, remoteLabel, stateLabel }: { title: string; detail: string; onKeepDraft: () => void; onUseRemote: () => void; keepLabel: string; remoteLabel: string; stateLabel: string }) {
  return <section className="oi-conflict-panel" role="alert"><span className="oi-state-tag is-conflict">{stateLabel}</span><div><h4>{title}</h4><p>{detail}</p></div><div><button type="button" className="oi-action is-secondary" onClick={onKeepDraft}>{keepLabel}</button><button type="button" className="oi-action is-warning" onClick={onUseRemote}>{remoteLabel}</button></div></section>;
}
