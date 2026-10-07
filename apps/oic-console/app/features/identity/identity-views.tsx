"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Locale, Messages, View } from "../../i18n";
import { dateValue, getString, safeText } from "../../format";
import type { Row, Snapshot } from "../../types";
import {
  ActionButton,
  ApplicationPicker,
  ArmThenExecute,
  CommandBar,
  DangerAction,
  Inspector,
  RelationshipPanel,
  SearchableSelect,
  SegmentedControl,
  TenantPicker,
  TextInput,
  WorkspaceTabs
} from "../../components/interface";

type Props = {
  view: View; data: Snapshot; locale: Locale; t: Messages;
  filter: string; setFilter: (value: string) => void;
  badge: (value: unknown) => ReactNode;
  appLabel: (id: unknown) => string; tenantLabel: (id: unknown) => string;
  perform: (action: string, values?: Row) => Promise<Row | null>;
  issueCredential: (applicationId: unknown, principalId: unknown, replacesId?: unknown, expiresAt?: unknown) => void;
};

type EntityKind = "application" | "tenant" | "principal";
type Command = { title: string; target: string; consequence: string; action: string; values: Row; diff?: { current: string[]; proposed: string[]; added: string[]; removed: string[] } };

const scopes = ["oic:applications:read", "oic:applications:manage", "oic:tenants:read", "oic:tenants:manage", "oic:principals:read", "oic:principals:manage", "oic:credentials:rotate", "oic:credentials:revoke", "oic:audit:read", "oic:providers:read", "oic:providers:manage", "oic:connections:manage", "oic:catalog:read", "oic:catalog:manage", "oic:models:read", "oic:models:manage", "oic:runtime:invoke", "oic:runtime:models:read"];
const rowArray = (value: unknown): Row[] => Array.isArray(value) ? value.filter((row): row is Row => Boolean(row && typeof row === "object")) : [];
const idOf = (row: Row) => safeText(row.id);
const liveStatus = (row: Row) => textOr(row.status, "UNKNOWN");
const textOr = (value: unknown, fallback: string) => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
const bidi = (value: unknown) => <bdi dir="ltr" className="x14-technical">{safeText(value)}</bdi>;

