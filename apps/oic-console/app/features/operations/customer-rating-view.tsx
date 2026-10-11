"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Locale, View } from "../../i18n";
import { ErrorState, LoadingState } from "../../components/oic-primitives";
import { ActionButton, ApplicationPicker, DiscreteStepSelector, EntityPicker, Inspector, RevisionPicker, SearchableSelect, TenantPicker, TextInput, Timeline, ToggleControl } from "../../components/interface";
import { EconomicFlowStrip } from "./economic-flow-strip";

type Row = Record<string, unknown>;
type Dataset = { priceBooks: Row[]; rated: Row[]; fxEvidence: Row[]; usageEvents: Row[]; plans: Row[]; applications: Row[]; tenants: Row[] };
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
const page = (value: unknown): Row[] => list(record(value).items);
const text = (value: unknown, fallback = "—") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
const dateInput = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const toIso = (value: string) => new Date(value).toISOString();

export function CustomerRatingView({ view, locale, navigate }: { view: View; locale: Locale; navigate: (view: View) => void }) {
  const ar = locale === "ar";
  const direction = ar ? "rtl" : "ltr";
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const [data, setData] = useState<Dataset>({ priceBooks: [], rated: [], fxEvidence: [], usageEvents: [], plans: [], applications: [], tenants: [] });
  const [state, setState] = useState<"idle" | "loading" | "available" | "failed">("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [planRevisionId, setPlanRevisionId] = useState("");
  const [priceBookKey, setPriceBookKey] = useState("");
  const [selectedBookId, setSelectedBookId] = useState("");
  const [strategy, setStrategy] = useState("OIU_RATE");
  const [currency, setCurrency] = useState("USD");
  const [sourceReference, setSourceReference] = useState("");
  const [dimension, setDimension] = useState("inputTokens");
  const [unit, setUnit] = useState("TOKENS");
  const [price, setPrice] = useState("0.000001");
  const [fixedAmount, setFixedAmount] = useState("0.01");
  const [includedQuantity, setIncludedQuantity] = useState("100");
  const [quantityDivisor, setQuantityDivisor] = useState("1");
  const [tierBands, setTierBands] = useState('[{"upTo":"1000","pricePerUnit":"0.000001"},{"upTo":null,"pricePerUnit":"0.0000008"}]');
  const [effectiveFrom, setEffectiveFrom] = useState(dateInput);
  const [usageEventId, setUsageEventId] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [ratedEventId, setRatedEventId] = useState("");
  const [adjustmentKey, setAdjustmentKey] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [showAdvancedIds, setShowAdvancedIds] = useState(false);
  const [fxBase, setFxBase] = useState("USD");
  const [fxQuote, setFxQuote] = useState("EUR");
  const [fxRate, setFxRate] = useState("0.92");
  const [fxSource, setFxSource] = useState("");
  const [fxReference, setFxReference] = useState("");
  const [fxPolicy, setFxPolicy] = useState("manual-v1");
  const [fxEffectiveAt, setFxEffectiveAt] = useState(dateInput);
  const [selectedFxId, setSelectedFxId] = useState("");
  const [activeSurface, setActiveSurface] = useState("price-policy");
  const [activeHistory, setActiveHistory] = useState("rated");
  const fixedEvent = ["REQUEST", "TASK", "FEATURE"].includes(strategy);
  const hasDimension = ["RESOURCE_RATE", "TIERED", "FIXED_PLUS_VARIABLE"].includes(strategy);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [response, usageResponse, admissionResponse, snapshotResponse] = await Promise.all([
        fetch("/api/console?view=rating", { cache: "no-store" }),
        fetch("/api/console?view=usage-events&limit=100", { cache: "no-store" }).catch(() => null),
        fetch("/api/console?view=admission", { cache: "no-store" }).catch(() => null),
        fetch("/api/console?view=snapshot", { cache: "no-store" }).catch(() => null)
      ]);
      if (!response.ok) throw new Error("rating evidence unavailable");
      const body = record(await response.json());
      const readOptional = async (source: Response | null): Promise<unknown> => source?.ok ? await source.json() as unknown : null;
      const [usageBody, admissionBody, snapshotBody] = await Promise.all([readOptional(usageResponse), readOptional(admissionResponse), readOptional(snapshotResponse)]);
      const nextData = { priceBooks: list(body.priceBooks), rated: page(body.rated), fxEvidence: list(body.fxEvidence), usageEvents: page(usageBody), plans: list(record(admissionBody).plans), applications: list(record(snapshotBody).applications), tenants: list(record(snapshotBody).tenants) };
      setData(nextData);
      setState("available");
      return nextData;
    } catch {
      const empty: Dataset = { priceBooks: [], rated: [], fxEvidence: [], usageEvents: [], plans: [], applications: [], tenants: [] };
      setData(empty);
      setState("failed");
      return null;
    }
  }, []);
  useEffect(() => { if (view === "rating") void load(); }, [view, load]);
  useEffect(() => {
    if (view !== "rating" || typeof window === "undefined") return;
    const entityId = new URLSearchParams(window.location.search).get("entity");
    if (entityId && data.usageEvents.some((item) => item.id === entityId)) setUsageEventId(entityId);
  }, [view, data.usageEvents]);
  if (view !== "rating") return null;

  const command = async (action: string, payload: Row) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const result = record(await response.json().catch(() => null));
      if (!response.ok) {
        setMessage(response.status === 409 ? tr("Revision or evidence conflict. No existing record was overwritten; refresh and inspect before retrying.", "تعارض في المراجعة أو الدليل. لم يُستبدل أي سجل؛ حدّث البيانات وافحصها قبل إعادة المحاولة.") : response.status === 403 ? tr("This operation is not available to the current operator scope.", "هذه العملية غير متاحة لنطاق المشغّل الحالي.") : tr("The command was rejected. Verify scope, policy revision and required evidence.", "رُفض الأمر. تحقق من النطاق ومراجعة السياسة والأدلة المطلوبة."));
        return;
      }
      setMessage(tr("Persisted. Reading the authoritative rating evidence…", "تم الحفظ. جارٍ قراءة دليل التسعير المعتمد…"));
      const readback = await load();
      const id = text(result.id, "");
      const found = !!id && !!readback && [
        ...readback.priceBooks, ...readback.rated, ...readback.fxEvidence,
        ...readback.rated.flatMap((item) => list(item.adjustments))
      ].some((item) => item.id === id);
      setMessage(found ? tr("Persisted and verified by source readback.", "تم الحفظ والتحقق منه بقراءة المصدر.") : tr("The command was accepted, but source readback did not confirm the returned record. No verified state is claimed; refresh or inspect the source.", "قُبل الأمر لكن قراءة المصدر لم تؤكد السجل المعاد. لا ندّعي التحقق؛ حدّث البيانات أو افحص المصدر."));
      if (action === "rating.adjustment.create" && found) setAdjustmentKey("");
    } catch {
      setMessage(tr("The command failed before readback. Your inputs remain available; verify source, scope and revision before retrying.", "فشل الأمر قبل قراءة المصدر. بقيت المدخلات؛ تحقق من المصدر والنطاق والمراجعة قبل إعادة المحاولة."));
    } finally { setBusy(false); }
  };
  const draft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^[0-9a-f-]{36}$/i.test(applicationId) || !/^[0-9a-f-]{36}$/i.test(planRevisionId)) return;
    let tiers: Array<{ upTo: string | null; pricePerUnit: string }> | undefined;
    if (strategy === "TIERED") {
      try {
        const parsed: unknown = JSON.parse(tierBands);
        if (!Array.isArray(parsed)) throw new Error("tiers must be an array");
        tiers = parsed as Array<{ upTo: string | null; pricePerUnit: string }>;
      } catch {
        setMessage(tr("Enter tier bands as valid JSON, ending with an unlimited band.", "أدخل شرائح التسعير بتنسيق JSON صحيح مع شريحة نهائية غير محددة."));
        return;
      }
    }
    const rule: Row = {
      ...(hasDimension ? { dimension, unit } : {}),
      ...(fixedEvent || strategy === "FIXED_PLUS_VARIABLE" ? { fixedAmount } : {}),
      ...(fixedEvent ? {} : strategy === "TIERED" ? { tiers } : { pricePerUnit: price }),
      ...(strategy === "INCLUDED_PLUS_OVERAGE" ? { includedQuantity } : {}),
      ...(hasDimension ? { quantityDivisor } : {})
    };
    const rules = [rule];
    void command("rating.price-book.draft", { applicationId, ...(tenantId ? { tenantId } : {}), planRevisionId, priceBookKey, strategy, currency, sourceReference, effectiveFrom: toIso(effectiveFrom), rules });
  };
  const heading = (title: string, description: string) => <header className="panel-heading"><div><span className="eyebrow">OIC-6.4 / COMMERCIAL EVIDENCE</span><h2>{title}</h2><p>{description}</p></div></header>;
  const publishedBooks = data.priceBooks.filter((item) => item.status === "PUBLISHED").length;
  const ratedCount = data.rated.filter((item) => item.status === "RATED").length;
  const appOptions = data.applications.filter((item) => typeof item.id === "string").map((item) => ({ id: text(item.id, ""), label: text(item.displayName, text(item.key, tr("Application", "التطبيق"))), secondary: text(item.key, ""), type: tr("Application", "التطبيق") }));
  const tenantOptions = data.tenants.filter((item) => typeof item.id === "string" && (!applicationId || item.applicationId === applicationId)).map((item) => ({ id: text(item.id, ""), label: text(item.displayName, text(item.key, tr("Tenant", "المستأجر"))), secondary: text(item.key, ""), type: tr("Tenant", "المستأجر") }));
  const planOptions = data.plans.flatMap((plan) => list(plan.revisions).map((revision) => ({ id: text(revision.id, ""), label: `${text(plan.displayName, text(plan.planKey))} · r${text(revision.revision)}`, secondary: text(revision.status), type: tr("Plan revision", "مراجعة الخطة") })));
  const usageOptions = data.usageEvents.filter((item) => typeof item.id === "string").map((item) => ({ id: text(item.id, ""), label: `${text(item.occurredAt, text(item.recordedAt))} · ${text(record(item.providerAttempt).providerKey, tr("Provider usage", "استخدام المزوّد"))}`, secondary: text(item.status, ""), scope: text(item.tenantId, text(item.applicationId, "")), type: tr("Captured usage event", "حدث استخدام مسجل") }));
  const bookOptions = data.priceBooks.filter((item) => typeof item.priceBookKey === "string").map((item) => ({ id: text(item.id, ""), label: `${text(item.priceBookKey)} · r${text(item.revision)}`, secondary: `${text(item.strategy)} · ${text(item.status)}`, type: tr("Customer price book", "دفتر أسعار العميل") }));
  const ratedOptions = data.rated.filter((item) => typeof item.id === "string").map((item) => ({ id: text(item.id, ""), label: `${text(item.status)} · ${text(item.nativeAmount, tr("amount unknown", "المبلغ غير معروف"))} ${text(item.currency, "")}`, secondary: `${text(item.reasonCode, "")} · ${text(item.recordedAt, "")}`, type: tr("Rated usage evidence", "دليل استخدام مسعّر") }));
  const fxOptions = data.fxEvidence.filter((item) => typeof item.id === "string").map((item) => ({ id: text(item.id, ""), label: `${text(item.baseCurrency)} / ${text(item.quoteCurrency)} · ${text(item.rate)}`, secondary: `${text(item.source)} · ${text(item.effectiveAt)}`, type: tr("FX source evidence", "دليل مصدر صرف") }));
  const selectedUsage = data.usageEvents.find((item) => item.id === usageEventId);
  const selectedRating = data.rated.find((item) => item.usageEventId === usageEventId);
  const selectedFx = data.fxEvidence.find((item) => item.id === selectedFxId);
  const recordAdjustment = (kind: "CREDIT" | "REVERSAL") => {
    const sourceKey = adjustmentKey || globalThis.crypto.randomUUID();
    setAdjustmentKey(sourceKey);
    void command("rating.adjustment.create", { ratedUsageEventId: ratedEventId, sourceKey, kind, ...(kind === "CREDIT" ? { amount: adjustmentAmount } : {}), reason: adjustmentReason });
  };
  return <section className="workspace-page economics-view customer-rating-view" data-rating-surface={activeSurface} dir={direction}>
    <header className="lab-page-heading"><div><span className="eyebrow">OIC-6.4 / DARK CUSTOMER RATING</span><h1>{tr("Customer Rating Studio", "استوديو تسعير العميل")}</h1><p>{tr("Inspect the source usage, pinned customer policy, rating result and append-only corrections. This is evidence, not billing.", "افحص استخدام المصدر وسياسة العميل المثبتة ونتيجة التسعير والتصحيحات الإلحاقية. هذه أدلة وليست فوترة.")}</p></div><ActionButton variant="secondary" onPress={() => void load()}>{tr("Refresh", "تحديث")}</ActionButton></header>
    <EconomicFlowStrip current="rating" locale={locale} navigate={navigate} states={{ usage: data.usageEvents.length ? "AVAILABLE" : "UNKNOWN", provider: "UNKNOWN", oiu: "UNKNOWN", admission: data.plans.length ? "AVAILABLE" : "UNKNOWN", rating: data.rated.length ? "AVAILABLE" : "UNKNOWN" }} />
    <div className="economics-disclaimer">{tr("RATING EVIDENCE ONLY · NO INVOICE · NO PAYMENT · NO RECEIVABLE · NO TAX CLAIM · NO EXTERNAL CHARGE. Missing price or FX is never treated as zero or parity.", "أدلة التسعير فقط · لا فاتورة · لا دفع · لا مستحقات · لا ادعاء ضريبي · لا رسوم خارجية. لا يُعامل السعر أو تحويل العملة المفقود كصفر أو تعادل.")}</div>
      <div className="rating-surface-selector"><DiscreteStepSelector label={tr("Workspace", "مساحة العمل")} value={activeSurface} onChange={setActiveSurface} options={[{ id: "price-policy", label: tr("Price policy", "سياسة الأسعار") }, { id: "fx-evidence", label: tr("FX evidence", "أدلة الصرف") }, { id: "corrections", label: tr("Corrections", "التصحيحات") }]} placeholder={tr("Choose workspace", "اختر مساحة العمل")} locale={locale} dir={direction} /></div>
    {message && <p role="status" className="admission-feedback">{message}</p>}
    {state === "loading" && <LoadingState label={tr("Loading customer rating evidence", "جارٍ تحميل أدلة تسعير العملاء")} />}
    {state === "failed" && <ErrorState title={tr("Rating evidence unavailable", "أدلة التسعير غير متاحة")} description={tr("The scoped commercial evidence source could not be loaded.", "تعذر تحميل مصدر الأدلة التجارية المحدد بالنطاق.")} />}
    {state === "available" && <>
      {!data.priceBooks.length && !data.rated.length && !data.fxEvidence.length && !data.usageEvents.length && !data.plans.length ? <section className="rating-empty-summary"><span className="eyebrow">{tr("RATING / DORMANT", "التسعير / خامل")}</span><strong>{tr("No usage, price revision, rating, or FX evidence is available.", "لا تتوفر أدلة استخدام أو مراجعة سعر أو تسعير أو صرف.")}</strong><p>{tr("Rating remains unassessed and non-billable. The workspace activates when captured usage and an applicable customer revision are available; FX is shown only when source evidence exists.", "يظل التسعير غير مُقيّم وغير قابل للتحصيل. ينشط المساحة عند توفر استخدام مسجل ومراجعة عميل منطبقة؛ ولا يُعرض الصرف إلا بوجود دليل مصدر.")}</p></section> : <section className="economics-source-summary"><article className="metric-card"><p>{tr("Published customer books", "دفاتر العملاء المنشورة")}</p><strong>{publishedBooks}</strong><small>{tr("effective-dated revisions", "مراجعات مؤرخة النفاذ")}</small></article><article className="metric-card"><p>{tr("Rated evidence", "أدلة مسعّرة")}</p><strong>{ratedCount}</strong><small>{tr("no invoice claim", "لا تمثل فاتورة")}</small></article><article className="metric-card"><p>{tr("Not rated / partial", "غير مسعّر / جزئي")}</p><strong>{data.rated.filter((item) => item.status !== "RATED").length}</strong><small>{tr("unknown stays explicit", "يبقى المجهول ظاهراً")}</small></article><article className="metric-card"><p>{tr("FX evidence rows", "سجلات أدلة الصرف")}</p><strong>{data.fxEvidence.length}</strong><small>{tr("conversion only with evidence", "لا تحويل دون دليل")}</small></article></section>}
      <section className="admission-forms rating-control-workspace" data-active-surface={activeSurface}>
        <aside className="rating-scope-panel"><span className="eyebrow">{tr("01 / CUSTOMER AND USAGE SCOPE", "01 / نطاق العميل والاستخدام")}</span><ApplicationPicker label={tr("Application", "التطبيق")} value={applicationId} onChange={(value) => { setApplicationId(value); setTenantId(""); }} options={appOptions} placeholder={tr("Select application", "اختر تطبيقاً")} searchLabel={tr("Search applications", "ابحث عن تطبيق")} emptyLabel={tr("No application records available", "لا تتوفر سجلات تطبيقات")} locale={locale} dir={direction} disabled={showAdvancedIds || !appOptions.length} /><TenantPicker label={tr("Tenant (optional)", "المستأجر (اختياري)")} value={tenantId} onChange={setTenantId} options={tenantOptions} placeholder={tr("Application scope", "نطاق التطبيق")} searchLabel={tr("Search tenants", "ابحث عن مستأجر")} emptyLabel={tr("No tenant records available", "لا تتوفر سجلات مستأجرين")} locale={locale} dir={direction} disabled={showAdvancedIds || !applicationId || !tenantOptions.length} /><EntityPicker label={tr("Captured usage event", "حدث الاستخدام المسجل")} value={usageEventId} onChange={setUsageEventId} options={usageOptions.filter((item) => { const row = data.usageEvents.find((event) => event.id === item.id); return (!applicationId || row?.applicationId === applicationId) && (!tenantId || row?.tenantId === tenantId); })} placeholder={tr("Select captured usage", "اختر استخداماً مسجلاً")} searchLabel={tr("Search usage evidence", "ابحث في أدلة الاستخدام")} emptyLabel={tr("No captured usage events in scope", "لا توجد أحداث استخدام مسجلة ضمن النطاق")} locale={locale} dir={direction} disabled={showAdvancedIds || !usageOptions.length} kind="usage-event" /><ToggleControl label={tr("Advanced identifiers", "المعرّفات المتقدمة")} value={showAdvancedIds} onChange={setShowAdvancedIds} dir={direction} help={tr("Manual identifiers are available only when a source picker cannot represent the record.", "تتوفر المعرّفات اليدوية فقط عندما يتعذر على محدد المصدر تمثيل السجل.")} /><div className="rating-scope-context"><span className="eyebrow">{tr("SOURCE EVIDENCE", "دليل المصدر")}</span><b>{selectedUsage ? `${text(selectedUsage.status)} · ${text(selectedUsage.providerKey, text(record(selectedUsage.providerAttempt).providerKey))}` : tr("No usage selected", "لم يُحدد استخدام")}</b><small>{selectedUsage ? `${text(selectedUsage.occurredAt, text(selectedUsage.recordedAt))} · ${Object.keys(record(selectedUsage.normalizedDimensions)).length} ${tr("normalized dimensions", "أبعاد موحدة")}` : tr("Scope and choose a captured event to inspect its rating dependency.", "حدد النطاق واختر حدثاً مسجلاً لفحص تبعية تسعيره.")}</small></div></aside>
        <form className="panel admission-form rating-price-policy" onSubmit={draft}>
          {heading(tr("Draft a customer price revision", "إنشاء مسودة مراجعة سعر عميل"), tr("The calculation is dark and non-billable. Publishing pins a rule for later evidence only.", "الحساب مظلم وغير قابل للتحصيل. يثبت النشر قاعدة للأدلة اللاحقة فقط."))}
          <RevisionPicker label={tr("Plan revision", "مراجعة الخطة")} value={planRevisionId} onChange={setPlanRevisionId} options={planOptions} placeholder={tr("Select pinned plan revision", "اختر مراجعة الخطة المثبتة")} searchLabel={tr("Search plan revisions", "ابحث عن مراجعة خطة")} emptyLabel={tr("No plan revisions available", "لا توجد مراجعات خطط متاحة")} locale={locale} dir={direction} disabled={showAdvancedIds || !planOptions.length} />
          <SearchableSelect label={tr("Price book source", "مصدر دفتر الأسعار")} value={selectedBookId} onChange={(value) => { const book = data.priceBooks.find((item) => item.id === value); if (!book) return; setSelectedBookId(value); setPriceBookKey(text(book.priceBookKey, "")); setStrategy(text(book.strategy, strategy)); setCurrency(text(book.currency, currency)); if (typeof book.applicationId === "string") setApplicationId(book.applicationId); if (typeof book.tenantId === "string") setTenantId(book.tenantId); const planRevision = record(book.planRevision); if (typeof planRevision.id === "string") setPlanRevisionId(planRevision.id); }} options={bookOptions} placeholder={tr("Choose a related book or configure a new key", "اختر دفتراً مرتبطاً أو أدخل مفتاحاً جديداً")} searchLabel={tr("Search price books", "ابحث في دفاتر الأسعار")} emptyLabel={tr("No customer price books available", "لا توجد دفاتر أسعار عملاء")} locale={locale} dir={direction} disabled={showAdvancedIds || !bookOptions.length} />
          {showAdvancedIds && <><TextInput label={tr("Application ID", "معرّف التطبيق")} value={applicationId} onChange={setApplicationId} required dir="ltr" /><TextInput label={tr("Tenant ID (optional)", "معرّف المستأجر (اختياري)")} value={tenantId} onChange={setTenantId} dir="ltr" /><TextInput label={tr("Pinned plan revision ID", "معرّف مراجعة الخطة المثبتة")} value={planRevisionId} onChange={setPlanRevisionId} required dir="ltr" /><TextInput label={tr("Price book key", "مفتاح دفتر الأسعار")} value={priceBookKey} onChange={setPriceBookKey} required dir="ltr" maxLength={64} /></>}
          <DiscreteStepSelector label={tr("Typed strategy", "استراتيجية محددة النوع")} value={strategy} onChange={setStrategy} options={["OIU_RATE", "RESOURCE_RATE", "REQUEST", "TASK", "FEATURE", "TIERED", "INCLUDED_PLUS_OVERAGE", "FIXED_PLUS_VARIABLE"].map((id) => ({ id, label: id }))} placeholder={tr("Choose a strategy", "اختر استراتيجية")} dir={direction} locale={locale} />
          <TextInput label={tr("Native currency", "العملة الأصلية")} value={currency} onChange={setCurrency} required maxLength={3} dir="ltr" />
          <TextInput label={tr("Source reference", "مرجع المصدر")} value={sourceReference} onChange={setSourceReference} required maxLength={256} dir="ltr" />
          {hasDimension && <><TextInput label={tr("Usage dimension", "بُعد الاستخدام")} value={dimension} onChange={setDimension} required dir="ltr" /><TextInput label={tr("Unit", "الوحدة")} value={unit} onChange={setUnit} required dir="ltr" /><TextInput label={tr("Quantity divisor", "مقسوم الكمية")} value={quantityDivisor} onChange={setQuantityDivisor} required dir="ltr" /></>}
          {fixedEvent && <TextInput label={tr("Qualified event amount", "مبلغ الحدث المؤهل")} value={fixedAmount} onChange={setFixedAmount} required dir="ltr" />}
          {!fixedEvent && strategy !== "TIERED" && <TextInput label={tr("Price per unit", "السعر لكل وحدة")} value={price} onChange={setPrice} required dir="ltr" />}
          {strategy === "FIXED_PLUS_VARIABLE" && <TextInput label={tr("Fixed event amount", "مبلغ الحدث الثابت")} value={fixedAmount} onChange={setFixedAmount} required dir="ltr" />}
          {strategy === "INCLUDED_PLUS_OVERAGE" && <TextInput label={tr("Included OIU allowance", "حصة OIU المشمولة")} value={includedQuantity} onChange={setIncludedQuantity} required dir="ltr" />}
          {strategy === "TIERED" && <TextInput label={tr("Tier bands (JSON; final upTo is null)", "شرائح التسعير (JSON؛ upTo للشريحة الأخيرة null)")} value={tierBands} onChange={setTierBands} required maxLength={4000} dir="ltr" />}
          <TextInput label={tr("Effective from", "ساري من")} value={effectiveFrom} onChange={setEffectiveFrom} type="datetime-local" required dir="ltr" />
          <ActionButton variant="primary" type="submit" disabled={busy}>{tr("Save draft", "حفظ المسودة")}</ActionButton>
        </form>
        <form className="panel admission-form rating-result-form" onSubmit={(event) => { event.preventDefault(); if (!/^[0-9a-f-]{36}$/i.test(usageEventId)) return; void command("rating.usage.rate", { usageEventId }); }}>
          {heading(tr("Rate a captured event", "تسعير حدث مسجل"), tr("Uses captured event time and its pinned admission plan. A missing qualified input remains NOT_RATED or PARTIAL.", "يستخدم وقت الحدث المسجل وخطة القبول المثبتة. يظل المدخل المؤهل المفقود غير مسعّر أو جزئياً."))}
          {showAdvancedIds && <TextInput label={tr("Usage event ID", "معرّف حدث الاستخدام")} value={usageEventId} onChange={setUsageEventId} required dir="ltr" />}
          {selectedUsage ? <div className="rating-evidence-preview"><span className="eyebrow">{tr("SELECTED SOURCE · RATING DEPENDENCIES", "المصدر المحدد · تبعيات التسعير")}</span><div className="rating-derivation-flow"><b>{tr("SOURCE USAGE", "استخدام المصدر")}<small>{text(selectedUsage.status)} · {text(selectedUsage.occurredAt, text(selectedUsage.recordedAt))}</small></b><span aria-hidden="true">→</span><b>{tr("PINNED PLAN", "الخطة المثبتة")}<small>{tr("Resolved by authoritative rating handler", "تحلها آلية التسعير المعتمدة")}</small></b><span aria-hidden="true">→</span><b>{tr("CUSTOMER POLICY", "سياسة العميل")}<small>{selectedRating ? `${text(record(selectedRating.priceBookRevision).priceBookKey)} · r${text(record(selectedRating.priceBookRevision).revision)}` : tr("Not evaluated yet", "لم تُقيّم بعد")}</small></b><span aria-hidden="true">→</span><b>{tr("RATED EVIDENCE", "دليل التسعير")}<small>{selectedRating ? `${text(selectedRating.status)} · ${text(selectedRating.nativeAmount, tr("unknown", "غير معروف"))} ${text(selectedRating.currency, "")}` : tr("NOT_RATED · no assessment returned", "غير مسعّر · لم يُعِد المحرك تقييماً")}</small></b></div><p>{selectedRating ? tr("This is an existing authoritative assessment. Inspect the rating trace for resolved rules and inputs.", "هذا تقييم معتمد موجود. افحص أثر التسعير لمعرفة القواعد والمدخلات المحلولة.") : tr("Selecting usage does not rate it. The source has not returned a derivation; record rating evidence to ask the authoritative handler. No amount or missing dependency is guessed here.", "اختيار الاستخدام لا يسعّره. لم يُعِد المصدر اشتقاقاً؛ سجّل دليل التسعير لسؤال المحرك المعتمد. لا يُخمن مبلغ أو تبعية مفقودة هنا.")}</p></div> : <div className="rating-evidence-preview"><span className="eyebrow">{tr("RATING PREVIEW", "معاينة التسعير")}</span><b>{tr("NOT_RATED", "غير مسعّر")}</b><p>{tr("Select a captured usage event. No event or amount is inferred from an empty selection.", "اختر حدث استخدام مسجلاً. لا يُستنتج حدث أو مبلغ من اختيار فارغ.")}</p></div>}
          <ActionButton variant="secondary" type="submit" disabled={busy || !usageEventId}>{tr("Record rating evidence", "تسجيل دليل التسعير")}</ActionButton>
          <div className="rating-correction-controls"><span className="eyebrow">{tr("APPEND-ONLY CORRECTION", "تصحيح إلحاقي")}</span><TextInput label={tr("Credit amount", "مبلغ الرصيد الدائن")} value={adjustmentAmount} onChange={setAdjustmentAmount} dir="ltr" />
          <TextInput label={tr("Credit reason", "سبب الرصيد الدائن")} value={adjustmentReason} onChange={setAdjustmentReason} maxLength={256} />
          <EntityPicker label={tr("Rated event to correct", "الحدث المسعّر المراد تصحيحه")} value={ratedEventId} onChange={setRatedEventId} options={ratedOptions} placeholder={tr("Select rated evidence", "اختر دليلاً مسعّراً")} searchLabel={tr("Search rated events", "ابحث عن أحداث مسعّرة")} emptyLabel={tr("No rated events available", "لا توجد أحداث مسعّرة")} locale={locale} dir={direction} kind="rated-event" />
          <ActionButton variant="secondary" disabled={busy || !ratedEventId || !adjustmentAmount || !adjustmentReason} onPress={() => recordAdjustment("CREDIT")}>{tr("Record credit", "تسجيل رصيد دائن")}</ActionButton>
          <ActionButton variant="secondary" disabled={busy || !ratedEventId || !adjustmentReason} onPress={() => recordAdjustment("REVERSAL")}>{tr("Reverse remaining amount", "عكس المبلغ المتبقي")}</ActionButton>
          <small>{tr("A source key is generated and retained for a retry; it is not operator data entry.", "يُنشأ مفتاح المصدر ويُحتفظ به عند إعادة المحاولة؛ لا يدخله المشغّل.")}</small>
          <small>{tr("Credits and reversals append to an existing rated event; they never edit it.", "تُضاف الأرصدة الدائنة والإلغاءات إلى حدث مسعّر موجود ولا تعدّله.")}</small></div>
        </form>
      </section>
      <section className="rating-fx-workflow"><div className="rating-fx-existing"><header className="panel-heading"><div><span className="eyebrow">{tr("EXISTING FX EVIDENCE", "أدلة الصرف الموجودة")}</span><h2>{tr("Selected pair and provenance", "الزوج المحدد ومصدره")}</h2><p>{tr("Recorded FX is evidence; it is not automatically applied as a conversion.", "سعر الصرف المسجل دليل، ولا يُطبق تلقائياً كتحويل.")}</p></div></header><SearchableSelect label={tr("FX evidence pair", "زوج دليل الصرف")} value={selectedFxId} onChange={setSelectedFxId} options={fxOptions} placeholder={tr("Choose recorded evidence", "اختر دليلاً مسجلاً")} searchLabel={tr("Search FX evidence", "ابحث في أدلة الصرف")} emptyLabel={tr("No FX evidence available", "لا توجد أدلة صرف")} locale={locale} dir={direction} />{selectedFx ? <div className="x14-detail-row"><span>{tr("Provenance / effective / status", "المصدر / السريان / الحالة")}</span><bdi dir="auto">{`${text(selectedFx.source)} · ${text(selectedFx.sourceReference)} · ${text(selectedFx.policyRevision)} · ${text(selectedFx.effectiveAt)} · RECORDED`}</bdi></div> : <p>{tr("No pair selected. Cross-currency results remain unavailable until matching evidence is explicitly resolved.", "لم يُحدد زوج. تظل النتائج متعددة العملات غير متاحة حتى اختيار دليل مطابق صراحةً.")}</p>}</div>
      <form className="panel admission-form rating-fx-add" onSubmit={(event) => { event.preventDefault(); void command("rating.fx.create", { baseCurrency: fxBase.toUpperCase(), quoteCurrency: fxQuote.toUpperCase(), rate: fxRate, source: fxSource, sourceReference: fxReference, policyRevision: fxPolicy, effectiveAt: toIso(fxEffectiveAt) }); }}>
        {heading(tr("Record FX source evidence", "تسجيل دليل مصدر الصرف"), tr("FX is evidence only. Reporting conversion stays unavailable until an explicit matching rate is selected.", "الصرف دليل فقط. يظل التحويل في التقارير غير متاح حتى اختيار سعر مطابق صراحةً."))}
        <TextInput label={tr("Base currency", "العملة الأساسية")} value={fxBase} onChange={setFxBase} required maxLength={3} dir="ltr" />
        <TextInput label={tr("Quote currency", "العملة المقابلة")} value={fxQuote} onChange={setFxQuote} required maxLength={3} dir="ltr" />
        <TextInput label={tr("Rate", "السعر")} value={fxRate} onChange={setFxRate} required dir="ltr" />
        <TextInput label={tr("Source", "المصدر")} value={fxSource} onChange={setFxSource} required maxLength={128} />
        <TextInput label={tr("Source reference", "مرجع المصدر")} value={fxReference} onChange={setFxReference} required maxLength={256} dir="ltr" />
        <TextInput label={tr("FX policy revision", "مراجعة سياسة الصرف")} value={fxPolicy} onChange={setFxPolicy} required maxLength={64} dir="ltr" />
        <TextInput label={tr("Effective time", "وقت السريان")} value={fxEffectiveAt} onChange={setFxEffectiveAt} type="datetime-local" required dir="ltr" />
        <ActionButton variant="secondary" type="submit" disabled={busy}>{tr("Save FX evidence", "حفظ دليل الصرف")}</ActionButton>
      </form></section>
      <div className="rating-history-heading"><span className="eyebrow">{tr("EVIDENCE HISTORY", "سجل الأدلة")}</span><DiscreteStepSelector label={tr("History surface", "قسم السجل")} value={activeHistory} onChange={setActiveHistory} options={[{ id: "rated", label: tr("Rated events", "الأحداث المسعّرة") }, { id: "books", label: tr("Price books", "دفاتر الأسعار") }, { id: "fx", label: tr("FX evidence", "أدلة الصرف") }]} placeholder={tr("Choose history", "اختر السجل")} locale={locale} dir={direction} /></div>
      <div className="rating-source-records" data-active-history={activeHistory} aria-label={tr("Rating evidence and policy sources", "أدلة التسعير ومصادر السياسة")}>
      <section className="panel economics-panel">{heading(tr("Rated usage events", "أحداث الاستخدام المسعّرة"), tr("Native-currency evidence with a separate correction chain. No invoice or payment state is implied.", "أدلة بالعملة الأصلية مع سلسلة تصحيح منفصلة. لا تعني وجود فاتورة أو حالة دفع."))}<div className="table-frame"><table><thead><tr><th>{tr("Status", "الحالة")}</th><th>{tr("Native amount", "المبلغ الأصلي")}</th><th>{tr("Currency", "العملة")}</th><th>{tr("Reason", "السبب")}</th><th>{tr("Plan", "الخطة")}</th><th>{tr("Event", "الحدث")}</th></tr></thead><tbody>{data.rated.map((item) => <tr key={text(item.id)}><td>{text(item.status)}</td><td>{item.nativeAmount == null ? tr("Unknown", "غير معروف") : text(item.nativeAmount)}</td><td>{text(item.currency)}</td><td>{text(item.reasonCode)}</td><td>{text(record(record(item.planRevision).plan).planKey, tr("Pinned revision", "مراجعة مثبتة"))} · r{text(record(item.planRevision).revision)}</td><td><ActionButton variant="quiet" onPress={() => setSelected(item)}>{tr("Inspect", "فحص")} ↗</ActionButton></td></tr>)}{!data.rated.length && <tr><td colSpan={6}>{tr("No customer rating evidence has been recorded.", "لم يتم تسجيل أدلة تسعير للعملاء.")}</td></tr>}</tbody></table></div></section>
      <section className="panel economics-panel">{heading(tr("Customer price books", "دفاتر أسعار العملاء"), tr("Published policy remains immutable and interval-scoped.", "تبقى السياسة المنشورة ثابتة ومقيدة بفترة ونطاق."))}<div className="table-frame"><table><thead><tr><th>{tr("Book", "الدفتر")}</th><th>{tr("Strategy", "الاستراتيجية")}</th><th>{tr("Revision", "المراجعة")}</th><th>{tr("Currency", "العملة")}</th><th>{tr("Status", "الحالة")}</th><th>{tr("Action", "الإجراء")}</th></tr></thead><tbody>{data.priceBooks.map((item) => <tr key={text(item.id)}><td>{text(item.priceBookKey)}</td><td>{text(item.strategy)}</td><td>{text(item.revision)}</td><td>{text(item.currency)}</td><td>{text(item.status)}</td><td>{item.status === "DRAFT" ? <ActionButton variant="secondary" disabled={busy} onPress={() => void command("rating.price-book.publish", { id: item.id })}>{tr("Publish", "نشر")}</ActionButton> : <ActionButton variant="quiet" onPress={() => setSelected(item)}>{tr("Inspect", "فحص")}</ActionButton>}</td></tr>)}{!data.priceBooks.length && <tr><td colSpan={6}>{tr("No customer price books configured.", "لا توجد دفاتر أسعار عملاء مهيأة.")}</td></tr>}</tbody></table></div></section>
      <section className="panel economics-panel">{heading(tr("FX rate evidence", "أدلة أسعار الصرف"), tr("Evidence is recorded independently. No parity or conversion is inferred.", "يسجل الدليل بصورة مستقلة ولا يُفترض التعادل أو التحويل."))}<div className="table-frame"><table><thead><tr><th>{tr("Currency pair", "زوج العملات")}</th><th>{tr("Rate", "السعر")}</th><th>{tr("Effective", "تاريخ السريان")}</th><th>{tr("Source", "المصدر")}</th><th>{tr("Policy", "السياسة")}</th></tr></thead><tbody>{data.fxEvidence.map((item) => <tr key={text(item.id)}><td><bdi dir="ltr">{text(item.baseCurrency)} / {text(item.quoteCurrency)}</bdi></td><td>{text(item.rate)}</td><td>{text(item.effectiveAt)}</td><td>{text(item.source)}</td><td>{text(item.policyRevision)}</td></tr>)}{!data.fxEvidence.length && <tr><td colSpan={5}>{tr("No FX evidence. Cross-currency amounts remain UNKNOWN_CONVERSION.", "لا توجد أدلة صرف. تبقى المبالغ متعددة العملات غير معروفة التحويل.")}</td></tr>}</tbody></table></div></section>
      </div>
    </>}
    <Inspector open={Boolean(selected)} onClose={() => setSelected(null)} title={tr("Rating evidence detail", "تفاصيل دليل التسعير")} description={tr("Immutable calculation evidence; no invoice or settlement authority.", "دليل حساب ثابت؛ لا يملك صلاحية إصدار فاتورة أو تسوية.")} closeLabel={tr("Close", "إغلاق")} dir={direction}>{selected && Object.entries(selected).filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value)).map(([key, value]) => <div className="x14-detail-row" key={key}><span>{key}</span><bdi dir="auto">{text(value, "null")}</bdi></div>)}{selected && Boolean(selected.ratingTrace) && <pre className="economics-trace"><code>{JSON.stringify(selected.ratingTrace, null, 2)}</code></pre>}{selected && list(selected.adjustments).length > 0 && <Timeline label={tr("Append-only adjustment history", "سجل التصحيحات الإلحاقي")} events={list(selected.adjustments).map((adjustment, index) => ({ id: text(adjustment.id, String(index)), title: text(adjustment.kind, tr("Adjustment", "تصحيح")), detail: [text(adjustment.amount), text(adjustment.currency), text(adjustment.reason)].filter((value) => value !== "—").join(" · "), time: text(adjustment.recordedAt), tone: "warning" as const }))} />}</Inspector>
  </section>;
}
