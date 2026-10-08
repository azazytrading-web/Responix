"use client";

import { useMemo, useState } from "react";
import {
  ArmThenExecute,
  ActionButton,
  DependencyPicker,
  DiscreteStepSelector,
  Inspector,
  LifecyclePicker,
  PrimaryAction,
  RelationshipPanel,
  ScopePicker,
  SecondaryAction,
  Toggle,
  WizardFrame,
  WorkspaceTabs
} from "../../components/interface";
import { EmptyState, ErrorState, LoadingState } from "../../components/oic-primitives";
import { TextInput } from "../../components/interface/controls/text";
import { NumericInstrument, NodeTrack, StateBeacon } from "../../components/instruments";
import type { Locale, View } from "../../i18n";
import type { Row, Snapshot } from "../../types";

type Filters = { q: string; tenantId: string; lifecycle: string; kind?: string };
type Props = {
  view: View;
  locale: Locale;
  data: Snapshot | null;
  memories: Row[];
  knowledge: Row[];
  executions: Row[];
  selectedMemory: Row | null;
  selectedKnowledge: Row | null;
  profiles: Row[];
  load: (resource: "memory" | "knowledge", filters?: Filters) => Promise<Row[] | null>;
  loadState: "loading" | "available" | "failed";
  inspectMemory: (id: string) => Promise<Row | null>;
  inspectKnowledge: (id: string) => Promise<Row | null>;
  perform: (action: string, values?: Row) => Promise<Row | null>;
  navigate: (view: View, entityId?: string) => void;
};

const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter((item): item is Row => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const str = (value: unknown, fallback = "—") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
const isoDate = (value: unknown, locale: Locale) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
};
const shortId = (value: unknown) => typeof value === "string" ? value : "—";
const localDateTimeInput = (value: unknown) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const localDateToIso = (value: unknown) => typeof value === "string" && value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="x17-field"><span>{label}</span><b>{children}</b></div>;
}

function SummaryRack({ items, locale, state }: { items: { label: string; value: number; note: string }[]; locale: Locale; state: "LIVE" | "UNAVAILABLE" }) {
  return <div className="x17-summary-rack" aria-label={locale === "ar" ? "ملخص السجلات في العينة" : "Returned record sample summary"}>
    {items.map((item) => <NumericInstrument key={item.label} label={item.label} value={item.value} state={state} stateLabel={locale === "ar" ? "في العينة" : "IN SAMPLE"} source={item.note} size="SM" className="x17-summary-instrument" />)}
  </div>;
}

function DomainStrip({ memory, selected, locale, data }: { memory: boolean; selected: Row | null; locale: Locale; data: Snapshot | null }) {
  const ar = locale === "ar";
  const app = str(data?.runtimeContext?.application.displayName, ar ? "التطبيق المصرح به" : "Authorized application");
  const tenant = selected?.tenantId ? (data?.runtimeContext?.tenants ?? []).find((item) => item.id === selected.tenantId)?.displayName : null;
  const scope = selected ? (selected.tenantId ? tenant ?? (ar ? "مستأجر مصرح به" : "Authorized tenant") : app) : (ar ? "نطاق التطبيق والمستأجر" : "Application / tenant scope");
  const lifecycle = selected ? str(selected.lifecycle, ar ? "غير متاح" : "Unavailable") : (ar ? "تصفية حسب الحالة" : "Lifecycle filtered");
  const source = selected ? str(memory ? selected.sourceType : selected.sourceKey, ar ? "غير متاح" : "Unavailable") : (ar ? "اختر سجلاً لعرض المصدر" : "Select a record for source details");
  const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(0, 10) : null;
  const expiry = memory ? (selected ? (timestamp(selected.validUntil) ?? (ar ? "لا يوجد انتهاء مسجل" : "No expiry recorded")) : (ar ? "انتهاء السجل فقط" : "Record expiry only")) : (selected ? (timestamp(selected.updatedAt) ?? (ar ? "غير متاح" : "Unavailable")) : (ar ? "آخر تحديث مسجل" : "Recorded update"));
  const items = memory ? [
    { label: ar ? "الحالة" : "Stored state", value: selected ? (ar ? "محفوظ" : "STORED") : (ar ? "عينة" : "SAMPLE"), state: "LIVE" as const },
    { label: ar ? "النطاق" : "Scope", value: str(scope), state: "IDLE" as const },
    { label: ar ? "دورة الحياة" : "Lifecycle", value: lifecycle, state: selected?.lifecycle === "ACTIVE" ? "LIVE" as const : "IDLE" as const },
    { label: ar ? "الأهلية" : "Retrieval eligibility", value: selected ? (ar ? "غير محددة لكل سجل" : "Not determined per record") : (ar ? "تخضع للسياسة" : "Policy controlled"), state: "UNAVAILABLE" as const },
    { label: ar ? "الانتهاء" : "Expiry", value: expiry, state: "IDLE" as const }
  ] : [
    { label: ar ? "المصدر" : "Source identity", value: source || (ar ? "غير متاح" : "Unavailable"), state: selected ? "LIVE" as const : "IDLE" as const },
    { label: ar ? "النطاق" : "Scope", value: str(scope), state: "IDLE" as const },
    { label: ar ? "دورة الحياة" : "Lifecycle", value: lifecycle, state: selected?.lifecycle === "ACTIVE" ? "LIVE" as const : "IDLE" as const },
    { label: ar ? "الاسترجاع" : "Retrieval", value: selected ? (ar ? "مرجع التنفيذ فقط" : "Execution references only") : (ar ? "حسب السجل والتنفيذ" : "Record / execution dependent"), state: "UNAVAILABLE" as const },
    { label: ar ? "آخر تحديث" : "Updated", value: expiry, state: "IDLE" as const }
  ];
  return <div className={`x17-domain-strip ${memory ? "is-memory" : "is-knowledge"}`} aria-label={memory ? "Memory state strip" : "Knowledge source strip"}>
    {items.map((item) => <div className="x17-strip-cell" key={item.label}><span>{item.label}</span><div><StateBeacon state={item.state} size="XS" /><b dir="auto">{item.value}</b></div></div>)}
  </div>;
}

function EmptyWorkspace({ memory, locale, tenantId, hasRecords }: { memory: boolean; locale: Locale; tenantId: string; hasRecords: boolean }) {
  const ar = locale === "ar";
  const title = memory ? (hasRecords ? (ar ? "لم يتم اختيار ذاكرة" : "NO MEMORY SELECTED") : (ar ? "لا توجد ذاكرة في النطاق الحالي" : "NO MEMORY RECORDS IN CURRENT AUTHORIZED VIEW")) : (hasRecords ? (ar ? "لم يتم اختيار سجل معرفة" : "NO KNOWLEDGE RECORD SELECTED") : (ar ? "لا توجد سجلات معرفة في العرض الحالي" : "NO KNOWLEDGE RECORDS IN CURRENT VIEW"));
  const rows = memory ? [
    [ar ? "النطاق الحالي" : "CURRENT SCOPE", tenantId ? (ar ? "مستأجر مصرح به" : "Authorized tenant") : (ar ? "التطبيق المصرح به" : "Authorized application")],
    [ar ? "البحث" : "SEARCH", ar ? "بيانات المصدر فقط" : "Source metadata only"],
    [ar ? "بحث المحتوى" : "CONTENT SEARCH", ar ? "غير مدعوم" : "Unsupported"],
    [ar ? "الأرشيف" : "ARCHIVE", ar ? "مخفي افتراضياً" : "Hidden by default"],
    [ar ? "اختيار وقت التشغيل" : "RUNTIME SELECTION", ar ? "تتحكم به سياسة النطاق والملف والتنفيذ" : "Governed by scope, profile and execution policy"]
  ] : [
    [ar ? "البحث" : "SEARCH", ar ? "بيانات المصدر فقط" : "Source metadata only"],
    [ar ? "استيراد المستندات" : "DOCUMENT INGESTION", ar ? "غير متاح في واجهة API الحالية" : "Unavailable in the current API"],
    [ar ? "المقاطع" : "CHUNKS", ar ? "غير متاح" : "Unavailable"],
    [ar ? "الاسترجاع" : "RETRIEVAL", ar ? "يعتمد على السجل والتنفيذ" : "Record and execution dependent"],
    [ar ? "الأرشيف" : "ARCHIVE", ar ? "مخفي افتراضياً" : "Hidden by default"]
  ];
  return <section className={`x17-no-selection ${memory ? "is-memory" : "is-knowledge"}`}>
    <span className="x17-eyebrow">{memory ? "MEMORY / PERSISTED STATE" : "KNOWLEDGE / SOURCE RECORDS"}</span>
    <EmptyState title={title} description={memory ? (ar ? "اختر سجلاً لفحص المصدر والنطاق ودورة الحياة وأهلية الاسترجاع." : "Select a record to inspect its provenance, scope, lifecycle and retrieval eligibility.") : (ar ? "اختر سجلاً لفحص المصدر والنطاق ومراجع التنفيذ المتاحة." : "Select a record to inspect source identity, scope and available execution references.")} />
    <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </section>;
}