export function IdentityViews({ view, data, locale, t, filter, setFilter, badge, appLabel, tenantLabel, perform, issueCredential }: Props) {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isApps = view === "applications";
  const isTenants = view === "tenants";
  const isAccess = view === "principals";
  const kind: EntityKind = isApps ? "application" : isTenants ? "tenant" : "principal";
  const rows = isApps ? data.applications : isTenants ? data.tenants : data.principals;
  const [selectedId, setSelectedId] = useState("");
  const [pendingNavigation, setPendingNavigation] = useState<{ view: string; id: string } | null>(null);
  const [lifecycle, setLifecycle] = useState("ACTIVE");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<0 | 1>(0);
  const [activeTab, setActiveTab] = useState("overview");
  const [command, setCommand] = useState<Command | null>(null);
  const [createValues, setCreateValues] = useState<Record<string, string>>({ applicationId: "", key: "", displayName: "", sourceType: "", externalId: "" });
  const [scopeChoice, setScopeChoice] = useState("");
  const [credentialExpiry, setCredentialExpiry] = useState("");
  const [tenantChoice, setTenantChoice] = useState("");
  const [localNotice, setLocalNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: string; id?: string }>).detail;
      if (detail?.view && detail.id) {
        setLifecycle("ALL");
        if (detail.view === "tenants") {
          const target = data.tenants.find((row) => row.id === detail.id);
          if (target) setApplicationFilter(safeText(target.applicationId));
        } else if (detail.view === "principals") {
          const target = data.principals.find((row) => row.id === detail.id);
          if (target) setApplicationFilter(safeText(target.applicationId));
        }
        setPendingNavigation({ view: detail.view, id: detail.id });
      }
    };
    window.addEventListener("oic:navigate-identity", handler);
    return () => window.removeEventListener("oic:navigate-identity", handler);
  }, [view, data.tenants, data.principals]);
  const strings = locale === "ar" ? {
    search: "ابحث في السجلات", all: "الكل", active: "نشط", suspended: "موقوف", archived: "مؤرشف", select: "اختر سجلاً", empty: "لا توجد سجلات مطابقة", noSelection: "اختر سجلاً لعرض مساحة العمل", create: "إنشاء", createTitle: "إنشاء سجل", identity: "الهوية", review: "مراجعة", workspace: "مساحة العمل", index: "الفهرس", overview: "نظرة عامة", relationships: "العلاقات", access: "الوصول", references: "المراجع الخارجية", credentials: "بيانات الاعتماد", scopes: "النطاقات", grants: "منح المستأجرين", technicalId: "المعرّف التقني", created: "تاريخ الإنشاء", updated: "آخر تحديث", related: "السجلات المرتبطة", tenants: "المستأجرون", principals: "هويات الخدمات", application: "التطبيق", lifecycle: "دورة الحياة", inspect: "فحص التفاصيل", close: "إغلاق", cancel: "إلغاء", save: "تأكيد الإنشاء", next: "المتابعة للمراجعة", back: "العودة للتعديل", required: "أكمل الحقول المطلوبة", invalid: "تحقق من القيم المدخلة", applied: "تم الإرسال إلى الخدمة", unsupported: "غير مدعوم من المصدر الحالي", noReferences: "لا توجد مراجع خارجية مسجلة", addReference: "إضافة مرجع خارجي", createReferenceConsequence: "سيُسجّل هذا المعرّف الخارجي ضمن المستأجر المحدد.", sourceType: "نوع المصدر", externalId: "المعرّف الخارجي", revoke: "إلغاء المرجع", remap: "نقل المرجع", remapRule: "لا يتاح نقل المرجع إلا بعد إلغائه، وإلى مستأجر نشط ضمن التطبيق نفسه.", remapConsequence: "سيُنقل المرجع الخارجي الملغى إلى المستأجر النشط المحدد ضمن التطبيق نفسه.", revokeConsequence: "سيتم إلغاء ربط المرجع الخارجي.", scopeGrantConsequence: "سيضاف نطاق صلاحية إلى هوية الخدمة ضمن التطبيق المحدد.", tenantGrantConsequence: "سيُمنح لهوية الخدمة الوصول إلى المستأجر النشط المحدد ضمن التطبيق.", grant: "منح", revokeGrant: "إلغاء المنح", issue: "إصدار بيانات اعتماد", rotate: "تدوير", revokeCredential: "إلغاء بيانات الاعتماد", expires: "تاريخ الانتهاء", lastUsed: "آخر استخدام", noSecret: "لا تُعرض القيمة السرية إلا في نافذة الإصدار الفوري.", scopeNote: "النطاقات المتاحة محصورة في قائمة الخدمة المعروفة.", noTenant: "لا يوجد مستأجر نشط لهذا التطبيق.", activeCredential: "نشط", archivedNotice: "الأرشفة نهائية ولا يمكن إعادة التفعيل.", readback: "تحديث الحالة من لقطة الخدمة بعد الأمر.", counts: "إجمالي السجلات", notFound: "السجل المحدد لم يعد متاحاً.", createApplication: "تسجيل تطبيق", createTenant: "إنشاء مستأجر", createPrincipal: "إنشاء هوية خدمة", key: "المفتاح", displayName: "الاسم المعروض", appScope: "نطاق التطبيق", lifecycleTip: "تغيير دورة الحياة يتطلب أمراً مؤكداً.", keyRule: "2–64 حرفاً: يبدأ بحرف لاتيني كبير ثم أحرف كبيرة أو أرقام أو شرطة سفلية.", keyRuleFlexible: "من حرف إلى 64 حرفاً: أحرف لاتينية أو أرقام أو شرطة سفلية أو شرطة.", unavailableAccess: "لا تتوفر نتيجة موحدة لتقييم الصلاحيات في واجهة API الحالية."
  } : {
    search: "Search records", all: "All", active: "Active", suspended: "Suspended", archived: "Archived", select: "Select a record", empty: "No matching records", noSelection: "Select a record to open its workspace", create: "Create", createTitle: "Create record", identity: "Identity", review: "Review", workspace: "Workspace", index: "Index", overview: "Overview", relationships: "Relationships", access: "Access", references: "External references", credentials: "Credentials", scopes: "Scopes", grants: "Tenant grants", technicalId: "Technical identifier", created: "Created", updated: "Last updated", related: "Related records", tenants: "Tenants", principals: "Service principals", application: "Application", lifecycle: "Lifecycle", inspect: "Inspect details", close: "Close", cancel: "Cancel", save: "Confirm create", next: "Continue to review", back: "Back to edit", required: "Complete required fields", invalid: "Check the entered values", applied: "Command sent to the service", unsupported: "Not supported by the current source", noReferences: "No external references are registered", addReference: "Add external reference", createReferenceConsequence: "This registers the external identifier under the selected tenant.", sourceType: "Source type", externalId: "External identifier", revoke: "Revoke reference", remap: "Remap reference", remapRule: "Remapping requires a revoked reference and an active destination tenant in the same application.", remapConsequence: "The revoked external reference will move to the selected active tenant within this application.", revokeConsequence: "This revokes the external reference mapping.", scopeGrantConsequence: "This adds a permission scope to the service principal in the selected application.", tenantGrantConsequence: "This grants the service principal access to the selected active tenant in this application.", grant: "Grant", revokeGrant: "Revoke grant", issue: "Issue credential", rotate: "Rotate", revokeCredential: "Revoke credential", expires: "Expires", lastUsed: "Last used", noSecret: "Secret material appears only in the immediate issuance dialog.", scopeNote: "Available scopes are restricted to the service-known allowlist.", noTenant: "No active tenant is available for this application.", activeCredential: "Active", archivedNotice: "Archive is terminal and cannot be reversed.", readback: "State refresh follows the command.", counts: "Records", notFound: "The selected record is no longer available.", createApplication: "Register application", createTenant: "Create tenant", createPrincipal: "Create service principal", key: "Key", displayName: "Display name", appScope: "Application scope", lifecycleTip: "Lifecycle changes require a confirmed command.", keyRule: "2–64 characters: begin with an uppercase letter, then uppercase letters, digits or underscores.", keyRuleFlexible: "1–64 characters: letters, digits, underscores or hyphens.", unavailableAccess: "The current API does not provide a consolidated permission evaluation."
  };
  const shown = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase(locale);
    return rows.filter((row) => (lifecycle === "ALL" || safeText(row.status) === lifecycle) && (isApps || !applicationFilter || row.applicationId === applicationFilter) && (!needle || [row.key, row.displayName, row.status, row.id, row.applicationId].map(safeText).join(" ").toLocaleLowerCase(locale).includes(needle)));
  }, [rows, filter, lifecycle, applicationFilter, locale, isApps]);
  useEffect(() => {
    if (shown.some((row) => idOf(row) === selectedId)) return;
    setSelectedId(shown[0] ? idOf(shown[0]) : "");
  }, [shown, selectedId]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") !== view) return;
    const entityId = params.get("entity");
    const target = entityId ? rows.find((row) => idOf(row) === entityId) : undefined;
    if (!target) return;
    setLifecycle("ALL");
    setSelectedId(entityId ?? "");
    if (isTenants || isAccess) setApplicationFilter(safeText(target.applicationId));
  }, [view, rows, isTenants, isAccess, lifecycle, applicationFilter]);
  useEffect(() => {
    if (pendingNavigation?.view !== view) return;
    setSelectedId(pendingNavigation.id);
    setActiveTab("overview");
    setPendingNavigation(null);
  }, [pendingNavigation, view]);
  const selected = rows.find((row) => idOf(row) === selectedId) ?? null;
  const relatedTenants = selected ? (isApps ? data.tenants.filter((row) => row.applicationId === selected.id) : isTenants ? [] : data.tenants.filter((row) => row.applicationId === selected.applicationId)) : [];
  const relatedPrincipals = selected ? (isApps ? data.principals.filter((row) => row.applicationId === selected.id) : isTenants ? data.principals.filter((principal) => rowArray(principal.tenantGrants).some((grant) => grant.tenantId === selected.id)) : []) : [];
  const selectedAppId = isApps ? selected?.id : selected?.applicationId;
  const appOptions = data.applications.filter((app) => app.status === "ACTIVE").map((app) => ({ id: idOf(app), label: getString(app, "displayName"), secondary: getString(app, "key"), lifecycle: safeText(app.status), status: "healthy" as const }));
  const allAppOptions = [{ id: "", label: strings.all }, ...data.applications.map((app) => ({ id: idOf(app), label: getString(app, "displayName"), secondary: getString(app, "key"), lifecycle: safeText(app.status), status: app.status === "ACTIVE" ? "healthy" as const : "inactive" as const }))];
  const tenantOptions = data.tenants.filter((tenant) => tenant.applicationId === selectedAppId && tenant.status === "ACTIVE" && !rowArray(selected?.tenantGrants).some((grant) => grant.tenantId === tenant.id)).map((tenant) => ({ id: idOf(tenant), label: getString(tenant, "displayName"), secondary: getString(tenant, "key"), scope: appLabel(tenant.applicationId), lifecycle: safeText(tenant.status), status: "healthy" as const }));
  const usedScopes = rowArray(selected?.scopes).map((item) => safeText(item.scope));
  const scopeOptions = scopes.filter((scope) => !usedScopes.includes(scope)).map((scope) => ({ id: scope, label: scope, type: scope.split(":")[1] ?? "scope" }));
  const title = isApps ? t.applications : isTenants ? t.tenants : t.principals;
  const description = locale === "ar" ? (isApps ? "ملكية التطبيقات وعلاقات المستأجرين ووصول هويات الخدمات." : isTenants ? "نطاق التطبيق وهوية المستأجر وربط المراجع الخارجية." : "هويات الخدمات ونطاقات الصلاحية ومنح المستأجرين ودورة بيانات الاعتماد.") : (isApps ? "Application ownership, tenant topology and machine access." : isTenants ? "Application-scoped tenant identity and external mapping." : "Machine identities, permission scope, tenant grants and credential lifecycle.");
  const primaryCommand = isApps ? strings.createApplication : isTenants ? strings.createTenant : strings.createPrincipal;
  const lifecycleOptions = [{ id: "ALL", label: strings.all }, { id: "ACTIVE", label: strings.active }, { id: "SUSPENDED", label: strings.suspended }, { id: "ARCHIVED", label: strings.archived }];
  const showCommand = (title: string, action: string, values: Row, target: string, consequence: string) => {
    const principal = data.principals.find((row) => row.id === values.id);
    let current: string[] = [];
    let proposed: string[] = [];
    if (principal && action.startsWith("principal.scope.")) {
      current = rowArray(principal.scopes).map((row) => safeText(row.scope));
      proposed = action.endsWith("grant") ? [...new Set([...current, safeText(values.scope)])] : current.filter((scope) => scope !== values.scope);
    } else if (principal && action.startsWith("principal.tenant.")) {
      current = rowArray(principal.tenantGrants).map((row) => tenantLabel(row.tenantId));
      const affected = tenantLabel(values.tenantId);
      proposed = action.endsWith("grant") ? [...new Set([...current, affected])] : current.filter((tenant) => tenant !== affected);
    }
    const diff = current.length || proposed.length ? { current, proposed, added: proposed.filter((value) => !current.includes(value)), removed: current.filter((value) => !proposed.includes(value)) } : undefined;
    setCommand({ title, action, values, target, consequence, ...(diff ? { diff } : {}) });
  };
  const doCommand = async () => {
    if (!command) return "FAILED" as const;
    const result = await perform(command.action, command.values);
    setLocalNotice(result ? (result.__verificationStatus === "unknown" ? `${strings.applied} · ${locale === "ar" ? "التحقق غير مؤكد" : "verification unknown"}` : `${strings.applied} · ${strings.readback}`) : t.actionFailed);
    setCommand(null);
    return result ? (result.__verificationStatus === "unknown" ? "UNKNOWN_RESULT" as const : "SUCCEEDED" as const) : "FAILED" as const;
  };
  const continueCreate = () => {
    const name = createValues.displayName.trim();
    const key = createValues.key.trim();
    if (!name || (isApps && !/^[A-Z][A-Z0-9_]{1,63}$/.test(key)) || (isTenants && (!createValues.applicationId || (key && !/^[A-Za-z0-9_-]{1,64}$/.test(key)))) || (isAccess && (!createValues.applicationId || !/^[A-Za-z0-9_-]{1,64}$/.test(key)))) { setLocalNotice(strings.invalid); return; }
    setCreateStep(1);
  };
  const submit = async () => {
    const name = createValues.displayName.trim();
    const key = createValues.key.trim();
    if (!name || (isApps && !/^[A-Z][A-Z0-9_]{1,63}$/.test(key)) || (isTenants && (!createValues.applicationId || (key && !/^[A-Za-z0-9_-]{1,64}$/.test(key)))) || (isAccess && (!createValues.applicationId || !/^[A-Za-z0-9_-]{1,64}$/.test(key)))) { setLocalNotice(strings.invalid); setCreateStep(0); return; }
    setBusy(true);
    const action = isApps ? "application.create" : isTenants ? "tenant.create" : "principal.create";
    const payload: Row = isApps ? { key, displayName: name } : isTenants ? { applicationId: createValues.applicationId, displayName: name, ...(key ? { key } : {}) } : { applicationId: createValues.applicationId, key, displayName: name };
    const result = await perform(action, payload);
    setBusy(false);
    if (result) {
      const created = result.value && typeof result.value === "object" && !Array.isArray(result.value) ? result.value as Row : result;
      const createdId = safeText(created.id);
      setCreateOpen(false);
      setLocalNotice(result.__verificationStatus === "unknown" ? `${strings.applied} · ${locale === "ar" ? "التحقق غير مؤكد؛ حدّث اللقطة قبل إعادة المحاولة." : "verification unknown; refresh the snapshot before retrying."}` : `${primaryCommand} · ${strings.readback}`);
      if (createdId !== "—") window.dispatchEvent(new CustomEvent("oic:navigate-identity", { detail: { view, id: createdId } }));
      setCreateValues({ applicationId: "", key: "", displayName: "", sourceType: "", externalId: "" });
    }
  };
  const labelOf = (row: Row) => getString(row, "displayName") || getString(row, "key") || strings.select;
  const statusCommand = (next: string) => selected && showCommand(next === "ARCHIVED" ? strings.archived : next === "SUSPENDED" ? strings.suspended : strings.active, "identity.status", { kind, applicationId: selectedAppId, id: selected.id, status: next }, labelOf(selected), next === "ARCHIVED" ? strings.archivedNotice : `${strings.lifecycleTip} ${labelOf(selected)}`);
  const dataRow = (label: string, value: ReactNode) => <div className="x14-detail-row" key={label}><span>{label}</span><b>{value}</b></div>;
  const relationshipRows = selected ? [
    ...(isApps ? relatedTenants.map((row) => ({ id: idOf(row), type: strings.tenants, name: labelOf(row), status: liveStatus(row) })) : []),
    ...(isApps ? relatedPrincipals.map((row) => ({ id: idOf(row), type: strings.principals, name: labelOf(row), status: liveStatus(row) })) : []),
    ...(isTenants && selected.applicationId ? [{ id: safeText(selected.applicationId), type: strings.application, name: appLabel(selected.applicationId), status: "OWNER" }] : []),
    ...(isAccess && selected.applicationId ? [{ id: safeText(selected.applicationId), type: strings.application, name: appLabel(selected.applicationId), status: "OWNER" }] : []),
    ...(isAccess ? rowArray(selected.tenantGrants).map((grant) => ({ id: safeText(grant.tenantId), type: strings.grants, name: tenantLabel(grant.tenantId), status: "GRANTED" })) : [])
  ] : [];
  const selectEntity = (id: string) => {
    setSelectedId(id);
    setActiveTab("overview");
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    url.searchParams.set("entity", id);
    window.history.replaceState({}, "", url);
  };

  return <section className="x14-identity oi-interface-system" data-density="compact" dir={dir}>
    <header className="x14-page-head"><div><span className="oi-dev-stamp">OIC / {kind.toUpperCase()} ENGINEERING</span><h2>{title}</h2><p>{description}</p></div><div className="x14-head-count"><b>{rows.length.toLocaleString(locale)}</b><small>{strings.counts}</small><ActionButton variant="primary" disabled={!isApps && appOptions.length === 0} onPress={() => { setCreateValues({ applicationId: isTenants || isAccess ? safeText(selectedAppId || appOptions[0]?.id) : "", key: "", displayName: "", sourceType: "", externalId: "" }); setCreateStep(0); setCreateOpen(true); }}>{primaryCommand}</ActionButton></div></header>
    <div className="x14-summary-strip" aria-label={`${title} source counts`}>
      {(isApps ? [[strings.active, data.applications.filter((row) => row.status === "ACTIVE").length], [strings.tenants, data.tenants.length], [strings.principals, data.principals.length]] : isTenants ? [[strings.active, data.tenants.filter((row) => row.status === "ACTIVE").length], [strings.references, data.tenants.reduce((sum, row) => sum + rowArray(row.references).length, 0)], [strings.grants, data.principals.reduce((sum, row) => sum + rowArray(row.tenantGrants).length, 0)]] : [[strings.active, data.principals.filter((row) => row.status === "ACTIVE").length], [strings.scopes, data.principals.reduce((sum, row) => sum + rowArray(row.scopes).length, 0)], [strings.grants, data.principals.reduce((sum, row) => sum + rowArray(row.tenantGrants).length, 0)], [strings.credentials, data.principals.reduce((sum, row) => sum + rowArray(row.credentials).filter((credential) => credential.status === "ACTIVE").length, 0)]]).map(([label, value]) => <div className="x14-summary-item" key={String(label)}><b>{Number(value).toLocaleString(locale)}</b><small>{label}</small></div>)}
    </div>
    <CommandBar title={`${strings.workspace} / ${title}`}><TextInput label={strings.search} type="search" value={filter} onChange={setFilter} placeholder={strings.search} dir={dir} /><SegmentedControl label={strings.lifecycle} value={lifecycle} onChange={setLifecycle} options={lifecycleOptions} dir={dir} />{!isApps && <ApplicationPicker label={strings.appScope} value={applicationFilter} onChange={setApplicationFilter} options={allAppOptions} placeholder={strings.all} searchLabel={strings.search} emptyLabel={strings.empty} locale={locale} dir={dir} />}</CommandBar>
    {localNotice && <p className="x14-inline-feedback" role="status">{localNotice}</p>}
    <div className={`x14-workspace-grid is-${kind}`}>
      <aside className="x14-index" aria-label={`${strings.index} · ${title}`}><header><b>{strings.index}</b><span>{shown.length} / {rows.length}</span></header><div className="x14-index-list">{shown.map((row) => <button type="button" key={idOf(row)} className={`x14-index-item ${idOf(row) === selectedId ? "is-selected" : ""}`} onClick={() => selectEntity(idOf(row))} aria-current={idOf(row) === selectedId ? "true" : undefined}><span className={`x14-status-dot is-${liveStatus(row).toLowerCase()}`} aria-hidden="true"/><span className="x14-index-copy"><b>{labelOf(row)}</b><small><bdi dir="ltr">{getString(row, "key") || appLabel(row.applicationId)}</bdi></small></span><span className={`x14-lifecycle is-${liveStatus(row).toLowerCase()}`}>{liveStatus(row)}</span><small className="x14-index-count">{isApps ? `${row._count && typeof row._count === "object" ? textOr((row._count as Row).tenants, "0") : "0"} · ${row._count && typeof row._count === "object" ? textOr((row._count as Row).principals, "0") : "0"}` : isTenants ? `${rowArray(row.references).length} ${strings.references}` : `${rowArray(row.scopes).length} ${strings.scopes} · ${rowArray(row.tenantGrants).length} ${strings.grants}`}</small></button>)}{shown.length === 0 && <div className="x14-empty" role="status">{filter ? strings.empty : t.noData}</div>}</div></aside>
      <main className="x14-primary-workspace">{!selected ? <div className="x14-empty x14-no-selection">{strings.noSelection}</div> : <>
        <header className="x14-entity-head"><div><span className="section-index">{kind.toUpperCase()} / {getString(selected, "key")}</span><h3>{labelOf(selected)}</h3><p>{isApps ? `${relatedTenants.length} ${strings.tenants} · ${relatedPrincipals.length} ${strings.principals}` : isTenants ? appLabel(selected.applicationId) : appLabel(selected.applicationId)}</p></div><div className="x14-entity-actions">{badge(selected.status)}<ActionButton variant="quiet" onPress={() => setInspectorOpen(true)}>{strings.inspect}</ActionButton>{selected.status !== "ARCHIVED" && <ActionButton variant="warning" onPress={() => statusCommand(selected.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}>{selected.status === "ACTIVE" ? strings.suspended : strings.active}</ActionButton>}{selected.status !== "ARCHIVED" && <DangerAction onPress={() => statusCommand("ARCHIVED")}>{strings.archived}</DangerAction>}</div></header>
        <WorkspaceTabs label={`${title} · ${strings.workspace}`} selected={activeTab} onSelectionChange={setActiveTab} dir={dir} items={[
          { id: "overview", label: strings.overview, content: <div className="x14-tab-layout"><section className="x14-data-surface"><h4>{strings.identity}</h4>{dataRow(strings.displayName, labelOf(selected))}{dataRow(strings.key, <bdi dir="ltr">{getString(selected, "key") || "—"}</bdi>)}{dataRow(t.state, badge(selected.status))}{dataRow(strings.application, isApps ? <bdi dir="ltr">{getString(selected, "key")}</bdi> : appLabel(selected.applicationId))}{dataRow(strings.technicalId, bidi(selected.id))}{dataRow(strings.created, dateValue(selected.createdAt, locale))}{dataRow(strings.updated, dateValue(selected.updatedAt, locale))}</section><section className="x14-data-surface"><h4>{strings.related}</h4>{relationshipRows.length ? <RelationshipPanel label={strings.related} relationships={relationshipRows} /> : <p className="x14-muted">{strings.unsupported}</p>}</section>{isApps && <section className="x14-data-surface"><h4>{strings.access}</h4><p>{relatedPrincipals.length} {strings.principals} · {relatedPrincipals.reduce((sum, row) => sum + rowArray(row.scopes).length, 0)} {strings.scopes}</p><p>{strings.unsupported}: no consolidated authorization evaluation is exposed by this API.</p></section>}</div> },
          ...(isApps ? [{ id: "tenants", label: strings.tenants, content: <section className="x14-data-surface"><h4>{strings.tenants} · {relatedTenants.length}</h4>{relatedTenants.length ? relatedTenants.map((tenant) => <button type="button" className="x14-relation-row" key={idOf(tenant)} onClick={() => { window.dispatchEvent(new CustomEvent("oic:navigate-identity", { detail: { view: "tenants", id: idOf(tenant) } })); }}><span>{labelOf(tenant)}</span><small>{getString(tenant, "key")}</small>{badge(tenant.status)}</button>) : <p className="x14-muted">{t.noData}</p>}</section> }, { id: "principals", label: strings.principals, content: <section className="x14-data-surface"><h4>{strings.principals} · {relatedPrincipals.length}</h4>{relatedPrincipals.length ? relatedPrincipals.map((principal) => <button type="button" className="x14-relation-row" key={idOf(principal)} onClick={() => window.dispatchEvent(new CustomEvent("oic:navigate-identity", { detail: { view: "principals", id: idOf(principal) } }))}><span>{labelOf(principal)}</span><small><bdi dir="ltr">{getString(principal, "key")}</bdi></small>{badge(principal.status)}</button>) : <p className="x14-muted">{t.noData}</p>}</section> }] : []),
          ...(isTenants ? [{ id: "references", label: strings.references, content: <TenantReferences tenant={selected} data={data} locale={locale} dir={dir} strings={strings} badge={badge} showCommand={showCommand} /> }] : []),
          ...(isAccess ? [{ id: "access", label: strings.access, content: <AccessDetails principal={selected} data={data} locale={locale} dir={dir} strings={strings} appId={safeText(selected.applicationId)} tenantOptions={tenantOptions} scopeOptions={scopeOptions} setScopeChoice={setScopeChoice} scopeChoice={scopeChoice} setTenantChoice={setTenantChoice} tenantChoice={tenantChoice} credentialExpiry={credentialExpiry} setCredentialExpiry={setCredentialExpiry} issueCredential={issueCredential} showCommand={showCommand} badge={badge} /> }] : [])
        ]} />
      </>}</main>
    </div>
    <Inspector open={inspectorOpen && Boolean(selected)} onClose={() => setInspectorOpen(false)} title={selected ? labelOf(selected) : strings.inspect} description={kind.toUpperCase()} closeLabel={strings.close} dir={dir}>
      {selected && <div className="x14-inspector-content"><p>{strings.technicalId}</p><div className="x14-id-copy">{bidi(selected.id)}</div>{dataRow(strings.application, isApps ? getString(selected, "key") : appLabel(selected.applicationId))}{dataRow(t.state, badge(selected.status))}{dataRow(strings.created, dateValue(selected.createdAt, locale))}{dataRow(strings.updated, dateValue(selected.updatedAt, locale))}<h4>{strings.related}</h4><RelationshipPanel label={strings.related} relationships={relationshipRows} /></div>}
    </Inspector>
    <Inspector open={createOpen} onClose={() => setCreateOpen(false)} title={primaryCommand} description={`${strings.identity} · ${strings.review}`} closeLabel={strings.close} dir={dir}>
      <form className="x14-create-form" onSubmit={(event) => { event.preventDefault(); if (createStep === 0) continueCreate(); else void submit(); }}>
        {(isTenants || isAccess) && <ApplicationPicker label={strings.appScope} value={createValues.applicationId} onChange={(value) => setCreateValues((current) => ({ ...current, applicationId: value }))} options={appOptions} placeholder={strings.select} searchLabel={strings.search} emptyLabel={strings.empty} locale={locale} dir={dir} />}
        {isApps && <TextInput label={t.appKey} value={createValues.key} onChange={(key) => setCreateValues((current) => ({ ...current, key }))} required maxLength={64} dir="ltr" description={strings.keyRule} />}
        {isAccess && <TextInput label={t.principalKey} value={createValues.key} onChange={(key) => setCreateValues((current) => ({ ...current, key }))} required maxLength={64} dir="ltr" description={strings.keyRuleFlexible} />}
        <TextInput label={strings.displayName} value={createValues.displayName} onChange={(displayName) => setCreateValues((current) => ({ ...current, displayName }))} required maxLength={160} dir={dir} />
        {isTenants && <TextInput label={t.tenantKey} value={createValues.key} onChange={(key) => setCreateValues((current) => ({ ...current, key }))} maxLength={64} dir="ltr" description={strings.keyRuleFlexible} />}
        {createStep === 1 && <div className="x14-form-summary" aria-live="polite"><b>{strings.review}</b><span>{primaryCommand} · {createValues.displayName || strings.displayName}{createValues.key && ` · ${createValues.key}`}{createValues.applicationId && ` · ${appLabel(createValues.applicationId)}`}</span></div>}
        <div className="x14-form-actions">{createStep === 1 && <ActionButton onPress={() => setCreateStep(0)}>{strings.back}</ActionButton>}<ActionButton onPress={() => setCreateOpen(false)}>{strings.cancel}</ActionButton><ActionButton type="submit" variant="primary" loading={busy}>{busy ? t.loading : createStep === 0 ? strings.next : strings.save}</ActionButton></div>
      </form>
    </Inspector>
    <Inspector open={Boolean(command)} onClose={() => setCommand(null)} title={command?.title ?? strings.lifecycle} description={strings.lifecycleTip} closeLabel={strings.close} dir={dir}>
      {command && <>{command.diff && <section className="x14-command-diff" aria-label={strings.review}><div><b>{strings.overview}</b><ul>{command.diff.current.map((value) => <li key={`current:${value}`}>{value}</li>)}{!command.diff.current.length && <li>—</li>}</ul></div><div><b>{strings.review}</b><ul>{command.diff.proposed.map((value) => <li key={`proposed:${value}`}>{value}</li>)}{!command.diff.proposed.length && <li>—</li>}</ul></div>{command.diff.added.map((value) => <span className="is-added" key={`added:${value}`}>{strings.grant} · {value}</span>)}{command.diff.removed.map((value) => <span className="is-removed" key={`removed:${value}`}>{strings.revokeGrant} · {value}</span>)}</section>}<ArmThenExecute title={command.title} target={command.target} consequence={command.consequence} labels={{ arm: strings.review, execute: command.title, cancel: strings.cancel, status: { IDLE: "IDLE", READY: strings.review, ARMED: strings.review, EXECUTING: t.loading, SUCCEEDED: "APPLIED", FAILED: t.actionFailed, PARTIAL: "PARTIAL", CANCELLED: strings.cancel, BLOCKED: "BLOCKED", DENIED: "DENIED", CONFLICT: "CONFLICT", UNKNOWN_RESULT: "UNKNOWN" } }} onExecute={doCommand} /></>}
    </Inspector>
  </section>;
}

