"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Locale, View } from "../../i18n";
import { ErrorState, LoadingState } from "../../components/oic-primitives";
import { ActionButton, DiscreteStepSelector, Inspector, TextInput } from "../../components/interface";

type Row = Record<string, unknown>;
type Data = { plans: Row[]; assignments: Row[]; quotas: Row[]; budgets: Row[]; balances: Row[] };
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
const page = (value: unknown): Row[] => list(record(value).items);
const text = (value: unknown, fallback = "—") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
const dateInput = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const toIso = (value: string) => new Date(value).toISOString();

export function AdmissionView({ view, locale }: { view: View; locale: Locale }) {
  const [data, setData] = useState<Data>({ plans: [], assignments: [], quotas: [], budgets: [], balances: [] });
  const [state, setState] = useState<"idle" | "loading" | "available" | "failed">("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [appId, setAppId] = useState("");
  const [planKey, setPlanKey] = useState("");
  const [planName, setPlanName] = useState("");
  const [models, setModels] = useState("oi-1.7");
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
      const response = await fetch("/api/console?view=admission", { cache: "no-store" });
      if (!response.ok) throw new Error("admission evidence unavailable");
      const body = record(await response.json());
      setData({ plans: list(body.plans), assignments: list(body.assignments), quotas: list(body.quotas), budgets: list(body.budgets), balances: page(body.balances) });
      setState("available");
    } catch {
      setData({ plans: [], assignments: [], quotas: [], budgets: [], balances: [] });
      setState("failed");
    }
  }, []);

  useEffect(() => { if (view === "admission") void load(); }, [view, load]);
  if (view !== "admission") return null;

  const submit = async (event: FormEvent<HTMLFormElement>, action: string, payload: Row) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      if (!response.ok) throw new Error("operation rejected");
      setMessage(tr("Saved and audited.", "تم الحفظ والتدقيق.")); await load();
    } catch { setMessage(tr("The operation failed. Check scope and effective dates.", "تعذّر تنفيذ العملية. راجع النطاق والتواريخ.")); }
    finally { setBusy(false); }
  };
  const publish = async (kind: "plan" | "quota" | "budget", id: string) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: `admission.${kind}.publish`, id }) });
      if (!response.ok) throw new Error("publish rejected");
      setMessage(tr("Revision published.", "تم نشر المراجعة.")); await load();
    } catch { setMessage(tr("Publishing failed. Resolve scope or interval conflicts first.", "فشل النشر. عالج تعارض النطاق أو الفترات أولاً.")); }
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
  const plans = data.plans.flatMap((plan) => list(plan.revisions).map((revision) => ({ ...revision, planKey: plan.planKey, displayName: plan.displayName, planId: plan.id })));
  const planFields = { applications: data.plans.length, assignments: data.assignments.length, quotas: data.quotas.length, budgets: data.budgets.length, outstanding: data.balances.filter((row) => Number(row.held) + Number(row.uncertain) > 0).length };
  const direction = ar ? "rtl" : "ltr";

  return <section className="workspace-page admission-view" dir={direction}>
    <header className="lab-page-heading"><div><span className="eyebrow">OIC-6.3 / ADMISSION & RESERVED LIABILITY</span><h1>{tr("Plans, quotas & admission", "الخطط والحصص والقبول")}</h1><p>{tr("Versioned entitlements and hard limits are checked before provider dispatch. Unknown liability remains reserved until evidence settles it.", "تُفحص الاستحقاقات والحدود الصارمة قبل إرسال الطلب للمزوّد. وتبقى الالتزامات غير المعروفة محجوزة حتى تسويتها بالدليل.")}</p></div><div className="admission-header-actions"><ActionButton variant="secondary" onPress={() => void reconcileExpired()} loading={busy}>{tr("Reconcile expired pre-dispatch", "تسوية الحجوزات المنتهية قبل الإرسال")}</ActionButton><ActionButton variant="secondary" onPress={() => void load()} loading={state === "loading"}>{tr("Refresh", "تحديث")}</ActionButton></div></header>
    <div className="economics-disclaimer">{tr("Enforcement defaults to SHADOW. Enable ENFORCE only through server configuration after the scoped canary gate. No customer charge is created here.", "يكون وضع التطبيق الافتراضي SHADOW. لا تفعّل ENFORCE إلا من إعدادات الخادم وبعد اجتياز بوابة التشغيل المحدود. لا تُنشأ رسوم عملاء هنا.")}</div>
    {message && <p role="status" className="admission-feedback">{message}</p>}
    {state === "loading" && <LoadingState label={tr("Loading admission policy", "جارٍ تحميل سياسة القبول")} />}
    {state === "failed" && <ErrorState title={tr("Admission data unavailable", "بيانات القبول غير متاحة")} description={tr("The scoped plan and quota source could not be loaded.", "تعذّر تحميل مصدر الخطط والحصص المحدد النطاق.")} />}
    {state === "available" && <>
      <section className="economics-source-summary"><article className="metric-card"><p>{tr("Plans", "الخطط")}</p><strong>{planFields.applications}</strong><small>{tr("versioned", "ذات مراجعات")}</small></article><article className="metric-card"><p>{tr("Assignments", "التخصيصات")}</p><strong>{planFields.assignments}</strong><small>{tr("effective scoped records", "سجلات نطاق سارية")}</small></article><article className="metric-card"><p>{tr("Quota policies", "سياسات الحصص")}</p><strong>{planFields.quotas}</strong><small>{tr("revisioned", "ذات مراجعات")}</small></article><article className="metric-card"><p>{tr("Liability held / uncertain", "التزامات محجوزة / غير مؤكدة")}</p><strong>{planFields.outstanding}</strong><small>{tr("ledger buckets", "حاويات الدفتر")}</small></article></section>
      <section className="admission-forms">
        <form className="panel admission-form" onSubmit={(event) => void submit(event, "admission.plan.create", { applicationId: appId, planKey, displayName: planName, models: models.split(",").map((item) => item.trim()).filter(Boolean), effectiveFrom: toIso(effectiveFrom) })}>
          {heading(tr("Draft a plan", "إنشاء مسودة خطة"), tr("Plan revisions are immutable after publication.", "تصبح مراجعات الخطة ثابتة بعد النشر."))}
          <TextInput label={tr("Application ID", "معرّف التطبيق")} value={appId} onChange={setAppId} required dir="ltr" />
          <TextInput label={tr("Plan key", "مفتاح الخطة")} value={planKey} onChange={setPlanKey} required dir="ltr" />
          <TextInput label={tr("Display name", "الاسم المعروض")} value={planName} onChange={setPlanName} required dir={direction} />
          <TextInput label={tr("Entitled Oi model IDs, comma separated", "معرّفات نماذج Oi المسموح بها، مفصولة بفواصل")} value={models} onChange={setModels} dir="ltr" />
          <TextInput label={tr("Effective from", "ساري من")} value={effectiveFrom} onChange={setEffectiveFrom} type="datetime-local" dir="ltr" />
          <ActionButton type="submit" disabled={busy}>{tr("Save draft", "حفظ المسودة")}</ActionButton>
        </form>
        <form className="panel admission-form" onSubmit={(event) => void submit(event, "admission.assignment.create", { applicationId: appId, tenantId: tenantId || null, planRevisionId: revisionId, subjectKey: "*", effectiveFrom: toIso(effectiveFrom) })}>
          {heading(tr("Assign a published plan", "تخصيص خطة منشورة"), tr("Assignment scope is checked again by the API.", "يعيد API التحقق من نطاق التخصيص."))}
          <TextInput label={tr("Application ID", "معرّف التطبيق")} value={appId} onChange={setAppId} required dir="ltr" />
          <TextInput label={tr("Tenant ID (optional)", "معرّف المستأجر (اختياري)")} value={tenantId} onChange={setTenantId} dir="ltr" />
          <TextInput label={tr("Published plan revision ID", "معرّف مراجعة الخطة المنشورة")} value={revisionId} onChange={setRevisionId} required dir="ltr" />
          <TextInput label={tr("Effective from", "ساري من")} value={effectiveFrom} onChange={setEffectiveFrom} type="datetime-local" dir="ltr" />
          <ActionButton type="submit" disabled={busy}>{tr("Assign plan", "تخصيص الخطة")}</ActionButton>
        </form>
        <form className="panel admission-form" onSubmit={(event) => void submit(event, "admission.quota.create", { applicationId: appId, ...(tenantId ? { tenantId } : {}), planRevisionId: revisionId, quotaKey, subject: selectedSubject, dimension, unit: quotaUnit, window: selectedWindow, enforcement: selectedEnforcement, limitValue: quotaLimit, reservationUpperBound: quotaBound, safetyMargin: "0", unknownLiabilityRule: "HOLD_MAXIMUM", effectiveFrom: toIso(effectiveFrom) })}>
          {heading(tr("Draft a quota", "إنشاء مسودة حصة"), tr("Hard limits deny admission before external dispatch.", "تمنع الحدود الصارمة القبول قبل الإرسال الخارجي."))}
          <TextInput label={tr("Quota key", "مفتاح الحصة")} value={quotaKey} onChange={setQuotaKey} required dir="ltr" />
          <TextInput label={tr("Plan revision ID", "معرّف مراجعة الخطة")} value={revisionId} onChange={setRevisionId} required dir="ltr" />
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
          <TextInput label={tr("Plan revision ID", "معرّف مراجعة الخطة")} value={revisionId} onChange={setRevisionId} required dir="ltr" />
          <DiscreteStepSelector label={tr("Unit", "الوحدة")} value={selectedUnit} onChange={setSelectedUnit} options={["OIU", "CURRENCY"].map((id) => ({ id, label: id }))} placeholder={tr("Choose unit", "اختر الوحدة")} dir={direction} locale={locale} />
          {selectedUnit === "CURRENCY" && <TextInput label={tr("Native currency", "العملة الأصلية")} value={currency} onChange={setCurrency} required dir="ltr" />}
          <TextInput label={tr("Budget amount", "مقدار الميزانية")} value={budgetAmount} onChange={setBudgetAmount} required dir="ltr" />
          <TextInput label={tr("Maximum per-request liability", "أقصى التزام لكل طلب")} value={budgetBound} onChange={setBudgetBound} required dir="ltr" />
          <TextInput label={tr("Purpose", "الغرض")} value={purpose} onChange={setPurpose} required dir={direction} />
          <ActionButton type="submit" disabled={busy}>{tr("Save budget draft", "حفظ مسودة الميزانية")}</ActionButton>
        </form>
      </section>
      {rows(tr("Plans & revisions", "الخطط والمراجعات"), plans, [[tr("Plan", "الخطة"), (row) => text(row.displayName)], [tr("Revision", "المراجعة"), (row) => text(row.revision)], [tr("State", "الحالة"), (row) => text(row.status)], [tr("Effective from", "ساري من"), (row) => text(row.effectiveFrom)]], "plan")}
      {rows(tr("Assignments", "التخصيصات"), data.assignments, [[tr("Plan", "الخطة"), (row) => text(record(record(row.planRevision).plan).displayName)], [tr("Tenant", "المستأجر"), (row) => text(record(row.tenant).displayName, tr("Application", "التطبيق"))], [tr("State", "الحالة"), (row) => text(row.status)], [tr("Effective from", "ساري من"), (row) => text(row.effectiveFrom)]])}
      {rows(tr("Quota revisions", "مراجعات الحصص"), data.quotas, [[tr("Key", "المفتاح"), (row) => text(row.quotaKey)], [tr("Dimension", "البُعد"), (row) => text(row.dimension)], [tr("Limit / unit", "الحد / الوحدة"), (row) => `${text(row.limitValue)} ${text(row.unit)}`], [tr("State", "الحالة"), (row) => text(row.status)]], "quota")}
      {rows(tr("Budget revisions", "مراجعات الميزانيات"), data.budgets, [[tr("Key", "المفتاح"), (row) => text(row.budgetKey)], [tr("Budget", "الميزانية"), (row) => `${text(row.amount)} ${text(row.currency ?? row.unit)}`], [tr("Purpose", "الغرض"), (row) => text(row.purpose)], [tr("State", "الحالة"), (row) => text(row.status)]], "budget")}
      {rows(tr("Quota and budget balances", "أرصدة الحصص والميزانيات"), data.balances, [[tr("Unit", "الوحدة"), (row) => text(row.currency ?? row.unit)], [tr("Consumed", "المستهلك"), (row) => text(row.consumed)], [tr("Held", "المحجوز"), (row) => text(row.held)], [tr("Uncertain", "غير المؤكد"), (row) => text(row.uncertain)], [tr("Limit", "الحد"), (row) => text(row.limitValue)]])}
    </>}
    <Inspector open={Boolean(selected)} onClose={() => setSelected(null)} title={tr("Revision evidence", "دليل المراجعة")} description={tr("Published revisions remain immutable and are pinned to admissions.", "تظل المراجعات المنشورة ثابتة ومرتبطة بطلبات القبول.")} closeLabel={tr("Close", "إغلاق")} dir={direction}>{selected && Object.entries(selected).filter(([, value]) => typeof value !== "object").map(([key, value]) => <div className="x14-detail-row" key={key}><span>{key}</span><bdi>{text(value)}</bdi></div>)}</Inspector>
  </section>;
}