function ScopeFilters({
  locale, tenants, filters, setFilters, onApply, memory, includeArchived, setIncludeArchived, loading
}: {
  locale: Locale; tenants: Row[]; filters: Filters; setFilters: (next: Filters) => void; onApply: () => void;
  memory: boolean; includeArchived: boolean; setIncludeArchived: (value: boolean) => void; loading: boolean;
}) {
  const ar = locale === "ar";
  const tenantOptions = [{ id: "", label: ar ? "كل النطاقات المصرح بها" : "All authorized scopes", type: ar ? "تطبيق" : "Application" }, ...tenants.map((tenant) => ({ id: str(tenant.id), label: str(tenant.displayName), secondary: str(tenant.key, ""), type: ar ? "مستأجر" : "Tenant", scope: ar ? "هذا التطبيق" : "This application" }))];
  const lifecycleOptions = [
    { id: "", label: ar ? "كل الحالات" : "All lifecycle states" },
    ...((memory ? ["ACTIVE", "STALE", "SUPERSEDED", "CONFLICTED", "UNVERIFIED", "ARCHIVED"] : ["ACTIVE", "DISABLED", "ARCHIVED"]).map((id) => ({ id, label: id })))
  ];
  const kindOptions = [{ id: "", label: ar ? "كل الأنواع" : "All memory kinds" }, ...["EPISODIC", "SEMANTIC", "PROCEDURAL", "APPLICATION"].map((id) => ({ id, label: id }))];
  return <div className="x17-filter-bar">
    <TextInput label={ar ? "بحث في بيانات المصدر" : "Search source metadata"} value={filters.q} onChange={(q) => setFilters({ ...filters, q })} maxLength={120} type="search" dir={ar ? "rtl" : "ltr"} description={ar ? (memory ? "يبحث في العنوان ونوع/مرجع المصدر فقط؛ لا يبحث في المحتوى." : "يبحث في العنوان ومفتاح/مرجع المصدر فقط؛ لا يبحث في المحتوى.") : memory ? "Searches title and source type/reference only; content is not searched." : "Searches title and source key/reference only; content is not searched."} />
    <ScopePicker label={ar ? "نطاق المستأجر" : "Tenant scope"} value={filters.tenantId} onChange={(tenantId) => setFilters({ ...filters, tenantId })} options={tenantOptions} placeholder={ar ? "اختر نطاقاً" : "Choose a scope"} searchLabel={ar ? "ابحث في النطاقات" : "Search scopes"} emptyLabel={ar ? "لا توجد نتائج" : "No scopes found"} dir={ar ? "rtl" : "ltr"} locale={locale} />
    <LifecyclePicker label={ar ? "دورة الحياة" : "Lifecycle"} value={filters.lifecycle} onChange={(lifecycle) => setFilters({ ...filters, lifecycle })} options={lifecycleOptions} placeholder={ar ? "اختر الحالة" : "Choose lifecycle"} searchLabel={ar ? "ابحث عن حالة" : "Search lifecycle"} emptyLabel={ar ? "لا توجد نتائج" : "No lifecycle states"} dir={ar ? "rtl" : "ltr"} locale={locale} />
    {memory && <DiscreteStepSelector label={ar ? "نوع الذاكرة" : "Memory kind"} value={filters.kind ?? ""} onChange={(kind) => setFilters({ ...filters, kind })} options={kindOptions} placeholder={ar ? "اختر النوع" : "Choose kind"} dir={ar ? "rtl" : "ltr"} locale={locale} />}
    <div className="x17-filter-actions"><Toggle label={ar ? "إظهار المؤرشف" : "Show archived"} value={includeArchived} onChange={setIncludeArchived} dir={ar ? "rtl" : "ltr"} /><ActionButton onPress={onApply} loading={loading}>{ar ? "تطبيق المرشحات" : "Apply filters"}</ActionButton></div>
  </div>;
}