function TenantReferences({ tenant, data, locale, dir, strings, badge, showCommand }: { tenant: Row; data: Snapshot; locale: Locale; dir: "ltr" | "rtl"; strings: Record<string, string>; badge: Props["badge"]; showCommand: (title: string, action: string, values: Row, target: string, consequence: string) => void }) {
  const [sourceType, setSourceType] = useState(""); const [externalId, setExternalId] = useState("");
  const [remapTargets, setRemapTargets] = useState<Record<string, string>>({});
  const refs = rowArray(tenant.references);
  const appId = safeText(tenant.applicationId);
  const inactiveSourceMessage = locale === "ar" ? "يتطلب نقل المرجع أن يكون المستأجر الحالي نشطاً." : "Remapping requires this source tenant to remain active.";
  const sourceTenantIsActive = tenant.status === "ACTIVE";
  const targetOptions = data.tenants.filter((candidate) => candidate.applicationId === tenant.applicationId && candidate.id !== tenant.id && candidate.status === "ACTIVE").map((candidate) => ({ id: idOf(candidate), label: getString(candidate, "displayName"), secondary: getString(candidate, "key"), lifecycle: safeText(candidate.status), status: "healthy" as const }));
  return <div className="x14-reference-workspace"><section className="x14-data-surface"><h4>{strings.references} · {refs.length}</h4>{refs.length ? refs.map((ref) => { const revoked = Boolean(ref.revokedAt); return <article className="x14-reference-row" key={idOf(ref)}><div><b><bdi dir="ltr">{safeText(ref.sourceType)}</bdi></b><span><bdi dir="ltr">{safeText(ref.externalId)}</bdi></span><small>{dateValue(ref.createdAt, locale)}</small></div>{badge(revoked ? "REVOKED" : "ACTIVE")}{revoked ? <div className="x14-remap-control"><TenantPicker label={strings.remap} value={remapTargets[idOf(ref)] ?? ""} onChange={(value) => setRemapTargets((current) => ({ ...current, [idOf(ref)]: value }))} options={targetOptions} placeholder={strings.select} searchLabel={strings.search} emptyLabel={strings.empty} locale={locale} dir={dir} /><ActionButton variant="warning" disabled={!sourceTenantIsActive || !remapTargets[idOf(ref)] || !targetOptions.some((target) => target.id === remapTargets[idOf(ref)])} onPress={() => showCommand(strings.remap, "externalReference.remap", { applicationId: appId, id: ref.id, tenantId: remapTargets[idOf(ref)] }, `${safeText(ref.externalId)} → ${targetOptions.find((option) => option.id === remapTargets[idOf(ref)])?.label ?? ""}`, strings.remapConsequence)}>{strings.remap}</ActionButton>{!sourceTenantIsActive && <small className="x14-inline-note">{strings.remapRule}</small>}</div> : <DangerAction onPress={() => showCommand(strings.revoke, "externalReference.revoke", { applicationId: appId, id: ref.id }, safeText(ref.externalId), strings.revokeConsequence)}>{strings.revoke}</DangerAction>}</article>; }) : <p className="x14-muted">{strings.noReferences}</p>}</section><section className="x14-data-surface"><h4>{strings.addReference}</h4>{!sourceTenantIsActive && <p className="x14-remap-note">{inactiveSourceMessage}</p>}<form className="x14-create-form" onSubmit={(event) => { event.preventDefault(); if (!sourceTenantIsActive || !/^[A-Za-z0-9._:-]{1,64}$/.test(sourceType) || !externalId.trim()) return; showCommand(strings.addReference, "externalReference.create", { applicationId: appId, tenantId: tenant.id, sourceType, externalId: externalId.trim() }, externalId.trim(), strings.createReferenceConsequence); }}><TextInput label={strings.sourceType} value={sourceType} onChange={setSourceType} required maxLength={64} dir="ltr" disabled={!sourceTenantIsActive} /><TextInput label={strings.externalId} value={externalId} onChange={setExternalId} required maxLength={256} dir="ltr" disabled={!sourceTenantIsActive} /><ActionButton variant="primary" type="submit" disabled={!sourceTenantIsActive}>{strings.addReference}</ActionButton></form></section></div>;
}

