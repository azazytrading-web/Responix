"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionButton, EntityPicker, Inspector, SearchableSelect, TextInput } from "../../components/interface";
import { ErrorState, LoadingState } from "../../components/oic-primitives";
import { StateBeacon } from "../../components/instruments";
import type { Locale, Messages, View } from "../../i18n";
import { dateValue } from "../../format";
import type { Row, Snapshot } from "../../types";

type AuditState = "idle" | "loading" | "available" | "failed" | "denied";
type Props = { view: View; data: Snapshot | null; events: Row[]; state: AuditState; t: Messages; literal: (value: string) => string; locale: Locale; navigate: (view: View, entityId?: string) => void; loadAudit: (applicationId?: string) => Promise<void> };
const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";
const identityDestinations: Record<string, View> = { application: "applications", tenant: "tenants", "service-principal": "principals" };
const workspaceDestinations: Record<string, View> = {
  "provider-definition": "providers", "provider-connection": "providers", "upstream-model": "catalog",
  "model-family": "models", "model-edition": "models", "model-revision": "models", "model-variant": "models", "runtime-binding": "models",
  "intelligence-profile": "profiles", "intelligence-profile-revision": "profiles", "intelligence-memory": "memory", "intelligence-knowledge": "knowledge"
};
const safeTarget = (value: unknown) => text(value).toLowerCase().replaceAll("_", "-");