function CreateWizard({
  kind, locale, tenants, currentSources, onCancel, onCreate
}: {
  kind: "memory" | "knowledge"; locale: Locale; tenants: Row[]; currentSources: Row[];
  onCancel: () => void; onCreate: (values: Row) => Promise<void>;
}) {
  const ar = locale === "ar";
  const memory = kind === "memory";
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Row>(memory ? {
    kind: "SEMANTIC", sensitivity: "INTERNAL", title: "", content: "", sourceType: "operator-reviewed", sourceRef: "", tenantId: "", validUntil: ""
  } : { sourceKey: "", sourceRef: "", title: "", content: "", tenantId: "", authority: 50, sourcePriority: 50, dependencySource: "" });
  const [saving, setSaving] = useState(false);
  const update = (key: string, value: unknown) => setDraft((prior) => ({ ...prior, [key]: value }));
  const validSource = typeof draft.sourceKey === "string" && /^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(draft.sourceKey) && typeof draft.sourceRef === "string" && draft.sourceRef.trim().length > 0;
  const validDetails = typeof draft.title === "string" && draft.title.trim().length > 0 && typeof draft.content === "string" && draft.content.trim().length > 0;
  const sources = currentSources.map((item) => ({ id: `${str(item.sourceKey)}|${str(item.sourceRef)}`, label: str(item.title), secondary: `${str(item.sourceKey)} · ${str(item.sourceRef)}`, type: str(item.lifecycle), scope: item.tenantId ? "Tenant" : "Application", lifecycle: str(item.lifecycle) }));
  const tenantOptions = [{ id: "", label: ar ? "نطاق التطبيق" : "Application scope", type: ar ? "التطبيق الحالي" : "Current application" }, ...tenants.map((item) => ({ id: str(item.id), label: str(item.displayName), secondary: str(item.key, ""), type: ar ? "مستأجر" : "Tenant" }))];
  const stepOne = <div className="x17-form-grid">
    {memory ? <>
      <DiscreteStepSelector label={ar ? "نوع الذاكرة" : "Memory kind"} value={str(draft.kind)} onChange={(value) => update("kind", value)} options={["EPISODIC", "SEMANTIC", "PROCEDURAL", "APPLICATION"].map((id) => ({ id, label: id }))} placeholder="" dir={ar ? "rtl" : "ltr"} locale={locale} />
      <DiscreteStepSelector label={ar ? "الحساسية" : "Sensitivity"} value={str(draft.sensitivity)} onChange={(value) => update("sensitivity", value)} options={["PUBLIC", "INTERNAL", "SENSITIVE", "RESTRICTED"].map((id) => ({ id, label: id }))} placeholder="" dir={ar ? "rtl" : "ltr"} locale={locale} />
      <TextInput label={ar ? "نوع المصدر" : "Source type"} value={str(draft.sourceType)} onChange={(value) => update("sourceType", value)} required maxLength={128} dir="ltr" />
      <TextInput label={ar ? "مرجع المصدر (اختياري)" : "Source reference (optional)"} value={str(draft.sourceRef, "")} onChange={(value) => update("sourceRef", value)} maxLength={256} dir="ltr" />
    </> : <>
      <TextInput label={ar ? "مفتاح المصدر" : "Source key"} value={str(draft.sourceKey, "")} onChange={(value) => update("sourceKey", value)} required maxLength={128} dir="ltr" description={ar ? "مفتاح وصفي، وليس نوع موصل." : "A descriptive key, not a connector type."} />
      <TextInput label={ar ? "مرجع المصدر" : "Source reference"} value={str(draft.sourceRef, "")} onChange={(value) => update("sourceRef", value)} required maxLength={512} dir="ltr" />
      <DependencyPicker label={ar ? "مرجع اعتماد (اختياري)" : "Dependency reference (optional)"} value={str(draft.dependencySource, "")} onChange={(value) => update("dependencySource", value)} options={sources} placeholder={ar ? "اختر مصدراً مرجعياً" : "Choose a referenced source"} searchLabel={ar ? "ابحث عن المصادر" : "Search source records"} emptyLabel={ar ? "لا توجد مصادر في العينة الحالية" : "No sources in the current sample"} dir={ar ? "rtl" : "ltr"} locale={locale} />
      <p className="x17-note">{ar ? "المراجع نصية ولا تُفرض بعلاقة قاعدة بيانات؛ قد لا يظهر المرجع إلا في العينة المحدودة الحالية." : "References are source-key/reference pairs without a foreign-key constraint; a reference may not appear in this bounded sample."}</p>
    </>}
  </div>;
  const stepTwo = <div className="x17-form-grid">
    <ScopePicker label={ar ? "نطاق المستأجر" : "Tenant scope"} value={str(draft.tenantId, "")} onChange={(tenantId) => update("tenantId", tenantId)} options={tenantOptions} placeholder={ar ? "نطاق التطبيق" : "Application scope"} searchLabel={ar ? "ابحث عن مستأجر" : "Search tenants"} emptyLabel={ar ? "لا توجد مستأجرون" : "No authorized tenants"} dir={ar ? "rtl" : "ltr"} locale={locale} />
    <TextInput label={ar ? "العنوان" : "Title"} value={str(draft.title, "")} onChange={(value) => update("title", value)} required maxLength={240} dir={ar ? "rtl" : "ltr"} />
    {!memory && <div className="x17-form-grid x17-form-grid-nested">
      <label className="x17-native-field"><span>{ar ? "بيانات سلطة المصدر (0–100)" : "Source authority metadata (0–100)"}<input type="number" min={0} max={100} value={str(draft.authority)} onChange={(event) => update("authority", Number(event.currentTarget.value))} /></span></label>
      <label className="x17-native-field"><span>{ar ? "أولوية المصدر (0–100)" : "Source priority metadata (0–100)"}<input type="number" min={0} max={100} value={str(draft.sourcePriority)} onChange={(event) => update("sourcePriority", Number(event.currentTarget.value))} /></span></label>
      <p className="x17-note">{ar ? "قيم بيانات مصدر محفوظة؛ ليست درجات جودة أو نتائج تقييم." : "Stored source metadata only; these are not quality scores or evaluation results."}</p>
    </div>}
    <label className="x17-native-field x17-content-field"><span>{memory ? (ar ? "محتوى الذاكرة" : "Memory content") : (ar ? "محتوى سجل المعرفة" : "Knowledge record content")}<textarea value={str(draft.content, "")} onChange={(event) => update("content", event.currentTarget.value)} required maxLength={memory ? 20_000 : 200_000} dir={ar ? "rtl" : "auto"} /></span></label>
    {memory && <label className="x17-native-field"><span>{ar ? "انتهاء الصلاحية (اختياري؛ UTC)" : "Expiry (local time; saved as UTC)"}<input type="datetime-local" value={str(draft.validUntil, "")} onChange={(event) => update("validUntil", event.currentTarget.value)} /></span></label>}
  </div>;
  const stepThree = <div className="x17-review-grid">
    <Field label={ar ? "نوع السجل" : "Record type"}>{memory ? `${str(draft.kind)} / ${str(draft.sensitivity)}` : `${str(draft.sourceKey)} / ${str(draft.sourceRef)}`}</Field>
    <Field label={ar ? "النطاق" : "Scope"}>{draft.tenantId ? tenantOptions.find((item) => item.id === draft.tenantId)?.label ?? "Tenant" : "Application"}</Field>
    <Field label={ar ? "العنوان" : "Title"}>{str(draft.title, "")}</Field>
    <p className="x17-note">{memory ? (ar ? "المحتوى الحساس والمقيد سيبقى خاضعاً لتنقيح واجهة التفاصيل من API. لا يمكن تعديل محتوى الذاكرة بعد الإنشاء عبر هذا العقد." : "Sensitive and restricted detail content remains subject to API redaction. Memory content cannot be edited after creation through this contract.") : (ar ? "هذا ينشئ سجل دليل واحداً. لا يستورد مستندات أو ينشئ مقاطع أو مهمة مزامنة." : "This creates one curated evidence record. It does not import documents, create chunks or start a sync job.")}</p>
  </div>;
  const labels = memory ? (ar ? ["النوع والمصدر", "النطاق والمحتوى", "المراجعة"] : ["Kind and source", "Scope and content", "Review"]) : (ar ? ["المصدر والعلاقات", "النطاق والمحتوى", "المراجعة"] : ["Source and references", "Scope and content", "Review"]);
  const steps = [stepOne, stepTwo, stepThree].map((content, index) => ({ id: String(index), label: labels[index], content, validate: () => index === 0 ? (memory ? str(draft.sourceType).trim().length > 0 : validSource) : index === 1 ? validDetails && (memory || (Number(draft.authority) >= 0 && Number(draft.authority) <= 100 && Number(draft.sourcePriority) >= 0 && Number(draft.sourcePriority) <= 100)) : true }));
  const finish = async () => {
    if (!validDetails || saving) return;
    setSaving(true);
    const values: Row = memory ? {
      kind: draft.kind, sensitivity: draft.sensitivity, title: str(draft.title, "").trim(), content: draft.content,
      sourceType: draft.sourceType, ...(draft.sourceRef ? { sourceRef: draft.sourceRef } : {}), tenantId: draft.tenantId,
      validUntil: localDateToIso(draft.validUntil)
    } : {
      sourceKey: draft.sourceKey, sourceRef: draft.sourceRef, title: str(draft.title, "").trim(), content: draft.content,
      tenantId: draft.tenantId, authority: draft.authority, sourcePriority: draft.sourcePriority,
      ...(typeof draft.dependencySource === "string" && draft.dependencySource ? { dependsOn: [{ sourceKey: draft.dependencySource.split("|")[0], sourceRef: draft.dependencySource.split("|").slice(1).join("|") }] } : {})
    };
    try { await onCreate(values); } finally { setSaving(false); }
  };
  return <div className="x17-create-flow"><header><b>{memory ? (ar ? "إنشاء سجل ذاكرة مُراجع" : "Create reviewed memory") : (ar ? "إضافة سجل دليل معرفي" : "Add a curated knowledge record")}</b><p>{memory ? (ar ? "تُحفظ الذاكرة ضمن نطاق التطبيق/المستأجر المصرح به." : "Memory is stored within the authorized application or tenant scope.") : (ar ? "الإضافة مباشرة إلى سجل الأدلة؛ لا توجد عملية استيراد." : "Direct creation of an evidence record; no import pipeline is available.")}</p></header>
    <WizardFrame title={memory ? "Memory record" : "Knowledge record"} steps={steps} active={step} onActiveChange={setStep} onFinish={() => void finish()} finishLabel={saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "إنشاء السجل" : "Create record")} backLabel={ar ? "السابق" : "Back"} nextLabel={ar ? "التالي" : "Continue"} cancelLabel={ar ? "إلغاء" : "Cancel"} requiredLabel={ar ? "أكمل الحقول المطلوبة قبل المتابعة." : "Complete the required fields before continuing."} onCancel={onCancel} dir={ar ? "rtl" : "ltr"} />
  </div>;
}