function AccessDetails({ principal, data, locale, dir, strings, appId, tenantOptions, scopeOptions, scopeChoice, setScopeChoice, tenantChoice, setTenantChoice, credentialExpiry, setCredentialExpiry, issueCredential, showCommand, badge }: { principal: Row; data: Snapshot; locale: Locale; dir: "ltr" | "rtl"; strings: Record<string, string>; appId: string; tenantOptions: { id: string; label: string; secondary?: string; scope?: string; lifecycle?: string; status?: "healthy" }[]; scopeOptions: { id: string; label: string; type?: string }[]; scopeChoice: string; setScopeChoice: (value: string) => void; tenantChoice: string; setTenantChoice: (value: string) => void; credentialExpiry: string; setCredentialExpiry: (value: string) => void; issueCredential: Props["issueCredential"]; showCommand: (title: string, action: string, values: Row, target: string, consequence: string) => void; badge: Props["badge"] }) {
  const currentScopes = rowArray(principal.scopes); const grants = rowArray(principal.tenantGrants); const credentials = rowArray(principal.credentials);
  const consequences = {
    scopeRemove: locale === "ar" ? "سيُلغى نطاق الصلاحية لهوية الخدمة." : "This removes the principal permission scope.",
    tenantRemove: locale === "ar" ? "سيُلغى منح الوصول لهوية الخدمة إلى هذا المستأجر." : "This removes the principal tenant grant.",
    credentialRevoke: locale === "ar" ? "قد تتوقف الطلبات الحالية التي تستخدم بيانات الاعتماد هذه." : "Existing requests using this credential may stop working."
  };
  const expiryTime = credentialExpiry ? new Date(credentialExpiry).getTime() : null;
  const expiryValid = expiryTime === null || (Number.isFinite(expiryTime) && expiryTime > Date.now());
  const expiresAt = expiryValid && expiryTime !== null ? new Date(expiryTime).toISOString() : undefined;
  const action = (title: string, endpoint: string, values: Row, target: string, consequence: string) => showCommand(title, endpoint, values, target, consequence);
  return <div className="x14-access-grid">
    <section className="x14-data-surface x14-permission-surface"><header><div><h4>{strings.scopes}</h4><p>{currentScopes.length} {strings.scopes}</p></div><span className="x14-source-tag">API GRANTS</span></header><p className="x14-muted">{strings.scopeNote}</p>{currentScopes.map((scope) => <article className="x14-access-row" key={safeText(scope.scope)}><div><b><bdi dir="ltr">{safeText(scope.scope)}</bdi></b><small>{textOr(scope.status, "ACTIVE")}</small></div><DangerAction onPress={() => action(strings.revokeGrant, "principal.scope.revoke", { applicationId: appId, id: principal.id, scope: scope.scope }, safeText(scope.scope), consequences.scopeRemove)}>{strings.revokeGrant}</DangerAction></article>)}<div className="x14-picker-action"><SearchableSelect label={strings.grant} value={scopeChoice} onChange={setScopeChoice} options={scopeOptions} placeholder={strings.select} searchLabel={strings.search} emptyLabel={strings.empty} locale={locale} dir={dir} kind="scope" /><ActionButton variant="primary" disabled={!scopeChoice} onPress={() => action(strings.grant, "principal.scope.grant", { applicationId: appId, id: principal.id, scope: scopeChoice }, `${safeText(principal.displayName)} · ${scopeChoice}`, strings.scopeGrantConsequence)}>{strings.grant}</ActionButton></div></section>
    <section className="x14-data-surface"><header><div><h4>{strings.grants}</h4><p>{grants.length} {strings.grants}</p></div><span className="x14-source-tag">APPLICATION SCOPED</span></header>{grants.map((grant) => <article className="x14-access-row" key={safeText(grant.tenantId)}><div><b>{textOr(data.tenants.find((row) => row.id === grant.tenantId)?.displayName, strings.application)}</b><small><bdi dir="ltr">{safeText(data.tenants.find((row) => row.id === grant.tenantId)?.key)}</bdi></small></div><DangerAction onPress={() => action(strings.revokeGrant, "principal.tenant.revoke", { applicationId: appId, id: principal.id, tenantId: grant.tenantId }, safeText(data.tenants.find((row) => row.id === grant.tenantId)?.displayName), consequences.tenantRemove)}>{strings.revokeGrant}</DangerAction></article>)}<div className="x14-picker-action"><SearchableSelect label={strings.grant} value={tenantChoice} onChange={setTenantChoice} options={tenantOptions} placeholder={strings.select} searchLabel={strings.search} emptyLabel={tenantOptions.length ? strings.empty : strings.noTenant} locale={locale} dir={dir} kind="tenant" /><ActionButton variant="primary" disabled={!tenantChoice} onPress={() => action(strings.grant, "principal.tenant.grant", { applicationId: appId, id: principal.id, tenantId: tenantChoice }, `${safeText(principal.displayName)} · ${tenantOptions.find((tenant) => tenant.id === tenantChoice)?.label}`, strings.tenantGrantConsequence)}>{strings.grant}</ActionButton></div></section>
    <section className="x14-data-surface x14-credential-surface"><header><div><h4>{strings.credentials}</h4><p>{credentials.length} · {strings.noSecret}</p></div><div className="x14-credential-issue"><TextInput label={strings.expires} value={credentialExpiry} onChange={setCredentialExpiry} type="datetime-local" dir="ltr" />{!expiryValid && <span className="oi-validation-message is-error" role="alert">{locale === "ar" ? "يجب أن يكون الانتهاء في المستقبل." : "Expiry must be a future date and time."}</span>}<ActionButton variant="warning" disabled={principal.status !== "ACTIVE" || !expiryValid} onPress={() => { void issueCredential(appId, principal.id, undefined, expiresAt); }}>{strings.issue}</ActionButton></div></header>{credentials.map((credential) => <article className="x14-credential-row" key={idOf(credential)}><div><bdi dir="ltr" className="x14-technical">{safeText(credential.id).slice(0, 8)}…{safeText(credential.id).slice(-4)}</bdi><span>{badge(credential.status)}</span><small>{strings.expires}: {dateValue(credential.expiresAt, locale)}</small><small>{strings.lastUsed}: {dateValue(credential.lastUsedAt, locale)}</small></div><div className="x14-credential-actions">{credential.status === "ACTIVE" && <><ActionButton variant="warning" disabled={!expiryValid || principal.status !== "ACTIVE"} onPress={() => { void issueCredential(appId, principal.id, credential.id, expiresAt); }}>{strings.rotate}</ActionButton><DangerAction onPress={() => action(strings.revokeCredential, "credential.revoke", { applicationId: appId, id: credential.id }, `${safeText(credential.id).slice(0, 8)}…${safeText(credential.id).slice(-4)} · ${safeText(principal.displayName)}`, consequences.credentialRevoke)}>{strings.revokeCredential}</DangerAction></>}</div></article>)}</section>
  </div>;
}
