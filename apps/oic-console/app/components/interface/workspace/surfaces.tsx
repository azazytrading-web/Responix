"use client";

import { useState } from "react";
import { Button as AriaButton } from "react-aria-components/Button";
import { Dialog, Heading } from "react-aria-components/Dialog";
import { Modal, ModalOverlay } from "react-aria-components/Modal";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "react-aria-components/Tabs";
import type { ReactNode } from "react";
import type { ValidationIssue } from "../foundation/types";

export function Inspector({ open, onClose, title, description, children, footer, closeLabel, dir = "ltr" }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; closeLabel: string; dir?: "ltr" | "rtl" }) {
  return <ModalOverlay className="oi-modal-overlay oi-inspector-overlay" isOpen={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }} isDismissable>
    <Modal className="oi-modal oi-inspector-modal" dir={dir}><Dialog className="oi-inspector" aria-label={title}>
      <header className="oi-inspector-header"><div><Heading slot="title">{title}</Heading>{description && <p>{description}</p>}</div><AriaButton className="oi-inspector-close" onPress={onClose} aria-label={closeLabel}>×</AriaButton></header>
      <div className="oi-inspector-body">{children}</div>{footer && <footer className="oi-inspector-footer">{footer}</footer>}
    </Dialog></Modal>
  </ModalOverlay>;
}

export function SidecarPanel({ title, summary, children, open = true }: { title: string; summary?: string; children: ReactNode; open?: boolean }) {
  return <aside className={`oi-sidecar ${open ? "is-open" : "is-closed"}`} aria-label={title}><header><b>{title}</b>{summary && <small>{summary}</small>}</header>{open && <div>{children}</div>}</aside>;
}

export function CompareSurface({ title, leftLabel, rightLabel, left, right }: { title: string; leftLabel: string; rightLabel: string; left: ReactNode; right: ReactNode }) {
  return <section className="oi-compare-surface" aria-label={title}><header><h3>{title}</h3></header><div className="oi-compare-columns"><article><h4>{leftLabel}</h4>{left}</article><article><h4>{rightLabel}</h4>{right}</article></div></section>;
}

export function WorkspaceTabs({ label, items, selected, onSelectionChange, dir = "ltr" }: { label: string; items: readonly { id: string; label: string; content: ReactNode; disabled?: boolean }[]; selected: string; onSelectionChange: (id: string) => void; dir?: "ltr" | "rtl" }) {
  return <Tabs className="oi-workspace-tabs" aria-label={label} selectedKey={selected} onSelectionChange={(key) => onSelectionChange(String(key))} dir={dir}>
    <TabList className="oi-tab-list">{items.map((item) => <Tab key={item.id} id={item.id} isDisabled={item.disabled} className="oi-tab">{item.label}</Tab>)}</TabList>
    <TabPanels className="oi-tab-panels">{items.map((item) => <TabPanel key={item.id} id={item.id} className="oi-tab-panel">{item.content}</TabPanel>)}</TabPanels>
  </Tabs>;
}

export function WizardFrame({ title, steps, active, onActiveChange, onFinish, finishLabel, backLabel, nextLabel, cancelLabel, requiredLabel, onCancel, dir = "ltr" }: { title: string; steps: readonly { id: string; label: string; content: ReactNode; validate?: () => boolean }[]; active: number; onActiveChange: (step: number) => void; onFinish: () => void; finishLabel: string; backLabel: string; nextLabel: string; cancelLabel: string; requiredLabel: string; onCancel: () => void; dir?: "ltr" | "rtl" }) {
  const [invalid, setInvalid] = useState(false);
  const step = steps[active];
  const last = active === steps.length - 1;
  const advance = () => { if (!step?.validate || step.validate()) { setInvalid(false); if (last) onFinish(); else onActiveChange(active + 1); } else setInvalid(true); };
  return <section className="oi-wizard-frame" dir={dir} aria-label={title}><ol className="oi-wizard-steps">{steps.map((item, index) => <li key={item.id} className={index === active ? "is-current" : index < active ? "is-complete" : ""} aria-current={index === active ? "step" : undefined}><span>{index + 1}</span><b>{item.label}</b></li>)}</ol><div className="oi-wizard-content" aria-live="polite">{step?.content}{invalid && <p className="oi-validation-message is-error" role="alert">{requiredLabel}</p>}</div><footer><button type="button" className="oi-action is-quiet" onClick={onCancel}>{cancelLabel}</button><span />{active > 0 && <button type="button" className="oi-action is-secondary" onClick={() => { setInvalid(false); onActiveChange(active - 1); }}>{backLabel}</button>}<button type="button" className="oi-action is-primary" onClick={advance}>{last ? finishLabel : nextLabel}</button></footer></section>;
}

export function Timeline({ label, events }: { label: string; events: readonly { id: string; title: string; detail?: string; time?: string; tone?: "neutral" | "good" | "warning" | "critical" }[] }) {
  return <ol className="oi-timeline" aria-label={label}>{events.map((event) => <li key={event.id} className={`is-${event.tone ?? "neutral"}`}><i aria-hidden="true"/><div><b>{event.title}</b>{event.detail && <p>{event.detail}</p>}</div>{event.time && <time>{event.time}</time>}</li>)}</ol>;
}

export function RelationshipPanel({ label, relationships }: { label: string; relationships: readonly { id: string; type: string; name: string; status?: string }[] }) {
  return <section className="oi-relationship-panel" aria-label={label}>{relationships.map((item) => <article key={item.id}><small>{item.type}</small><b>{item.name}</b>{item.status && <span className="oi-state-tag">{item.status}</span>}</article>)}</section>;
}

export function ValidationPanel({ title, issues, labels }: { title: string; issues: readonly ValidationIssue[]; labels: { allPassed: string; errors: string; warnings: string } }) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return <section className={`oi-validation-panel ${errors.length ? "has-errors" : ""}`} aria-label={title} aria-live="polite"><h4>{title}</h4>{issues.length === 0 ? <p className="is-clear">{labels.allPassed}</p> : <ul>{issues.map((issue) => <li key={`${issue.code}-${issue.field ?? "global"}`} className={`is-${issue.severity}`}><b>{issue.field ?? issue.code}</b><span>{issue.message}</span></li>)}</ul>}<small>{errors.length} {labels.errors} · {warnings.length} {labels.warnings}</small></section>;
}