function MemoryContext({ item, executions, locale, profiles, navigate }: { item: Row | null; executions: Row[]; locale: Locale; profiles: Row[]; navigate: Props["navigate"] }) {
  const ar = locale === "ar";
  if (!item) return <p className="x17-empty">{ar ? "اختر ذاكرة لفحص أهلية الاسترجاع وأدلة التنفيذ المتاحة." : "Select a memory to inspect retrieval eligibility and available execution evidence."}</p>;
  const matching = executions.flatMap((execution) => {
    const summary = record(execution.summary);
    const utility = Array.isArray(summary.memoryUtility) ? rows(summary.memoryUtility) : rows(record(summary.memoryUtility).records);
    const selections = rows(summary.memorySelection);
    const byId = utility.filter((entry) => entry.memoryId === item.id || entry.id === item.id);
    const selected = selections.some((entry) => entry.id === item.id);
    return byId.length || selected ? [{ execution, utility: byId[0], selected }] : [];
  });
  const track = <NodeTrack size="SM" label={ar ? "مسار الذاكرة من التخزين إلى سياق التنفيذ" : "Memory path from storage to execution context"} nodes={[
    { label: ar ? "سجل الذاكرة" : "Memory record", value: ar ? "محفوظ" : "STORED", state: "LIVE" },
    { label: ar ? "سياسة الملف" : "Profile policy", value: ar ? "تتحكم بالأهلية" : "GOVERNS ELIGIBILITY", state: "IDLE" },
    { label: ar ? "سياق وقت التشغيل" : "Runtime context", value: ar ? "غير مثبت" : "NOT OBSERVED", state: "UNAVAILABLE" }
  ]} />;
  if (!matching.length) return <div className="x17-context-workspace">{track}<div className="x17-empty"><b>{ar ? "لا يوجد مرجع ذاكرة في العينة" : "NO MEMORY REFERENCE IN SAMPLE"}</b><p>{ar ? "لا يثبت ذلك عدم الاستخدام تاريخياً. لا تتوفر نقطة اختبار استرجاع لكل سجل." : "This does not establish historical non-use. No per-record retrieval test endpoint is available."}</p><small>{ar ? "عينة تنفيذ محدودة: حتى 50 سجلاً." : "Bounded execution sample: up to 50 records."}</small></div></div>;
  return <div className="x17-context-workspace">{track}<div className="x17-evidence-list">{matching.map(({ execution, utility, selected }) => {
    const profile = profiles.flatMap((entry) => rows(entry.revisions).map((revision) => ({ profile: entry, revision }))).find(({ revision }) => revision.id === execution.profileRevisionId);
    const signals = Array.isArray(utility?.signals) ? utility.signals.map(String) : [];
    return <article className="x17-evidence-card" key={str(execution.traceId)}><header><b>{signals.includes("USED_IN_CONTEXT") ? (ar ? "مُدرج في سياق المزوّد" : "Used in provider context") : selected ? (ar ? "اختير ولم يُثبت إدراجه في السياق" : "Selected; context inclusion not established") : (ar ? "إشارة استخدام مسجلة" : "Recorded usage signal")}</b><code dir="ltr"><bdi>{str(execution.traceId)}</bdi></code></header><p>{signals.length ? signals.join(" · ") : (ar ? "اختير ضمن عينة التنفيذ؛ لا توجد تفاصيل منفعة إضافية." : "Selected in this execution sample; no additional utility signal was recorded.")}</p><Field label={ar ? "وقت التنفيذ" : "Execution time"}>{isoDate(execution.createdAt, locale)}</Field>
      <Field label={ar ? "ملف التنفيذ" : "Execution profile"}>{profile ? `${str(profile.profile.displayName)} · r${str(profile.revision.revision)}` : str(execution.profileRevisionId)}</Field>
      {profile && <ActionButton onPress={() => navigate("profiles")}>{ar ? "فتح ملفات الذكاء" : "Open Intelligence Profiles"}</ActionButton>}
    </article>;
  })}</div></div>;
}

function KnowledgeContext({ item, executions, locale, profiles, navigate }: { item: Row | null; executions: Row[]; locale: Locale; profiles: Row[]; navigate: Props["navigate"] }) {
  const ar = locale === "ar";
  if (!item) return <p className="x17-empty">{ar ? "اختر سجلاً لعرض مراجع الأدلة التي أعادتها عينة التنفيذ." : "Select a record to inspect evidence references returned in the execution sample."}</p>;
  const matching = executions.flatMap((execution) => {
    const graph = record(record(execution.summary).evidenceGraph);
    const nodes = rows(graph.nodes).filter((node) => node.id === item.id || node.contentRef === item.id);
    return nodes.map((node) => ({ execution, node }));
  });
  const track = <NodeTrack size="SM" label={ar ? "مسار سجل المعرفة ومراجع التنفيذ" : "Knowledge record and execution reference path"} nodes={[
    { label: ar ? "مرجع المصدر" : "Source reference", value: str(item.sourceKey), state: "LIVE" },
    { label: ar ? "سجل المعرفة" : "Knowledge record", value: str(item.lifecycle), state: item.lifecycle === "ACTIVE" ? "LIVE" : "IDLE" },
    { label: ar ? "دليل التنفيذ" : "Execution evidence", value: matching.length ? (ar ? "مرجع موجود" : "REFERENCE FOUND") : (ar ? "غير موجود بالعينة" : "NOT IN SAMPLE"), state: matching.length ? "LIVE" : "UNAVAILABLE" }
  ]} />;
  if (!matching.length) return <div className="x17-context-workspace">{track}<div className="x17-empty"><b>{ar ? "لا يوجد مرجع دليل في العينة" : "NO EVIDENCE REFERENCE IN SAMPLE"}</b><p>{ar ? "قد لا يظهر السجل النشط في هذا التنفيذ؛ لا توجد نقطة اختبار لكل سجل." : "An active record may not be returned in this sample; no per-record retrieval test endpoint is available."}</p><small>{ar ? "المرجع لا يثبت دخول المحتوى في سياق المزوّد." : "A reference does not prove content entered provider context."}</small></div></div>;
  return <div className="x17-context-workspace">{track}<div className="x17-evidence-list">{matching.map(({ execution, node }) => {
    const profile = profiles.flatMap((entry) => rows(entry.revisions).map((revision) => ({ profile: entry, revision }))).find(({ revision }) => revision.id === execution.profileRevisionId);
    return <article className="x17-evidence-card" key={`${str(execution.traceId)}-${str(node.id)}`}><header><b>{ar ? "مرجع دليل أعاده مخطط التنفيذ" : "Evidence reference returned by execution graph"}</b><code dir="ltr"><bdi>{str(execution.traceId)}</bdi></code></header><div className="x17-detail-grid"><Field label={ar ? "المصدر" : "Source"}>{str(node.source)}</Field><Field label={ar ? "المرجع" : "Provenance reference"}><code dir="ltr"><bdi>{str(node.provenance)}</bdi></code></Field><Field label={ar ? "الثقة المصدرية" : "Source trust classification"}>{str(node.trust)}</Field><Field label={ar ? "النطاق" : "Evidence scope"}><code dir="ltr"><bdi>{str(node.scope)}</bdi></code></Field><Field label={ar ? "وقت التنفيذ" : "Execution time"}>{isoDate(execution.createdAt, locale)}</Field><Field label={ar ? "ملف التنفيذ" : "Execution profile"}>{profile ? `${str(profile.profile.displayName)} · r${str(profile.revision.revision)}` : str(execution.profileRevisionId)}</Field></div>{profile && <ActionButton onPress={() => navigate("profiles")}>{ar ? "فتح ملفات الذكاء" : "Open Intelligence Profiles"}</ActionButton>}</article>;
  })}</div></div>;
}