export function AuditView({ view, data, events, state, t, locale, navigate, loadAudit }: Props) {
  const [applicationId, setApplicationId] = useState("*");
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("*");
  const [selected, setSelected] = useState<Row | null>(null);
  const [copied, setCopied] = useState("");
  useEffect(() => { if (view === "audit") void loadAudit(applicationId === "*" ? "" : applicationId); }, [view, applicationId, loadAudit]);
  const appOptions = useMemo(() => [
    { id: "*", label: t.allApplications, type: t.applicationScope },
    ...(data?.applications ?? []).flatMap((app) => typeof app.id === "string" ? [{ id: app.id, label: text(app.displayName) || text(app.key) || t.application, secondary: text(app.key), type: t.application }] : [])
  ], [data?.applications, t.allApplications, t.applicationScope, t.application]);
  const actionOptions = useMemo(() => [
    { id: "*", label: t.allActions },
    ...Array.from(new Set(events.map((event) => text(event.action)).filter(Boolean))).sort().map((item) => ({ id: item, label: item }))
  ], [events, t.allActions]);
  const visible = useMemo(() => events.filter((event) => {
    if (action !== "*" && text(event.action) !== action) return false;
    const needle = query.trim().toLocaleLowerCase(locale === "ar" ? "ar" : "en");
    if (!needle) return true;
    return [event.action, event.actorPrincipalId, event.applicationId, event.tenantId, event.targetType, event.targetId, event.requestId, event.traceId]
      .map(text).join(" ").toLocaleLowerCase(locale === "ar" ? "ar" : "en").includes(needle);
  }), [events, action, query, locale]);
  if (view !== "audit") return null;
  const relatedView = (event: Row): View | null => {
    const targetType = safeTarget(event.targetType);
    if (targetType === "external-reference" && typeof event.tenantId === "string") return "tenants";
    if (targetType === "intelligence-execution" && typeof event.traceId === "string" && event.traceId) return "traces";
    return identityDestinations[targetType] ?? workspaceDestinations[targetType] ?? null;
  };
  const openRelated = (event: Row) => {
    const destination = relatedView(event);
    if (!destination) return;
    const type = safeTarget(event.targetType);
    const exactIdentity = identityDestinations[type] ? text(event.targetId) : type === "external-reference" ? text(event.tenantId) : type === "intelligence-execution" ? text(event.traceId) : "";
    navigate(destination, exactIdentity || undefined);
    setSelected(null);
  };
  const copyId = async (id: string) => {
    try { await navigator.clipboard.writeText(id); setCopied(id); window.setTimeout(() => setCopied(""), 1800); } catch { setCopied(""); }
  };
  const field = (label: string, value: unknown, identifier = false) => <div className="audit-inspector-field" key={label}><small>{label}</small><b>{identifier ? <bdi dir="ltr">{text(value) || "—"}</bdi> : text(value) || "—"}</b></div>;

  return <section className="panel operations-workspace audit-operations" aria-labelledby="audit-operations-title">
    <header className="operations-heading"><div><span className="section-index">OPERATIONS / PERSISTED EVIDENCE</span><h2 id="audit-operations-title">{t.audit}</h2><p>{t.auditIntro}</p></div><ActionButton variant="secondary" onPress={() => { void loadAudit(applicationId === "*" ? "" : applicationId); }} loading={state === "loading"}>{t.refresh}</ActionButton></header>
    <div className="audit-source-rack"><div><StateBeacon state={state === "denied" ? "UNAVAILABLE" : state === "failed" ? "FAULT" : state === "loading" || state === "idle" ? "IDLE" : "READY"} stateLabel={state === "available" ? t.enums.OPERATIONAL : state === "denied" ? t.unavailable : state === "failed" ? t.unavailable : t.loading}/><b>{state === "available" ? events.length : state === "loading" || state === "idle" ? t.loading : t.unavailable}</b><small>{t.auditSampleNotice}</small></div><div><span className="section-index">{t.source}</span><b>≤ 100</b><small>{t.auditEventLimit}</small></div><div><span className="section-index">{t.lifecycle}</span><b>{t.appendOnly}</b><small>{t.auditReadOnly}</small></div></div>
    <div className="audit-filter-rack" dir={locale === "ar" ? "rtl" : "ltr"}>
      <EntityPicker label={t.applicationScope} value={applicationId} onChange={setApplicationId} options={appOptions} placeholder={t.allApplications} searchLabel={t.search} emptyLabel={t.noData} dir={locale === "ar" ? "rtl" : "ltr"} locale={locale} kind="application" />
      <SearchableSelect label={t.actionFilter} value={action} onChange={setAction} options={actionOptions} placeholder={t.allActions} searchLabel={t.search} emptyLabel={t.noData} dir={locale === "ar" ? "rtl" : "ltr"} locale={locale} kind="action" />
      <TextInput label={t.searchAuditSample} value={query} onChange={setQuery} type="search" placeholder={t.search} dir={locale === "ar" ? "rtl" : "ltr"} description={t.auditSampleNotice} />
    </div>
    {state === "loading" || state === "idle" ? <LoadingState label={t.loading} /> : state === "denied" ? <ErrorState title={t.unavailable} description={t.auditDenied} /> : state === "failed" ? <ErrorState title={t.unavailable} description={t.auditUnavailable} action={<ActionButton onPress={() => { void loadAudit(applicationId === "*" ? "" : applicationId); }}>{t.retry}</ActionButton>} /> : events.length === 0 ? <div className="audit-empty"><StateBeacon state="IDLE" stateLabel={t.noData}/><h3>{t.emptyAudit}</h3><p>{t.auditReadOnly}</p></div> : visible.length === 0 ? <div className="audit-empty"><StateBeacon state="IDLE" stateLabel={t.noAuditMatches}/><h3>{t.noAuditMatches}</h3></div> : <div className="audit-event-list" role="list" aria-label={t.audit}>
      {visible.map((event, index) => {
        const destination = relatedView(event);
        const app = data?.applications.find((item) => item.id === event.applicationId);
        const tenant = data?.tenants.find((item) => item.id === event.tenantId);
        return <article className="audit-event-row" role="listitem" key={`${text(event.requestId)}:${text(event.targetId)}:${index}`}>
          <StateBeacon state="IDLE" stateLabel={t.recorded}/>
          <div className="audit-event-main"><time>{dateValue(event.occurredAt, locale)}</time><bdi dir="ltr" className="audit-event-action">{text(event.action) || "—"}</bdi><span>{text(event.targetType) || t.target} · {app ? text(app.displayName) || text(app.key) : text(event.applicationId) ? t.application : t.platformScope}{tenant ? ` · ${text(tenant.displayName) || text(tenant.key)}` : ""}</span></div>
          <ActionButton variant="quiet" size="compact" onPress={() => setSelected(event)}>{t.details}</ActionButton>
          {destination && <ActionButton variant="inline" size="compact" onPress={() => openRelated(event)}>{t.relatedWorkspace} ↗</ActionButton>}
        </article>;
      })}
    </div>}
    <footer className="operations-source-note"><StateBeacon state="READY" stateLabel={t.sourceBounded}/><span>{t.auditSampleNotice}</span></footer>
    <Inspector open={Boolean(selected)} onClose={() => setSelected(null)} title={t.auditEvent} description={t.auditReadOnly} closeLabel={t.close} dir={locale === "ar" ? "rtl" : "ltr"}>
      {selected && <div className="audit-inspector">
        <div className="audit-inspector-fields">{field(t.eventTime, dateValue(selected.occurredAt, locale))}{field(t.actor, selected.actorPrincipalId, true)}{field(t.application, selected.applicationId, true)}{field(t.tenant, selected.tenantId, true)}{field(t.eventAction, selected.action)}{field(t.targetType, selected.targetType)}{field(t.targetId, selected.targetId, true)}{field(t.request, selected.requestId, true)}{field(t.trace, selected.traceId, true)}</div>
        <p className="audit-safety-note">{t.noMetadata}</p>
        <div className="audit-inspector-actions">{[selected.targetId, selected.requestId, selected.traceId].filter((value): value is string => typeof value === "string" && !!value).map((id) => <ActionButton key={id} variant="quiet" size="compact" onPress={() => { void copyId(id); }}>{copied === id ? t.copied : t.copyIdentifier} <bdi dir="ltr">{id.slice(0, 12)}…</bdi></ActionButton>)}{relatedView(selected) && <ActionButton onPress={() => openRelated(selected)}>{t.relatedWorkspace} ↗</ActionButton>}</div>
      </div>}
    </Inspector>
  </section>;
}
