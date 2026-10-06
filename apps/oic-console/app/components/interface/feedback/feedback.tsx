"use client";

export type ImpactKind = "known" | "local-preview" | "unknown" | "predicted";

export function ImpactFeedback({ kind, label, title, detail }: { kind: ImpactKind; label: string; title: string; detail: string }) {
  return <aside className={`oi-impact-feedback is-${kind}`}><span>{label}</span><strong>{title}</strong><p>{detail}</p></aside>;
}