function Details({ kind, item, locale, close, onEdit, onArchive }: { kind: "memory" | "knowledge"; item: Row; locale: Locale; close: () => void; onEdit: (values: Row) => Promise<void>; onArchive: () => Promise<"SUCCEEDED" | "FAILED" | "UNKNOWN_RESULT"> }) {
  const ar = locale === "ar";
  const memory = kind === "memory";
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Row>({ sensitivity: item.sensitivity, validUntil: localDateTimeInput(item.validUntil), title: item.title, authority: item.authority, sourcePriority: item.sourcePriority, lifecycle: item.lifecycle });
  const update = (key: string, value: unknown) => setDraft((prior) => ({ ...prior, [key]: value }));
  const lifecycle = str(item.lifecycle, "");
  const isArchived = lifecycle === "ARCHIVED";
  const canEdit = memory ? !isArchived : !isArchived;
  const archivedLabel = ar ? "مؤرشف — لا يمكن الاستعادة" : "ARCHIVED — restore is unavailable";
  const save = async () => {
    if (memory) await onEdit({ id: item.id, lifecycle: draft.lifecycle, sensitivity: draft.sensitivity, validUntil: localDateToIso(draft.validUntil) });
    else await onEdit({ id: item.id, title: draft.title, lifecycle: draft.lifecycle, authority: Number(draft.authority), sourcePriority: Number(draft.sourcePriority) });
    setEditOpen(false);
  };
  return <>
    <Inspector open onClose={close} title={str(item.title)} description={memory ? (ar ? "تفاصيل ذاكرة ضمن النطاق المصرح به" : "Scoped memory record detail") : (ar ? "تفاصيل سجل دليل ضمن النطاق" : "Scoped knowledge evidence record")} closeLabel={ar ? "إغلاق التفاصيل" : "Close details"} dir={ar ? "rtl" : "ltr"}>
      <div className="x17-inspector-content"><div className="x17-detail-grid">
        <Field label={ar ? "دورة الحياة" : "Lifecycle"}>{isArchived ? archivedLabel : lifecycle}</Field>
        <Field label={ar ? "النطاق" : "Scope"}>{item.tenantId ? (ar ? "المستأجر المصرح به" : "Authorized tenant") : (ar ? "التطبيق الحالي" : "Current application")}</Field>
        <Field label={ar ? "أُنشئ" : "Created"}>{isoDate(item.createdAt, locale)}</Field>
        <Field label={ar ? "حُدّث" : "Updated"}>{isoDate(item.updatedAt, locale)}</Field>
        {memory ? <>
          <Field label={ar ? "النوع" : "Kind"}>{str(item.kind)}</Field><Field label={ar ? "الحساسية" : "Sensitivity"}>{str(item.sensitivity)}</Field>
          <Field label={ar ? "نوع المصدر" : "Source type"}>{str(item.sourceType)}</Field><Field label={ar ? "مرجع المصدر" : "Source reference"}><code dir="ltr"><bdi>{str(item.sourceRef)}</bdi></code></Field>
          <Field label={ar ? "آخر تأكيد" : "Last confirmed"}>{isoDate(item.lastConfirmedAt, locale)}</Field><Field label={ar ? "ينتهي" : "Expires"}>{isoDate(item.validUntil, locale)}</Field>
          <Field label={ar ? "بيانات الثقة المحفوظة" : "Stored confidence metadata"}>{str(item.confidence)}</Field><Field label={ar ? "بيانات البروز المحفوظة" : "Stored salience metadata"}>{str(item.salience)}</Field>
          <p className="x17-note x17-wide">{ar ? "قيم الثقة والبروز بيانات محفوظة تدخل في سياسة الترتيب؛ لا تمثل جودة معايرة أو درجة أهمية مستقلة." : "Confidence and salience are stored metadata used by ranking policy; they are not calibrated quality or standalone importance scores."}</p>
        </> : <>
          <Field label={ar ? "مفتاح المصدر" : "Source key"}><code dir="ltr"><bdi>{str(item.sourceKey)}</bdi></code></Field><Field label={ar ? "مرجع المصدر" : "Source reference"}><code dir="ltr"><bdi>{str(item.sourceRef)}</bdi></code></Field>
          <Field label={ar ? "نُشر" : "Published"}>{isoDate(item.publishedAt, locale)}</Field><Field label={ar ? "سلطة المصدر (بيانات)" : "Authority metadata"}>{str(item.authority)}</Field><Field label={ar ? "أولوية المصدر (بيانات)" : "Source priority metadata"}>{str(item.sourcePriority)}</Field>
          <Field label={ar ? "نموذج التضمين" : "Embedding model"}>{str(item.embeddingModel)}</Field><Field label={ar ? "أبعاد التضمين" : "Embedding dimensions"}>{str(item.embeddingDimensions)}</Field>
          <p className="x17-note x17-wide">{ar ? "قيم سلطة المصدر والأولوية بيانات واردة من المصدر؛ ليست درجات جودة. المتجه نفسه غير معروض." : "Authority and priority are source metadata, not quality scores. The vector itself is not displayed."}</p>
        </>}
        <Field label={ar ? "المعرّف التقني" : "Technical ID"}><code className="x17-id" dir="ltr"><bdi>{shortId(item.id)}</bdi></code></Field>
        {Boolean(item.originatingExecutionId) && <Field label={ar ? "التنفيذ المنشئ" : "Originating execution"}><code dir="ltr"><bdi>{str(item.originatingExecutionId)}</bdi></code></Field>}
      </div>
      {typeof item.content === "string" ? <section className="x17-content-view"><h4>{memory ? (ar ? "\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u0630\u0627\u0643\u0631\u0629" : "Memory content") : (ar ? "\u0645\u062d\u062a\u0648\u0649 \u0633\u062c\u0644 \u0627\u0644\u062f\u0644\u064a\u0644" : "Evidence record content")}</h4><pre dir="auto">{item.content}</pre></section> : <div className="x17-note">{ar ? "Content unavailable in this response; it may be redacted by sensitivity or authorization." : "Content is unavailable in this response; it may be redacted due to sensitivity or authorization."}</div>}
      {editOpen && canEdit && <section className="x17-edit-form"><LifecyclePicker label={ar ? "\u062f\u0648\u0631\u0629 \u0627\u0644\u062d\u064a\u0627\u0629" : "Lifecycle"} value={str(draft.lifecycle)} onChange={(value) => update("lifecycle", value)} options={(memory ? ["ACTIVE", "STALE", "SUPERSEDED", "CONFLICTED", "UNVERIFIED"] : ["ACTIVE", "DISABLED"]).map((id) => ({ id, label: id }))} placeholder="" searchLabel={ar ? "\u0627\u0628\u062d\u062b \u0639\u0646 \u0627\u0644\u062d\u0627\u0644\u0629" : "Search lifecycle"} emptyLabel={ar ? "\u0644\u0627 \u062a\u0648\u062c\u062f \u062d\u0627\u0644\u0627\u062a" : "No lifecycle states"} dir={ar ? "rtl" : "ltr"} locale={locale} /><h4>{ar ? "مسودة تعديل مدعومة" : "Supported change draft"}</h4>{memory ? <>
        <DiscreteStepSelector label={ar ? "الحساسية" : "Sensitivity"} value={str(draft.sensitivity)} onChange={(value) => update("sensitivity", value)} options={["PUBLIC", "INTERNAL", "SENSITIVE", "RESTRICTED"].map((id) => ({ id, label: id }))} placeholder="" dir={ar ? "rtl" : "ltr"} locale={locale} />
        <label className="x17-native-field"><span>{ar ? "انتهاء الصلاحية (UTC؛ اتركه فارغاً لإزالة الانتهاء)" : "Expiry (local time, saved as UTC; clear to remove)"}<input type="datetime-local" value={str(draft.validUntil, "")} onChange={(event) => update("validUntil", event.currentTarget.value)} /></span></label>
        <p className="x17-note">{ar ? "العنوان والمحتوى والنوع والنطاق والمصدر بيانات ثابتة عبر هذا العقد." : "Title, content, kind, scope and provenance are immutable through this contract."}</p>
      </> : <>
        <TextInput label={ar ? "العنوان" : "Title"} value={str(draft.title, "")} onChange={(value) => update("title", value)} required maxLength={240} dir={ar ? "rtl" : "ltr"} />
        <label className="x17-native-field"><span>{ar ? "سلطة المصدر (بيانات 0–100)" : "Authority metadata (0–100)"}<input type="number" min={0} max={100} value={str(draft.authority)} onChange={(event) => update("authority", Number(event.currentTarget.value))} /></span></label>
        <label className="x17-native-field"><span>{ar ? "أولوية المصدر (بيانات 0–100)" : "Source priority metadata (0–100)"}<input type="number" min={0} max={100} value={str(draft.sourcePriority)} onChange={(event) => update("sourcePriority", Number(event.currentTarget.value))} /></span></label>
        <p className="x17-note">{ar ? "تحديث العنوان يعيد بناء تضمين المحتوى الحالي؛ لا يوجد محرر محتوى لهذا العقد." : "Updating the title re-embeds the existing content; this contract has no content editor."}</p>
      </>}
      <div className="x17-actions"><SecondaryAction onPress={() => setEditOpen(false)}>{ar ? "إلغاء" : "Cancel"}</SecondaryAction><PrimaryAction onPress={() => void save()}>{ar ? "حفظ التغيير" : "Save change"}</PrimaryAction></div></section>}
      <div className="x17-actions x17-inspector-actions">{canEdit && <ActionButton onPress={() => setEditOpen((open) => !open)}>{editOpen ? (ar ? "إخفاء التعديل" : "Close edit") : (ar ? "تغيير الحقول المدعومة" : "Edit supported fields")}</ActionButton>}{!isArchived && !memory && lifecycle !== "DISABLED" && <ActionButton onPress={() => void onEdit({ id: item.id, lifecycle: "DISABLED" })}>{ar ? "تعطيل" : "Disable"}</ActionButton>}</div>
      {!isArchived && <ArmThenExecute title={ar ? "إجراء نهائي" : "Terminal lifecycle action"} target={`${str(item.title)} · ARCHIVED`} consequence={ar ? "الأرشفة نهائية؛ لا يوفر عقد API الحالي الاستعادة أو الحذف." : "Archive is terminal; this API contract provides no restore or delete action."} labels={{ arm: ar ? "مراجعة الأرشفة" : "Review archive", execute: ar ? "أرشفة السجل" : "Archive record", cancel: ar ? "إلغاء" : "Cancel", status: { IDLE: "IDLE", READY: ar ? "بانتظار المراجعة" : "READY", ARMED: ar ? "مراجعة" : "REVIEWED", EXECUTING: ar ? "جارٍ" : "APPLYING", SUCCEEDED: ar ? "تم التطبيق" : "APPLIED", FAILED: ar ? "فشل" : "FAILED", PARTIAL: "PARTIAL", CANCELLED: ar ? "ملغى" : "CANCELLED", BLOCKED: "BLOCKED", DENIED: "DENIED", CONFLICT: "CONFLICT", UNKNOWN_RESULT: ar ? "حالة غير مؤكدة" : "UNKNOWN" } }} onExecute={onArchive} />}
      {isArchived && <p className="x17-note">{ar ? "الأرشفة نهائية في العقد الحالي؛ الاستعادة والحذف غير متاحين." : "Archive is terminal in the current contract; restore and delete are unavailable."}</p>}
      </div>
    </Inspector>
  </>;
}

