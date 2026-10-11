"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Locale, View } from "../../i18n";
import { ErrorState, LoadingState } from "../../components/oic-primitives";
import { ActionButton, ApplicationPicker, DiscreteStepSelector, Inspector, MultiSelect, RevisionPicker, TenantPicker, TextInput, ToggleControl } from "../../components/interface";
import { EconomicFlowStrip } from "./economic-flow-strip";

type Row = Record<string, unknown>;
type Data = { plans: Row[]; assignments: Row[]; quotas: Row[]; budgets: Row[]; balances: Row[] };
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
const page = (value: unknown): Row[] => list(record(value).items);
const text = (value: unknown, fallback = "—") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
const dateInput = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const toIso = (value: string) => new Date(value).toISOString();

export function AdmissionView({ view, locale, navigate }: { view: View; locale: Locale; navigate: (view: View) => void }) {
  const [data, setData] = useState<Data>({ plans: [], assignments: [], quotas: [], budgets: [], balances: [] });
  const [state, setState] = useState<"idle" | "loading" | "available" | "failed">("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [applications, setApplications] = useState<Row[]>([]);
  const [tenants, setTenants] = useState<Row[]>([]);
  const [modelFamilies, setModelFamilies] = useState<Row[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [showAdvancedIds, setShowAdvancedIds] = useState(false);
  const [appId, setAppId] = useState("");
  const [planKey, setPlanKey] = useState("");
  const [planName, setPlanName] = useState("");
  const [models, setModels] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [revisionId, setRevisionId] = useState("");
  const [quotaKey, setQuotaKey] = useState("");
  const [dimension, setDimension] = useState("inputTokens");
  const [quotaUnit, setQuotaUnit] = useState("TOKENS");
  const [quotaLimit, setQuotaLimit] = useState("10000");
  const [quotaBound, setQuotaBound] = useState("2048");
  const [budgetKey, setBudgetKey] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("10");
  const [budgetBound, setBudgetBound] = useState("0.1");
  const [currency, setCurrency] = useState("USD");
  const [purpose, setPurpose] = useState("Operations allowance");
  const [effectiveFrom, setEffectiveFrom] = useState(dateInput);
  const [selectedSubject, setSelectedSubject] = useState("APPLICATION");
  const [selectedWindow, setSelectedWindow] = useState("UTC_MONTH");
  const [selectedUnit, setSelectedUnit] = useState("OIU");
  const [selectedEnforcement, setSelectedEnforcement] = useState("HARD");
  const ar = locale === "ar";
  const tr = (en: string, arabic: string) => ar ? arabic : en;

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [response, scopeResponse] = await Promise.all([
        fetch("/api/console?view=admission", { cache: "no-store" }),
        fetch("/api/console?view=snapshot", { cache: "no-store" }).catch(() => null)
      ]);
      if (!response.ok) throw new Error("admission evidence unavailable");
      const body = record(await response.json());
      const nextData = { plans: list(body.plans), assignments: list(body.assignments), quotas: list(body.quotas), budgets: list(body.budgets), balances: page(body.balances) };
      setData(nextData);
      if (scopeResponse?.ok) {
        const snapshot = record(await scopeResponse.json());
        setApplications(list(snapshot.applications));
        setTenants(list(snapshot.tenants));
        setModelFamilies(list(snapshot.modelFamilies));
      }
      setState("available");
      return nextData;
    } catch {
      const empty: Data = { plans: [], assignments: [], quotas: [], budgets: [], balances: [] };
      setData(empty);
      setState("failed");
      return null;
    }
  }, []);

  useEffect(() => { if (view === "admission") void load(); }, [view, load]);
  if (view !== "admission") return null;

  const submit = async (event: FormEvent<HTMLFormElement>, action: string, payload: Row) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const result = record(await response.json().catch(() => null));
      if (!response.ok) {
        setMessage(response.status === 409 ? tr("Revision conflict. The current server state was kept; your inputs remain in the form. Refresh and inspect before retrying.", "تعارض في المراجعة. احتُفظ بحالة الخادم الحالية وبقيت مدخلاتك في النموذج. حدّث البيانات وافحصها قبل إعادة المحاولة.") : response.status === 403 ? tr("This operation is not available to the current operator scope.", "هذه العملية غير متاحة لنطاق المشغّل الحالي.") : tr("The operation was rejected. Verify scope, required input and effective interval; no successful result was confirmed.", "رُفضت العملية. تحقق من النطاق والمدخلات والفترة؛ لم يتم تأكيد نجاح العملية."));
        return;
      }
      setMessage(tr("Persisted. Reading the authoritative policy source…", "تم الحفظ. جارٍ قراءة مصدر السياسة المعتمد…"));
      const readback = await load();
      const id = text(result.id, "");
      const flattenedRevisions = readback?.plans.flatMap((plan) => list(plan.revisions)) ?? [];
      const found = !!id && [...(readback?.plans ?? []), ...(readback?.assignments ?? []), ...(readback?.quotas ?? []), ...(readback?.budgets ?? []), ...flattenedRevisions].some((row) => row.id === id);
      setMessage(found ? tr("Persisted and verified by source readback.", "تم الحفظ والتحقق منه بقراءة المصدر.") : tr("The command was accepted, but source readback did not confirm the returned record. No verified state is claimed; refresh or inspect the source.", "قُبل الأمر لكن قراءة المصدر لم تؤكد السجل المعاد. لا ندّعي التحقق؛ حدّث البيانات أو افحص المصدر."));
    } catch { setMessage(tr("The operation failed before readback. Your form inputs remain available; retry after verifying source and scope.", "فشلت العملية قبل قراءة المصدر. بقيت مدخلات النموذج؛ أعد المحاولة بعد التحقق من المصدر والنطاق.")); }
    finally { setBusy(false); }
  };
  const publish = async (kind: "plan" | "quota" | "budget", id: string) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: `admission.${kind}.publish`, id }) });
      const result = record(await response.json().catch(() => null));
      if (!response.ok) {
        setMessage(response.status === 409 ? tr("Publish conflict. No revision was overwritten; refresh and inspect the current source.", "تعارض في النشر. لم تُستبدل أي مراجعة؛ حدّث البيانات وافحص المصدر الحالي.") : tr("Publishing was rejected. Verify scope and effective interval.", "رُفض النشر. تحقق من النطاق وفترة السريان."));
        return;
      }
      setMessage(tr("Persisted. Verifying published revision by readback…", "تم الحفظ. جارٍ التحقق من المراجعة المنشورة…"));
      const readback = await load();
      const idToVerify = text(result.id, id);
      const found = kind === "plan"
        ? (readback?.plans.flatMap((plan) => list(plan.revisions)) ?? []).some((row) => row.id === idToVerify && row.status === "PUBLISHED")
        : (kind === "quota" ? readback?.quotas : readback?.budgets)?.some((row) => row.id === idToVerify && row.status === "PUBLISHED") ?? false;
      setMessage(found ? tr("Published revision verified by source readback.", "تم التحقق من المراجعة المنشورة بقراءة المصدر.") : tr("The command was accepted, but published state was not confirmed in readback.", "قُبل الأمر لكن لم يتم تأكيد حالة النشر بقراءة المصدر."));
    } catch { setMessage(tr("Publishing failed before readback. No successful state is claimed.", "فشل النشر قبل قراءة المصدر. لا ندّعي نجاحاً مؤكداً.")); }
    finally { setBusy(false); }
  };
  const reconcileExpired = async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "admission.reconcile-expired", limit: 100 }) });
      if (!response.ok) throw new Error("reconcile rejected");
      const result = record(await response.json());
      setMessage(tr(`Reconciliation inspected ${text(result.inspected, "0")} records and safely released ${text(result.released, "0")} pre-dispatch reservations.`, `فحصت التسوية ${text(result.inspected, "0")} سجلات وحررت بأمان ${text(result.released, "0")} حجوزات قبل الإرسال.`)); await load();
    } catch { setMessage(tr("Reconciliation failed; no uncertain liability was automatically released.", "تعذّرت التسوية؛ لم تُحرر أي التزامات غير مؤكدة تلقائياً.")); }
    finally { setBusy(false); }
  };
  const heading = (title: string, note: string) => <header className="panel-heading"><div><span className="eyebrow">OIC-6.3 / VERSIONED POLICY</span><h2>{title}</h2><p>{note}</p></div></header>;
  const rows = (title: string, values: Row[], columns: Array<[string, (row: Row) => string]>, kind?: "plan" | "quota" | "budget") => <section className="panel economics-panel" key={title}>
    {heading(title, tr("Revisioned source. Publishing affects new admissions; existing reservations remain pinned.", "مصدر ذو مراجعات. يؤثر النشر في طلبات القبول الجديدة، وتظل الحجوزات القائمة مرتبطة بمراجعتها."))}
    <div className="table-frame"><table><thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}<th>{tr("Action", "الإجراء")}</th></tr></thead><tbody>
      {values.map((item) => <tr key={text(item.id)}>{columns.map(([label, value]) => <td key={label}>{value(item)}</td>)}<td><ActionButton variant="quiet" onPress={() => kind && item.status === "DRAFT" ? void publish(kind, text(item.id)) : setSelected(item)}>{kind && item.status === "DRAFT" ? tr("Publish", "نشر") : tr("Inspect", "فحص")}</ActionButton></td></tr>)}
      {!values.length && <tr><td colSpan={columns.length + 1}>{tr("No configured records.", "لا توجد سجلات مُعدّة.")}</td></tr>}
    </tbody></table></div>
  </section>;
  const plans: Row[] = data.plans.flatMap((plan) => list(plan.revisions).map((revision) => ({ ...revision, planKey: plan.planKey, displayName: plan.displayName, planId: plan.id })));
  const applicationOptions = applications.filter((item) => typeof item.id === "string").map((item) => ({ id: text(item.id, ""), label: text(item.displayName, text(item.key, tr("Application", "التطبيق"))), secondary: text(item.key, ""), type: tr("Application", "التطبيق") }));
  const tenantOptions = tenants.filter((item) => typeof item.id === "string" && (!appId || item.applicationId === appId)).map((item) => ({ id: text(item.id, ""), label: text(item.displayName, text(item.key, tr("Tenant", "المستأجر"))), secondary: text(item.key, ""), type: tr("Tenant", "المستأجر"), parentId: text(item.applicationId, "") }));
  const revisionOptions = plans.filter((item) => typeof item.id === "string" && item.status === "PUBLISHED").map((item) => ({ id: text(item.id, ""), label: `${text(item.displayName)} · r${text(item.revision)}`, secondary: text(item.status), type: tr("Plan revision", "مراجعة الخطة"), scope: text(item.planKey) }));
  const modelOptions = modelFamilies.flatMap((family) => list(family.editions)
    .filter((edition) => /^oi-[a-z0-9._-]+$/i.test(text(edition.publicId, "")) && list(edition.visibility).some((item) => item.applicationId === appId))
    .map((edition) => ({ id: text(edition.publicId, ""), label: text(edition.displayName, text(edition.publicId)), description: `${text(family.displayName)} · ${text(edition.lifecycle)}` }))
  ).filter((option, index, all) => all.findIndex((candidate) => candidate.id === option.id) === index);
  const pickerLabels = { placeholder: tr("Choose from source records", "اختر من سجلات المصدر"), search: tr("Search records", "ابحث في السجلات"), empty: tr("No matching source record", "لا يوجد سجل مصدر مطابق") };
  const applicationPicker = <ApplicationPicker label={tr("Application", "التطبيق")} value={appId} onChange={(value) => { setAppId(value); setTenantId(""); setSelectedModelIds([]); }} options={applicationOptions} placeholder={pickerLabels.placeholder} searchLabel={pickerLabels.search} emptyLabel={pickerLabels.empty} locale={locale} dir={ar ? "rtl" : "ltr"} disabled={showAdvancedIds || !applicationOptions.length} />;
  const tenantPicker = <TenantPicker label={tr("Tenant (optional)", "المستأجر (اختياري)")} value={tenantId} onChange={setTenantId} options={tenantOptions} placeholder={tr("Application scope", "نطاق التطبيق")} searchLabel={pickerLabels.search} emptyLabel={pickerLabels.empty} locale={locale} dir={ar ? "rtl" : "ltr"} disabled={showAdvancedIds || !appId || !tenantOptions.length} />;
  const revisionPicker = <RevisionPicker label={tr("Plan revision", "مراجعة الخطة")} value={revisionId} onChange={setRevisionId} options={revisionOptions} placeholder={pickerLabels.placeholder} searchLabel={pickerLabels.search} emptyLabel={tr("No plan revisions available", "لا توجد مراجعات خطط متاحة")} locale={locale} dir={ar ? "rtl" : "ltr"} disabled={showAdvancedIds || !revisionOptions.length} />;
  const knownBalance = (value: unknown) => (typeof value === "string" || typeof value === "number") && Number.isFinite(Number(value));
  const planFields = { applications: data.plans.length, assignments: data.assignments.length, quotas: data.quotas.length, budgets: data.budgets.length, outstanding: data.balances.filter((row) => [row.held, row.uncertain].some((value) => knownBalance(value) && Number(value) > 0)).length, incomplete: data.balances.filter((row) => !knownBalance(row.held) || !knownBalance(row.uncertain)).length };
  const selectedRevision = plans.find((row) => row.id === revisionId);
  const selectedApplication = applicationOptions.find((row) => row.id === appId);
  const selectedTenant = tenantOptions.find((row) => row.id === tenantId);
  const direction = ar ? "rtl" : "ltr";

  return <section className="workspace-page admission-view" dir={direction}>
    <header className="lab-page-heading"><div><span className="eyebrow">OIC-6.3 / ADMISSION & RESERVED LIABILITY</span><h1>{tr("Admission Control Studio", "استوديو ضبط القبول")}</h1><p>{tr("Build revisioned entitlements, inspect every matching quota and budget, then observe held and uncertain liability. Admission authority remains server-side.", "أنشئ استحقاقات ذات مراجعات، وافحص كل حصة وميزانية مطابقة، ثم راقب الالتزامات المحجوزة وغير المؤكدة. تظل سلطة القبول على الخادم.")}</p></div><div className="admission-header-actions"><ActionButton variant="secondary" onPress={() => void reconcileExpired()} loading={busy}>{tr("Reconcile expired pre-dispatch", "تسوية الحجوزات المنتهية قبل الإرسال")}</ActionButton><ActionButton variant="secondary" onPress={() => void load()} loading={state === "loading"}>{tr("Refresh", "تحديث")}</ActionButton></div></header>
    <EconomicFlowStrip current="admission" locale={locale} navigate={navigate} states={{ usage: "UNKNOWN", provider: "UNKNOWN", oiu: "UNKNOWN", admission: state === "available" && (data.plans.length || data.quotas.length || data.budgets.length) ? "AVAILABLE" : "UNKNOWN", rating: "UNKNOWN" }} />
    <div className="economics-disclaimer">{tr("Admission control is separate from customer rating. Enforcement defaults to SHADOW; server configuration governs activation. Unknown liability remains held until evidence settles it.", "ضبط القبول منفصل عن تسعير العميل. الوضع الافتراضي SHADOW وإعدادات الخادم تحكم التفعيل. تظل الالتزامات غير المعروفة محجوزة حتى تسويتها بالدليل.")}</div>
    <div className="admission-scope-rack"><div><span className="eyebrow">{tr("SCOPE / SOURCE-BACKED", "النطاق / موثق بالمصدر")}</span><p>{tr("Select application, tenant and pinned revision from available OIC records.", "اختر التطبيق والمستأجر والمراجعة المثبتة من سجلات OIC المتاحة.")}</p></div>{applicationPicker}{tenantPicker}{revisionPicker}<ToggleControl label={tr("Advanced IDs", "المعرّفات المتقدمة")} value={showAdvancedIds} onChange={(enabled) => { setModels(enabled ? selectedModelIds.join(", ") : ""); if (!enabled) setSelectedModelIds(models.split(",").map((item) => item.trim()).filter((item) => modelOptions.some((option) => option.id === item))); setShowAdvancedIds(enabled); }} dir={direction} help={tr("Use only when the authorized source record is not listed.", "استخدمه فقط عندما لا يظهر سجل المصدر المصرح به.")} /></div>
    {message && <p role="status" className="admission-feedback">{message}</p>}
    {state === "loading" && <LoadingState label={tr("Loading admission policy", "جارٍ تحميل سياسة القبول")} />}
    {state === "failed" && <ErrorState title={tr("Admission data unavailable", "بيانات القبول غير متاحة")} description={tr("The scoped plan and quota source could not be loaded.", "تعذّر تحميل مصدر الخطط والحصص المحدد النطاق.")} />}
    {state === "available" && <>
      <section className="economics-source-summary"><article className="metric-card"><p>{tr("Plans", "الخطط")}</p><strong>{planFields.applications}</strong><small>{tr("revisioned entitlements", "استحقاقات ذات مراجعات")}</small></article><article className="metric-card"><p>{tr("Assignments", "التخصيصات")}</p><strong>{planFields.assignments}</strong><small>{tr("effective scoped records", "سجلات نطاق سارية")}</small></article><article className="metric-card"><p>{tr("Quota policies", "سياسات الحصص")}</p><strong>{planFields.quotas}</strong><small>{tr("resource-unit limits", "حدود وحدات الموارد")}</small></article><article className="metric-card"><p>{tr("Budget policies", "سياسات الميزانية")}</p><strong>{planFields.budgets}</strong><small>{tr("economic or OIU caps", "حدود اقتصادية أو OIU")}</small></article><article className="metric-card"><p>{tr("Buckets with held / uncertain", "حاويات بها التزامات محجوزة / غير مؤكدة")}</p><strong>{planFields.outstanding}</strong><small>{tr("source-backed liability", "التزام موثق بالمصدر")}</small></article><article className="metric-card"><p>{tr("Balance fields unavailable", "حقول رصيد غير متاحة")}</p><strong>{planFields.incomplete}</strong><small>{tr("not interpreted as zero", "لا تُفسر على أنها صفر")}</small></article></section>
      <section className="admission-forms">
        <form className="panel admission-form" onSubmit={(event) => void submit(event, "admission.plan.create", { applicationId: appId, planKey, displayName: planName, models: showAdvancedIds ? models.split(",").map((item) => item.trim()).filter(Boolean) : selectedModelIds, effectiveFrom: toIso(effectiveFrom) })}>
          {heading(tr("Draft a plan", "إنشاء مسودة خطة"), tr("Plan revisions are immutable after publication.", "تصبح مراجعات الخطة ثابتة بعد النشر."))}
          {showAdvancedIds ? <TextInput label={tr("Application ID", "معرّف التطبيق")} value={appId} onChange={setAppId} required dir="ltr" /> : applicationPicker}
          <TextInput label={tr("Plan key", "مفتاح الخطة")} value={planKey} onChange={setPlanKey} required dir="ltr" />
          <TextInput label={tr("Display name", "الاسم المعروض")} value={planName} onChange={setPlanName} required dir={direction} />
          {showAdvancedIds ? <TextInput label={tr("Oi model IDs (advanced; comma separated)", "معرّفات نماذج Oi (متقدم؛ مفصولة بفواصل)")} value={models} onChange={setModels} dir="ltr" /> : <MultiSelect label={tr("Entitled Oi models", "نماذج Oi المسموح بها")} values={selectedModelIds} onChange={setSelectedModelIds} options={modelOptions} dir={direction} />}
          <TextInput label={tr("Effective from", "ساري من")} value={effectiveFrom} onChange={setEffectiveFrom} type="datetime-local" dir="ltr" />
          <ActionButton type="submit" disabled={busy}>{tr("Save draft", "حفظ المسودة")}</ActionButton>
        </form>
        <form className="panel admission-form" onSubmit={(event) => void submit(event, "admission.assignment.create", { applicationId: appId, tenantId: tenantId || null, planRevisionId: revisionId, subjectKey: "*", effectiveFrom: toIso(effectiveFrom) })}>
          {heading(tr("Assign a published plan", "تخصيص خطة منشورة"), tr("Assignment scope is checked again by the API.", "يعيد API التحقق من نطاق التخصيص."))}
          {showAdvancedIds ? <><TextInput label={tr("Application ID", "معرّف التطبيق")} value={appId} onChange={setAppId} required dir="ltr" /><TextInput label={tr("Tenant ID (optional)", "معرّف المستأجر (اختياري)")} value={tenantId} onChange={setTenantId} dir="ltr" /><TextInput label={tr("Published plan revision ID", "معرّف مراجعة الخطة المنشورة")} value={revisionId} onChange={setRevisionId} required dir="ltr" /></> : <>{applicationPicker}{tenantPicker}{revisionPicker}</>}
          <TextInput label={tr("Effective from", "ساري من")} value={effectiveFrom} onChange={setEffectiveFrom} type="datetime-local" dir="ltr" />
          <ActionButton type="submit" disabled={busy}>{tr("Assign plan", "تخصيص الخطة")}</ActionButton>
        </form>
        <form className="panel admission-form" onSubmit={(event) => void submit(event, "admission.quota.create", { applicationId: appId, ...(tenantId ? { tenantId } : {}), planRevisionId: revisionId, quotaKey, subject: selectedSubject, dimension, unit: quotaUnit, window: selectedWindow, enforcement: selectedEnforcement, limitValue: quotaLimit, reservationUpperBound: quotaBound, safetyMargin: "0", unknownLiabilityRule: "HOLD_MAXIMUM", effectiveFrom: toIso(effectiveFrom) })}>
          {heading(tr("Draft a quota", "إنشاء مسودة حصة"), tr("Hard limits deny admission before external dispatch.", "تمنع الحدود الصارمة القبول قبل الإرسال الخارجي."))}
          <TextInput label={tr("Quota key", "مفتاح الحصة")} value={quotaKey} onChange={setQuotaKey} required dir="ltr" />
          {showAdvancedIds ? <TextInput label={tr("Plan revision ID", "معرّف مراجعة الخطة")} value={revisionId} onChange={setRevisionId} required dir="ltr" /> : revisionPicker}
          <DiscreteStepSelector label={tr("Subject", "الموضوع")} value={selectedSubject} onChange={setSelectedSubject} options={["APPLICATION", "TENANT", "PRINCIPAL", "MODEL", "TIER", "CAPABILITY"].map((id) => ({ id, label: id }))} placeholder={tr("Choose subject", "اختر الموضوع")} dir={direction} locale={locale} />
          <TextInput label={tr("Usage dimension", "بُعد الاستخدام")} value={dimension} onChange={setDimension} required dir="ltr" />
          <TextInput label={tr("Unit", "الوحدة")} value={quotaUnit} onChange={setQuotaUnit} required dir="ltr" />
          <DiscreteStepSelector label={tr("Window", "الفترة")} value={selectedWindow} onChange={setSelectedWindow} options={["LIFETIME", "UTC_DAY", "UTC_MONTH", "CONTRACT_PERIOD"].map((id) => ({ id, label: id }))} placeholder={tr("Choose window", "اختر الفترة")} dir={direction} locale={locale} />
          <DiscreteStepSelector label={tr("Enforcement", "التطبيق")} value={selectedEnforcement} onChange={setSelectedEnforcement} options={["HARD", "SOFT"].map((id) => ({ id, label: id }))} placeholder={tr("Choose enforcement", "اختر التطبيق")} dir={direction} locale={locale} />
          <TextInput label={tr("Limit", "الحد")} value={quotaLimit} onChange={setQuotaLimit} required dir="ltr" />
          <TextInput label={tr("Maximum per-request reservation", "أقصى حجز لكل طلب")} value={quotaBound} onChange={setQuotaBound} required dir="ltr" />
          <ActionButton type="submit" disabled={busy}>{tr("Save quota draft", "حفظ مسودة الحصة")}</ActionButton>
        </form>
        <form className="panel admission-form" onSubmit={(event) => void submit(event, "admission.budget.create", { applicationId: appId, ...(tenantId ? { tenantId } : {}), planRevisionId: revisionId, budgetKey, unit: selectedUnit, ...(selectedUnit === "CURRENCY" ? { currency } : {}), enforcement: selectedEnforcement, amount: budgetAmount, reservationUpperBound: budgetBound, purpose, safetyMargin: "0", unknownLiabilityRule: "HOLD_MAXIMUM", effectiveFrom: toIso(effectiveFrom) })}>
          {heading(tr("Draft a budget", "إنشاء مسودة ميزانية"), tr("Currency and OIU liabilities remain separate and independently evidenced.", "تظل الالتزامات النقدية ووحدات OIU منفصلة ولكل منها دليل مستقل."))}
          <TextInput label={tr("Budget key", "مفتاح الميزانية")} value={budgetKey} onChange={setBudgetKey} required dir="ltr" />
          {showAdvancedIds ? <TextInput label={tr("Plan revision ID", "معرّف مراجعة الخطة")} value={revisionId} onChange={setRevisionId} required dir="ltr" /> : revisionPicker}
          <DiscreteStepSelector label={tr("Unit", "الوحدة")} value={selectedUnit} onChange={setSelectedUnit} options={["OIU", "CURRENCY"].map((id) => ({ id, label: id }))} placeholder={tr("Choose unit", "اختر الوحدة")} dir={direction} locale={locale} />
          {selectedUnit === "CURRENCY" && <TextInput label={tr("Native currency", "العملة الأصلية")} value={currency} onChange={setCurrency} required dir="ltr" />}
          <TextInput label={tr("Budget amount", "مقدار الميزانية")} value={budgetAmount} onChange={setBudgetAmount} required dir="ltr" />
          <TextInput label={tr("Maximum per-request liability", "أقصى التزام لكل طلب")} value={budgetBound} onChange={setBudgetBound} required dir="ltr" />
          <TextInput label={tr("Purpose", "الغرض")} value={purpose} onChange={setPurpose} required dir={direction} />
          <ActionButton type="submit" disabled={busy}>{tr("Save budget draft", "حفظ مسودة الميزانية")}</ActionButton>
        </form>
      </section>
      <section className="admission-draft-readout" aria-live="polite"><header><span className="eyebrow">{tr("LOCAL DRAFT READOUT", "ملخص المسودة المحلي")}</span><h2>{tr("Scope and capacity inputs", "النطاق ومدخلات السعة")}</h2></header><div><span>{tr("Application", "التطبيق")}</span><bdi>{selectedApplication ? `${selectedApplication.label}${selectedApplication.secondary ? ` · ${selectedApplication.secondary}` : ""}` : appId ? tr("Advanced application ID selected", "تم تحديد معرّف التطبيق المتقدم") : tr("Not selected", "لم يُحدد")}</bdi><span>{tr("Tenant", "المستأجر")}</span><bdi>{selectedTenant ? `${selectedTenant.label}${selectedTenant.secondary ? ` · ${selectedTenant.secondary}` : ""}` : tenantId ? tr("Advanced tenant ID selected", "تم تحديد معرّف المستأجر المتقدم") : tr("Application scope", "نطاق التطبيق")}</bdi><span>{tr("Pinned plan revision", "مراجعة الخطة المثبتة")}</span><bdi>{selectedRevision ? `${text(selectedRevision.displayName)} · r${text(selectedRevision.revision)}` : revisionId ? tr("Advanced revision ID selected", "تم تحديد معرّف المراجعة المتقدم") : tr("Not selected", "لم تُحدد")}</bdi><span>{tr("Quota request ceiling", "حد طلب الحصة")}</span><bdi>{quotaBound} {quotaUnit}</bdi><span>{tr("Budget request ceiling", "حد طلب الميزانية")}</span><bdi>{budgetBound} {selectedUnit === "CURRENCY" ? currency : "OIU"}</bdi></div><p>{tr("Draft fields only. No local admission simulation or capacity verdict is available; server policy precedence, scope, unknown liability and revision conflicts are authoritative at apply time.", "حقول المسودة فقط. لا تتوفر محاكاة قبول محلية أو نتيجة سعة؛ ويظل ترتيب السياسات ونطاقها والالتزام غير المعروف وتعارض المراجعات خاضعاً لقرار الخادم عند التطبيق.")}</p></section>
      {rows(tr("Plans & revisions", "الخطط والمراجعات"), plans, [[tr("Plan", "الخطة"), (row) => text(row.displayName)], [tr("Revision", "المراجعة"), (row) => text(row.revision)], [tr("State", "الحالة"), (row) => text(row.status)], [tr("Effective from", "ساري من"), (row) => text(row.effectiveFrom)]], "plan")}
      {rows(tr("Assignments", "التخصيصات"), data.assignments, [[tr("Plan", "الخطة"), (row) => text(record(record(row.planRevision).plan).displayName)], [tr("Tenant", "المستأجر"), (row) => text(record(row.tenant).displayName, tr("Application", "التطبيق"))], [tr("State", "الحالة"), (row) => text(row.status)], [tr("Effective from", "ساري من"), (row) => text(row.effectiveFrom)]])}
      {rows(tr("Quota revisions", "مراجعات الحصص"), data.quotas, [[tr("Key", "المفتاح"), (row) => text(row.quotaKey)], [tr("Dimension", "البُعد"), (row) => text(row.dimension)], [tr("Limit / unit", "الحد / الوحدة"), (row) => `${text(row.limitValue)} ${text(row.unit)}`], [tr("State", "الحالة"), (row) => text(row.status)]], "quota")}
      {rows(tr("Budget revisions", "مراجعات الميزانيات"), data.budgets, [[tr("Key", "المفتاح"), (row) => text(row.budgetKey)], [tr("Budget", "الميزانية"), (row) => `${text(row.amount)} ${text(row.currency ?? row.unit)}`], [tr("Purpose", "الغرض"), (row) => text(row.purpose)], [tr("State", "الحالة"), (row) => text(row.status)]], "budget")}
      {rows(tr("Quota and budget balances", "أرصدة الحصص والميزانيات"), data.balances, [[tr("Unit", "الوحدة"), (row) => text(row.currency ?? row.unit)], [tr("Consumed", "المستهلك"), (row) => text(row.consumed)], [tr("Held", "المحجوز"), (row) => text(row.held)], [tr("Uncertain", "غير المؤكد"), (row) => text(row.uncertain)], [tr("Limit", "الحد"), (row) => text(row.limitValue)]])}
    </>}
    <Inspector open={Boolean(selected)} onClose={() => setSelected(null)} title={tr("Revision evidence", "دليل المراجعة")} description={tr("Published revisions remain immutable and are pinned to admissions.", "تظل المراجعات المنشورة ثابتة ومرتبطة بطلبات القبول.")} closeLabel={tr("Close", "إغلاق")} dir={direction}>{selected && Object.entries(selected).filter(([, value]) => typeof value !== "object").map(([key, value]) => <div className="x14-detail-row" key={key}><span>{key}</span><bdi>{text(value)}</bdi></div>)}</Inspector>
  </section>;
}