export function MemoryKnowledgeStudio(props: Props) {
  const { view, locale, data, memories, knowledge, executions, selectedMemory, selectedKnowledge, profiles, load, loadState, inspectMemory, inspectKnowledge, perform, navigate } = props;
  const memory = view === "memory";
  const ar = locale === "ar";
  const resource = memory ? "memory" : "knowledge";
  const allItems = memory ? memories : knowledge;
  const selected = memory ? selectedMemory : selectedKnowledge;
  const [filters, setFilters] = useState<Filters>({ q: "", tenantId: "", lifecycle: "", kind: "" });
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [inspectorItem, setInspectorItem] = useState<Row | null>(null);
  const [tab, setTab] = useState("record");
  const [readback, setReadback] = useState("");
  const tenants = data?.runtimeContext?.tenants ?? [];
  const visible = useMemo(() => allItems.filter((item) => includeArchived || filters.lifecycle === "ARCHIVED" || item.lifecycle !== "ARCHIVED"), [allItems, includeArchived, filters.lifecycle]);
  const onApply = async () => {
    setLoading(true); setLoadError("");
    try {
      const result = await load(resource, filters);
      if (result === null) setLoadError(ar ? "تعذر تحميل السجلات؛ البيانات المعروضة قديمة." : "Records could not be loaded; the displayed sample may be stale.");
    } finally { setLoading(false); }
  };
  const inspect = async (item: Row) => {
    const detail = memory ? await inspectMemory(str(item.id)) : await inspectKnowledge(str(item.id));
    setInspectorItem(detail);
  };
  const edit = async (values: Row) => {
    setReadback("");
    const result = await perform(memory ? "intelligence.memory.update" : "intelligence.knowledge.update", values);
    if (!result) { setReadback(ar ? "فشل التطبيق؛ احتُفظ بالتحديد الحالي." : "Apply failed; current selection is preserved."); return; }
    const detail = memory ? await inspectMemory(str(values.id)) : await inspectKnowledge(str(values.id));
    if (detail) setInspectorItem(detail);
    const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : value == null ? null : value;
    const verified = Boolean(detail) && Object.entries(values).filter(([key]) => key !== "id").every(([key, expected]) => key === "validUntil" ? timestamp(expected) === timestamp(detail?.[key]) : detail?.[key] === expected);
    if (verified) setReadback(ar ? "\u0637\u064f\u0628\u0642 \u0627\u0644\u062a\u063a\u064a\u064a\u0631 \u0648\u062a\u062d\u0642\u0642 \u0645\u0646 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644." : "Change applied and verified by detail readback.");
    else setReadback(ar ? "\u0637\u064f\u0628\u0642 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u061b \u062a\u0639\u0630\u0631\u062a \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u062a\u062d\u0642\u0642." : "Change applied; readback verification is unknown.");
  };
  const archive = async (): Promise<"SUCCEEDED" | "FAILED" | "UNKNOWN_RESULT"> => {
    if (!inspectorItem) return "FAILED";
    const values = { id: inspectorItem.id, lifecycle: "ARCHIVED" };
    const result = await perform(memory ? "intelligence.memory.lifecycle" : "intelligence.knowledge.update", values);
    if (!result) { setReadback(ar ? "فشلت الأرشفة." : "Archive failed."); return "FAILED"; }
    const detail = memory ? await inspectMemory(str(inspectorItem.id)) : await inspectKnowledge(str(inspectorItem.id));
    if (detail?.lifecycle === "ARCHIVED") { setInspectorItem(detail); setReadback(ar ? "تمت الأرشفة والتحقق من القراءة." : "Archived and verified by detail readback."); return "SUCCEEDED"; }
    setReadback(ar ? "تم الإرسال؛ حالة القراءة غير مؤكدة." : "Command applied; readback state is unknown.");
    return "UNKNOWN_RESULT";
  };
  const create = async (values: Row) => {
    setReadback("");
    const result = await perform(memory ? "intelligence.memory.create" : "intelligence.knowledge.create", values);
    if (!result) { setReadback(ar ? "تعذر إنشاء السجل؛ لم يُمسح مسودة المحتوى." : "Record creation failed; content draft remains in this flow."); return; }
    const id = str(result.id, "");
    if (!id || id === "—") { setReadback(ar ? "أُرسل الإنشاء؛ تعذر تحديد المعرّف للتحقق." : "Create was submitted; no identifier was returned for readback."); return; }
    const detail = memory ? await inspectMemory(id) : await inspectKnowledge(id);
    setInspectorItem(detail);
    setCreateOpen(false);
    setReadback(detail ? (ar ? "أُنشئ السجل وتم التحقق بقراءة التفاصيل." : "Record created and verified by detail readback.") : (ar ? "أُنشئ السجل؛ حالة قراءة التحقق غير معروفة." : "Record created; detail readback is unknown."));
  };
  const openInspector = inspectorItem ? <Details kind={resource} item={inspectorItem} locale={locale} close={() => setInspectorItem(null)} onEdit={edit} onArchive={archive} /> : null;
  const archivedCount = allItems.filter((item) => item.lifecycle === "ARCHIVED").length;
  const languages = ar ? {
    header: memory ? "استوديو هندسة الذاكرة" : "استوديو هندسة المعرفة",
    description: memory ? "ذاكرة محفوظة ضمن نطاق التطبيق والمستأجر؛ اختيارها الفعلي يخضع لسياسة الملف والتنفيذ." : "سجلات أدلة منسقة مع مصدر ونطاق؛ السجل النشط لا يضمن إعادته في كل استرجاع.",
    sample: memory ? "سجلات ذاكرة في العينة المعادة" : "سجلات معرفة في العينة المعادة",
    add: memory ? "إضافة ذاكرة" : "إضافة سجل معرفة",
    index: memory ? "فهرس الذاكرة" : "فهرس سجلات المعرفة",
    noSelection: memory ? "اختر ذاكرة لفحص النطاق والمصدر ودورة الحياة." : "اختر سجلاً لفحص المصدر والعلاقات وحالة دورة الحياة.",
    record: memory ? "حالة الذاكرة" : "سجل المصدر", context: memory ? "أهلية السياق" : "أدلة الاسترجاع", relationships: memory ? "النطاق والعلاقات" : "المصدر والاعتماد", empty: "لا توجد سجلات في العينة المصرح بها.", source: memory ? "المصدر" : "مفتاح المصدر",
    stored: memory ? "مخزّن" : "نشط في النطاق", archive: "المؤرشف", error: "تعذر تحميل السجلات.",
    contentTitle: memory ? "محتوى الذاكرة" : "محتوى سجل الدليل",
  } : {
    header: memory ? "Memory Engineering Studio" : "Knowledge Engineering Studio",
    description: memory ? "Persisted memory in application and tenant scope; actual selection remains governed by profile and execution policy." : "Curated evidence records with source and scope; an active record is not guaranteed to be returned by every retrieval.",
    sample: memory ? "Memory records in returned sample" : "Knowledge records in returned sample",
    add: memory ? "Add memory" : "Add knowledge record",
    index: memory ? "Memory index" : "Knowledge record index",
    noSelection: memory ? "Select a memory to inspect its scope, source and lifecycle." : "Select a record to inspect its source, references and lifecycle.",
    record: memory ? "Memory state" : "Source record", context: memory ? "Context eligibility" : "Retrieval evidence", relationships: memory ? "Scope & relationships" : "Source lineage", empty: "No records in the authorized sample.", source: memory ? "Source type" : "Source key",
    stored: memory ? "Stored" : "Active in scope", archive: "Archived", error: "Records could not be loaded.",
    contentTitle: memory ? "Memory content" : "Evidence record content",
  };
  const tabs = [
    { id: "record", label: languages.record, content: selected ? <div className={`x17-selected-record ${memory ? "is-memory" : "is-knowledge"}`}>
      <header><div><span className="x17-eyebrow">{memory ? "MEMORY / STORED RECORD" : "KNOWLEDGE / CURATED EVIDENCE"}</span><h3>{str(selected.title)}</h3><p>{str(selected.lifecycle)} · {selected.tenantId ? "TENANT SCOPE" : "APPLICATION SCOPE"}</p></div><ActionButton onPress={() => void inspect(selected)}>{ar ? "التفاصيل التقنية" : "Technical details"}</ActionButton></header>
      <div className={`x17-record-zones ${memory ? "is-memory" : "is-knowledge"}`}>
        {memory ? <>
          <section><span className="x17-zone-label">{ar ? "هوية الذاكرة" : "MEMORY IDENTITY"}</span><div className="x17-detail-grid"><Field label={ar ? "النوع" : "Kind"}>{str(selected.kind)}</Field><Field label={ar ? "دورة الحياة" : "Lifecycle"}>{str(selected.lifecycle)}</Field></div></section>
          <section><span className="x17-zone-label">{ar ? "النطاق والاحتفاظ" : "SCOPE & RETENTION"}</span><div className="x17-detail-grid"><Field label={ar ? "النطاق" : "Scope"}>{selected.tenantId ? (ar ? "مستأجر مصرح به" : "Authorized tenant") : (ar ? "التطبيق" : "Application")}</Field><Field label={ar ? "الحساسية" : "Sensitivity"}>{str(selected.sensitivity)}</Field><Field label={ar ? "أُنشئ" : "Created"}>{isoDate(selected.createdAt, locale)}</Field><Field label={ar ? "حُدّث" : "Updated"}>{isoDate(selected.updatedAt, locale)}</Field><Field label={ar ? "صالح حتى" : "Valid until"}>{selected.validUntil ? isoDate(selected.validUntil, locale) : (ar ? "لا يوجد انتهاء مسجل" : "No expiry recorded")}</Field></div></section>
          <section><span className="x17-zone-label">{ar ? "المصدر والتتبع" : "PROVENANCE"}</span><div className="x17-detail-grid"><Field label={ar ? "نوع المصدر" : "Source type"}>{str(selected.sourceType)}</Field><Field label={ar ? "مرجع المصدر" : "Source reference"}><code dir="ltr"><bdi>{str(selected.sourceRef)}</bdi></code></Field>{Boolean(selected.originatingExecutionId) && <Field label={ar ? "التنفيذ المنشئ" : "Originating execution"}><code dir="ltr"><bdi>{str(selected.originatingExecutionId)}</bdi></code></Field>}</div></section>
        </> : <>
          <section><span className="x17-zone-label">{ar ? "هوية المصدر" : "SOURCE IDENTITY"}</span><div className="x17-detail-grid"><Field label={ar ? "العنوان" : "Title"}>{str(selected.title)}</Field><Field label={ar ? "مفتاح المصدر" : "Source key"}><code dir="ltr"><bdi>{str(selected.sourceKey)}</bdi></code></Field><Field label={ar ? "مرجع المصدر" : "Source reference"}><code dir="ltr"><bdi>{str(selected.sourceRef)}</bdi></code></Field></div></section>
          <section><span className="x17-zone-label">{ar ? "النطاق والتوفر" : "SCOPE & AVAILABILITY"}</span><div className="x17-detail-grid"><Field label={ar ? "النطاق" : "Scope"}>{selected.tenantId ? (ar ? "مستأجر مصرح به" : "Authorized tenant") : (ar ? "التطبيق" : "Application")}</Field><Field label={ar ? "دورة الحياة" : "Lifecycle"}>{str(selected.lifecycle)}</Field><Field label={ar ? "نُشر" : "Published"}>{isoDate(selected.publishedAt, locale)}</Field><Field label={ar ? "حُدّث" : "Updated"}>{isoDate(selected.updatedAt, locale)}</Field></div></section>
        </>}
      </div>
      <section className="x17-content-view"><h4>{languages.contentTitle}</h4>{typeof selected.content === "string" ? <><small>{ar ? "\u0645\u0639\u0627\u064a\u0646\u0629 \u0645\u062d\u062f\u0648\u062f\u0629\u061b \u0627\u0641\u062a\u062d \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u062a\u0642\u0646\u064a\u0629 \u0644\u0644\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u0643\u0627\u0645\u0644" : "Bounded preview; open technical details for full content"}</small><pre dir="auto">{selected.content.slice(0, 900)}{selected.content.length > 900 ? "\u2026" : ""}</pre></> : <p>{ar ? "\u0627\u0641\u062a\u062d \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644\u061b \u0642\u062f \u064a\u062d\u062c\u0628 API \u0627\u0644\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u062d\u0633\u0627\u0633 \u0623\u0648 \u0627\u0644\u0645\u0642\u064a\u062f" : "Open detail; the API may redact sensitive or restricted content."}</p>}</section>
      {memory ? <p className="x17-note">{ar ? "مخزّن لا يعني أنه دخل سياقاً. يلزم توافق النطاق والملف ودورة الحياة والحساسية والانتهاء." : "Stored does not mean included in context. Scope, profile policy, lifecycle, sensitivity and expiry all constrain retrieval."}</p> : <p className="x17-note">{ar ? "المصدر النشط قد لا يظهر كمرجع في التنفيذ. لا توجد نقطة اختبار استرجاع لكل سجل." : "An active source may not be returned in an execution. No per-record retrieval test endpoint is available."}</p>}
    </div> : <p className="x17-empty">{languages.noSelection}</p> },
    { id: "context", label: languages.context, content: memory ? <MemoryContext item={selected} executions={executions} locale={locale} profiles={profiles} navigate={navigate} /> : <KnowledgeContext item={selected} executions={executions} locale={locale} profiles={profiles} navigate={navigate} /> },
    { id: "relationships", label: languages.relationships, content: selected ? <div className="x17-relationship-workspace">
      <RelationshipPanel label={ar ? "العلاقات المحفوظة" : "Persisted relationships"} relationships={[
        ...(data?.runtimeContext?.application ? [{ id: str(data.runtimeContext.application.id, "application"), type: ar ? "التطبيق" : "Application", name: str(data.runtimeContext.application.displayName, ar ? "التطبيق المصرح به" : "Authorized application") }] : []),
        ...(selected.tenantId ? [{ id: str(selected.tenantId), type: ar ? "المستأجر" : "Tenant", name: str(tenants.find((tenant) => tenant.id === selected.tenantId)?.displayName, ar ? "مستأجر مصرح به" : "Authorized tenant") }] : []),
        ...(selected.originatingExecutionId ? [{ id: str(selected.originatingExecutionId), type: ar ? "التنفيذ المنشئ" : "Originating execution", name: str(selected.originatingExecutionId), status: ar ? "مرجع" : "Reference" }] : []),
        ...(!memory ? rows(selected.dependsOn).map((dep, index) => ({ id: `${str(dep.sourceKey)}-${index}`, type: ar ? "مرجع اعتماد نصي" : "Text dependency reference", name: `${str(dep.sourceKey)} / ${str(dep.sourceRef)}`, status: ar ? "ليس مفتاحاً أجنبياً" : "Not a foreign key" })) : [])
      ]} />
      <div className="x17-relationship-actions">{Boolean(data?.runtimeContext?.application?.id) && <ActionButton onPress={() => navigate("applications", str(data?.runtimeContext?.application.id))}>{ar ? "فتح التطبيق" : "Open application"}</ActionButton>}{Boolean(selected.tenantId) && <ActionButton onPress={() => navigate("tenants", str(selected.tenantId))}>{ar ? "فتح المستأجر" : "Open tenant"}</ActionButton>}</div>
      <section className="x17-policy-note"><span className="x17-zone-label">{ar ? "سياسة الاسترجاع" : "RETRIEVAL POLICY"}</span><p>{ar ? "لا يملك السجل علاقة مباشرة بملف. سياسة الاسترجاع في إصدار الملف تؤثر عند كل تنفيذ." : "The record is not owned by a profile. A profile revision’s retrieval policy is evaluated per execution."}</p><ActionButton onPress={() => navigate("profiles")}>{ar ? "فتح ملفات الذكاء" : "Open Intelligence Profiles"}</ActionButton></section>
      <section className="x17-policy-note"><span className="x17-zone-label">{ar ? "السجل التاريخي" : "RECORD HISTORY"}</span><p>{ar ? "لا توجد واجهة سجل تاريخ/تدقيق محددة لهذا السجل." : "No record-scoped history or audit read endpoint is available."}</p></section>
    </div> : <p className="x17-empty">{languages.noSelection}</p> }
  ];
  const activeCount = allItems.filter((item) => item.lifecycle === "ACTIVE").length;
  const sampleState = loadState === "failed" ? "UNAVAILABLE" as const : "LIVE" as const;
  const summaryItems = [
    { label: ar ? "إجمالي العينة" : "RECORDS IN SAMPLE", value: allItems.length, note: ar ? "قائمة محدودة" : "Bounded API list" },
    { label: ar ? "نشط" : "ACTIVE", value: activeCount, note: ar ? "حالة دورة الحياة" : "Lifecycle state" },
    memory
      ? { label: ar ? "مؤرشف" : "ARCHIVED", value: archivedCount, note: ar ? "ضمن العينة" : "In returned sample" }
      : { label: ar ? "مفاتيح المصدر" : "SOURCE KEYS", value: new Set(allItems.map((item) => item.sourceKey).filter((value) => typeof value === "string")).size, note: ar ? "ضمن العينة" : "Distinct keys in sample" }
  ];
  return <section className={`x17-studio ${memory ? "is-memory" : "is-knowledge"}`} dir={ar ? "rtl" : "ltr"}>
    <header className={`x17-page-head ${memory ? "is-memory" : "is-knowledge"}`}><div><span className="x17-eyebrow">OIC / {memory ? "MEMORY ENGINEERING" : "KNOWLEDGE ENGINEERING"}</span><h2>{languages.header}</h2><p>{languages.description}</p></div><SummaryRack items={summaryItems} locale={locale} state={sampleState} /><PrimaryAction onPress={() => setCreateOpen(true)}>{languages.add}</PrimaryAction></header>
    <ScopeFilters locale={locale} tenants={tenants} filters={filters} setFilters={setFilters} onApply={() => void onApply()} memory={memory} includeArchived={includeArchived} setIncludeArchived={setIncludeArchived} loading={loading} />
    <DomainStrip memory={memory} selected={selected} locale={locale} data={data} />
    {loadError && <p className="x17-load-error" role="alert">{loadError} {ar ? "احتُفظ بالعينة السابقة." : "Previous sample is preserved."}</p>}
    {readback && <p className="x17-readback" role="status">{readback}</p>}
    {createOpen && <Inspector open onClose={() => setCreateOpen(false)} title={languages.add} description={memory ? languages.description : (ar ? "إنشاء سجل دليل منسق واحد." : "Create one curated evidence record.")} closeLabel={ar ? "إغلاق" : "Close"} dir={ar ? "rtl" : "ltr"}><CreateWizard kind={resource} locale={locale} tenants={tenants} currentSources={knowledge} onCancel={() => setCreateOpen(false)} onCreate={create} /></Inspector>}
    <div className={`x17-layout ${memory ? "is-memory" : "is-knowledge"}`}><aside className="x17-index"><header><b>{languages.index}</b><span>{visible.length} / {allItems.length} {ar ? "في العينة" : "in sample"}</span></header>
      {loadState === "loading" && allItems.length === 0 ? <LoadingState label={ar ? "جارٍ تحميل السجلات" : "Loading records"} /> : loadState === "failed" && allItems.length === 0 ? <ErrorState title={languages.error} description={ar ? "تعذر الوصول إلى العينة المصرح بها." : "The authorized sample could not be loaded."} action={<ActionButton onPress={() => void onApply()}>{ar ? "إعادة المحاولة" : "Retry"}</ActionButton>} /> : visible.length ? <div className="x17-index-list" role="list" aria-label={languages.index}>{visible.map((item) => <button className={`x17-index-item ${selected?.id === item.id ? "is-selected" : ""}`} type="button" key={str(item.id)} onClick={() => { setTab("record"); void inspect(item); }} role="listitem" aria-current={selected?.id === item.id ? "true" : undefined}><i className={`x17-state is-${String(item.lifecycle).toLowerCase()}`} aria-hidden="true" /><span><b>{str(item.title)}</b><small>{str(item.kind ?? item.sourceKey)} · {str(item.sourceType ?? item.sourceRef)}</small></span><code>{str(item.lifecycle)}</code><small className="x17-index-meta">{item.tenantId ? "TENANT" : "APPLICATION"} · {isoDate(item.updatedAt, locale)}</small></button>)}</div> : loadState === "available" ? <EmptyState title={languages.empty} description={ar ? "لا توجد سجلات مطابقة للنطاق والمرشحات الحالية." : "No records match the current authorized scope and filters."} /> : <p className="x17-empty">{languages.empty}</p>}
      <footer>{ar ? "قائمة API محدودة حتى 200 سجل. تُخفى المؤرشفة افتراضياً." : "API list is bounded to 200 records. Archived records are hidden by default."}</footer></aside>
      <main className="x17-primary">{selected ? <WorkspaceTabs label={memory ? "Memory workspace" : "Knowledge workspace"} items={tabs} selected={tab} onSelectionChange={setTab} dir={ar ? "rtl" : "ltr"} /> : <EmptyWorkspace memory={memory} locale={locale} tenantId={filters.tenantId} hasRecords={visible.length > 0} />}</main></div>
    {inspectorItem && openInspector}
  </section>;
}
