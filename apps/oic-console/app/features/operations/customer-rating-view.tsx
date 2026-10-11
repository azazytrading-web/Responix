"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Locale, View } from "../../i18n";
import { ErrorState, LoadingState } from "../../components/oic-primitives";
import { ActionButton, DiscreteStepSelector, Inspector, TextInput } from "../../components/interface";

type Row = Record<string, unknown>;
type Dataset = { priceBooks: Row[]; rated: Row[]; fxEvidence: Row[] };
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
const page = (value: unknown): Row[] => list(record(value).items);
const text = (value: unknown, fallback = "—") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
const dateInput = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const toIso = (value: string) => new Date(value).toISOString();

export function CustomerRatingView({ view, locale }: { view: View; locale: Locale }) {
  const ar = locale === "ar";
  const direction = ar ? "rtl" : "ltr";
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const [data, setData] = useState<Dataset>({ priceBooks: [], rated: [], fxEvidence: [] });
  const [state, setState] = useState<"idle" | "loading" | "available" | "failed">("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [planRevisionId, setPlanRevisionId] = useState("");
  const [priceBookKey, setPriceBookKey] = useState("");
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
  const [fxBase, setFxBase] = useState("USD");
  const [fxQuote, setFxQuote] = useState("EUR");
  const [fxRate, setFxRate] = useState("0.92");
  const [fxSource, setFxSource] = useState("");
  const [fxReference, setFxReference] = useState("");
  const [fxPolicy, setFxPolicy] = useState("manual-v1");
  const fixedEvent = ["REQUEST", "TASK", "FEATURE"].includes(strategy);
  const hasDimension = ["RESOURCE_RATE", "TIERED", "FIXED_PLUS_VARIABLE"].includes(strategy);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/console?view=rating", { cache: "no-store" });
      if (!response.ok) throw new Error("rating evidence unavailable");
      const body = record(await response.json());
      setData({ priceBooks: list(body.priceBooks), rated: page(body.rated), fxEvidence: list(body.fxEvidence) });
      setState("available");
    } catch {
      setData({ priceBooks: [], rated: [], fxEvidence: [] });
      setState("failed");
    }
  }, []);
  useEffect(() => { if (view === "rating") void load(); }, [view, load]);
  if (view !== "rating") return null;

  const command = async (action: string, payload: Row) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      if (!response.ok) throw new Error("rating command rejected");
      setMessage(tr("Evidence saved and audited.", "تم حفظ الدليل وتدقيقه."));
      await load();
    } catch {
      setMessage(tr("The command failed. Verify the scope, revision, and effective interval.", "فشل الأمر. تحقق من النطاق والمراجعة والفترة الفعالة."));
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
  return <section className="workspace-page economics-view" dir={direction}>
    <header className="lab-page-heading"><div><span className="eyebrow">OIC-6.4 / DARK CUSTOMER RATING</span><h1>{tr("Customer rating evidence", "أدلة تسعير استخدام العملاء")}</h1><p>{tr("Revision-pinned calculations and corrections, kept separate from provider expense, OIU, quota, and entitlement.", "حسابات وتصحيحات مثبتة بالمراجعة ومنفصلة عن تكلفة المزوّد ووحدات OIU والحصة والاستحقاق.")}</p></div><ActionButton variant="secondary" onPress={() => void load()}>{tr("Refresh", "تحديث")}</ActionButton></header>
    <div className="economics-disclaimer">{tr("DARK / READ-ONLY COMMERCIAL DECISION. This workspace records rating evidence only. It does not create invoices, taxes, payments, receivables, or external charges. Missing price or FX is never treated as zero or parity. FREE_PLAN and TRIAL_CREDIT are explicit policy reasons.", "وضع تجريبي مظلم / قرار تجاري للقراءة فقط. يسجل هذا المساحة أدلة التسعير فقط ولا ينشئ فواتير أو ضرائب أو مدفوعات أو مستحقات أو رسوماً خارجية. لا يُعامل السعر أو التحويل المفقود كصفر أو تعادل للعملة. ويظهر FREE_PLAN وTRIAL_CREDIT كسببين صريحين في السياسة.")}</div>
    {message && <p role="status" className="admission-feedback">{message}</p>}
    {state === "loading" && <LoadingState label={tr("Loading customer rating evidence", "جارٍ تحميل أدلة تسعير العملاء")} />}
    {state === "failed" && <ErrorState title={tr("Rating evidence unavailable", "أدلة التسعير غير متاحة")} description={tr("The scoped commercial evidence source could not be loaded.", "تعذر تحميل مصدر الأدلة التجارية المحدد بالنطاق.")} />}
    {state === "available" && <>
      <section className="economics-source-summary"><article className="metric-card"><p>{tr("Published customer books", "دفاتر العملاء المنشورة")}</p><strong>{publishedBooks}</strong><small>{tr("effective-dated revisions", "مراجعات مؤرخة النفاذ")}</small></article><article className="metric-card"><p>{tr("Rated evidence", "أدلة مسعّرة")}</p><strong>{ratedCount}</strong><small>{tr("no invoice claim", "لا تمثل فاتورة")}</small></article><article className="metric-card"><p>{tr("Not rated / partial", "غير مسعّر / جزئي")}</p><strong>{data.rated.filter((item) => item.status !== "RATED").length}</strong><small>{tr("unknown stays explicit", "يبقى المجهول ظاهراً")}</small></article><article className="metric-card"><p>{tr("FX evidence rows", "سجلات أدلة الصرف")}</p><strong>{data.fxEvidence.length}</strong><small>{tr("conversion only with evidence", "لا تحويل دون دليل")}</small></article></section>
      <section className="admission-forms">
        <form className="panel admission-form" onSubmit={draft}>
          {heading(tr("Draft a customer price revision", "إنشاء مسودة مراجعة سعر عميل"), tr("The calculation is dark and non-billable. Publishing pins a rule for later evidence only.", "الحساب مظلم وغير قابل للتحصيل. يثبت النشر قاعدة للأدلة اللاحقة فقط."))}
          <TextInput label={tr("Application ID", "معرّف التطبيق")} value={applicationId} onChange={setApplicationId} required dir="ltr" />
          <TextInput label={tr("Tenant ID (optional)", "معرّف المستأجر (اختياري)")} value={tenantId} onChange={setTenantId} dir="ltr" />
          <TextInput label={tr("Pinned plan revision ID", "معرّف مراجعة الخطة المثبتة")} value={planRevisionId} onChange={setPlanRevisionId} required dir="ltr" />
          <TextInput label={tr("Price book key", "مفتاح دفتر الأسعار")} value={priceBookKey} onChange={setPriceBookKey} required dir="ltr" maxLength={64} />
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
        <form className="panel admission-form" onSubmit={(event) => { event.preventDefault(); if (!/^[0-9a-f-]{36}$/i.test(usageEventId)) return; void command("rating.usage.rate", { usageEventId }); }}>
          {heading(tr("Rate a captured event", "تسعير حدث مسجل"), tr("Uses captured event time and its pinned admission plan. A missing qualified input remains NOT_RATED or PARTIAL.", "يستخدم وقت الحدث المسجل وخطة القبول المثبتة. يظل المدخل المؤهل المفقود غير مسعّر أو جزئياً."))}
          <TextInput label={tr("Usage event ID", "معرّف حدث الاستخدام")} value={usageEventId} onChange={setUsageEventId} required dir="ltr" />
          <ActionButton variant="secondary" type="submit" disabled={busy}>{tr("Record rating evidence", "تسجيل دليل التسعير")}</ActionButton>
          <TextInput label={tr("Credit amount", "مبلغ الرصيد الدائن")} value={adjustmentAmount} onChange={setAdjustmentAmount} dir="ltr" />
          <TextInput label={tr("Credit reason", "سبب الرصيد الدائن")} value={adjustmentReason} onChange={setAdjustmentReason} maxLength={256} />
          <TextInput label={tr("Rated event ID", "معرّف الحدث المسعّر")} value={ratedEventId} onChange={setRatedEventId} dir="ltr" />
          <TextInput label={tr("Adjustment idempotency key", "مفتاح تكرار التصحيح الآمن")} value={adjustmentKey} onChange={setAdjustmentKey} dir="ltr" maxLength={128} />
          <ActionButton variant="secondary" disabled={busy || !ratedEventId || !adjustmentAmount || !adjustmentReason || !adjustmentKey} onPress={() => void command("rating.adjustment.create", { ratedUsageEventId: ratedEventId, sourceKey: adjustmentKey, kind: "CREDIT", amount: adjustmentAmount, reason: adjustmentReason })}>{tr("Record credit", "تسجيل رصيد دائن")}</ActionButton>
          <ActionButton variant="secondary" disabled={busy || !ratedEventId || !adjustmentReason || !adjustmentKey} onPress={() => void command("rating.adjustment.create", { ratedUsageEventId: ratedEventId, sourceKey: adjustmentKey, kind: "REVERSAL", reason: adjustmentReason })}>{tr("Reverse remaining amount", "عكس المبلغ المتبقي")}</ActionButton>
          <small>{tr("Credits and reversals append to an existing rated event; they never edit it.", "تُضاف الأرصدة الدائنة والإلغاءات إلى حدث مسعّر موجود ولا تعدّله.")}</small>
        </form>
      </section>
      <form className="panel admission-form" onSubmit={(event) => { event.preventDefault(); void command("rating.fx.create", { baseCurrency: fxBase.toUpperCase(), quoteCurrency: fxQuote.toUpperCase(), rate: fxRate, source: fxSource, sourceReference: fxReference, policyRevision: fxPolicy, effectiveAt: toIso(effectiveFrom) }); }}>
        {heading(tr("Record FX source evidence", "تسجيل دليل مصدر الصرف"), tr("FX is evidence only. Reporting conversion stays unavailable until an explicit matching rate is selected.", "الصرف دليل فقط. يظل التحويل في التقارير غير متاح حتى اختيار سعر مطابق صراحةً."))}
        <TextInput label={tr("Base currency", "العملة الأساسية")} value={fxBase} onChange={setFxBase} required maxLength={3} dir="ltr" />
        <TextInput label={tr("Quote currency", "العملة المقابلة")} value={fxQuote} onChange={setFxQuote} required maxLength={3} dir="ltr" />
        <TextInput label={tr("Rate", "السعر")} value={fxRate} onChange={setFxRate} required dir="ltr" />
        <TextInput label={tr("Source", "المصدر")} value={fxSource} onChange={setFxSource} required maxLength={128} />
        <TextInput label={tr("Source reference", "مرجع المصدر")} value={fxReference} onChange={setFxReference} required maxLength={256} dir="ltr" />
        <TextInput label={tr("FX policy revision", "مراجعة سياسة الصرف")} value={fxPolicy} onChange={setFxPolicy} required maxLength={64} dir="ltr" />
        <ActionButton variant="secondary" type="submit" disabled={busy}>{tr("Save FX evidence", "حفظ دليل الصرف")}</ActionButton>
      </form>
      <section className="panel economics-panel">{heading(tr("Rated usage events", "أحداث الاستخدام المسعّرة"), tr("Native-currency evidence with a separate correction chain. No invoice or payment state is implied.", "أدلة بالعملة الأصلية مع سلسلة تصحيح منفصلة. لا تعني وجود فاتورة أو حالة دفع."))}<div className="table-frame"><table><thead><tr><th>{tr("Status", "الحالة")}</th><th>{tr("Native amount", "المبلغ الأصلي")}</th><th>{tr("Currency", "العملة")}</th><th>{tr("Reason", "السبب")}</th><th>{tr("Plan revision", "مراجعة الخطة")}</th><th>{tr("Event", "الحدث")}</th></tr></thead><tbody>{data.rated.map((item) => <tr key={text(item.id)}><td>{text(item.status)}</td><td>{item.nativeAmount == null ? tr("Unknown", "غير معروف") : text(item.nativeAmount)}</td><td>{text(item.currency)}</td><td>{text(item.reasonCode)}</td><td>{text(item.planRevisionId)}</td><td><ActionButton variant="quiet" onPress={() => setSelected(item)}>{tr("Inspect", "فحص")} ↗</ActionButton></td></tr>)}{!data.rated.length && <tr><td colSpan={6}>{tr("No customer rating evidence has been recorded.", "لم يتم تسجيل أدلة تسعير للعملاء.")}</td></tr>}</tbody></table></div></section>
      <section className="panel economics-panel">{heading(tr("Customer price books", "دفاتر أسعار العملاء"), tr("Published policy remains immutable and interval-scoped.", "تبقى السياسة المنشورة ثابتة ومقيدة بفترة ونطاق."))}<div className="table-frame"><table><thead><tr><th>{tr("Book", "الدفتر")}</th><th>{tr("Strategy", "الاستراتيجية")}</th><th>{tr("Revision", "المراجعة")}</th><th>{tr("Currency", "العملة")}</th><th>{tr("Status", "الحالة")}</th><th>{tr("Action", "الإجراء")}</th></tr></thead><tbody>{data.priceBooks.map((item) => <tr key={text(item.id)}><td>{text(item.priceBookKey)}</td><td>{text(item.strategy)}</td><td>{text(item.revision)}</td><td>{text(item.currency)}</td><td>{text(item.status)}</td><td>{item.status === "DRAFT" ? <ActionButton variant="secondary" disabled={busy} onPress={() => void command("rating.price-book.publish", { id: item.id })}>{tr("Publish", "نشر")}</ActionButton> : <ActionButton variant="quiet" onPress={() => setSelected(item)}>{tr("Inspect", "فحص")}</ActionButton>}</td></tr>)}{!data.priceBooks.length && <tr><td colSpan={6}>{tr("No customer price books configured.", "لا توجد دفاتر أسعار عملاء مهيأة.")}</td></tr>}</tbody></table></div></section>
      <section className="panel economics-panel">{heading(tr("FX rate evidence", "أدلة أسعار الصرف"), tr("Evidence is recorded independently. No parity or conversion is inferred.", "يسجل الدليل بصورة مستقلة ولا يُفترض التعادل أو التحويل."))}<div className="table-frame"><table><thead><tr><th>{tr("Currency pair", "زوج العملات")}</th><th>{tr("Rate", "السعر")}</th><th>{tr("Effective", "تاريخ السريان")}</th><th>{tr("Source", "المصدر")}</th><th>{tr("Policy", "السياسة")}</th></tr></thead><tbody>{data.fxEvidence.map((item) => <tr key={text(item.id)}><td><bdi dir="ltr">{text(item.baseCurrency)} / {text(item.quoteCurrency)}</bdi></td><td>{text(item.rate)}</td><td>{text(item.effectiveAt)}</td><td>{text(item.source)}</td><td>{text(item.policyRevision)}</td></tr>)}{!data.fxEvidence.length && <tr><td colSpan={5}>{tr("No FX evidence. Cross-currency amounts remain UNKNOWN_CONVERSION.", "لا توجد أدلة صرف. تبقى المبالغ متعددة العملات غير معروفة التحويل.")}</td></tr>}</tbody></table></div></section>
    </>}
    <Inspector open={Boolean(selected)} onClose={() => setSelected(null)} title={tr("Rating evidence detail", "تفاصيل دليل التسعير")} description={tr("Immutable calculation evidence; no invoice or settlement authority.", "دليل حساب ثابت؛ لا يملك صلاحية إصدار فاتورة أو تسوية.")} closeLabel={tr("Close", "إغلاق")} dir={direction}>{selected && Object.entries(selected).filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value)).map(([key, value]) => <div className="x14-detail-row" key={key}><span>{key}</span><bdi dir="auto">{text(value, "null")}</bdi></div>)}{selected && Boolean(selected.ratingTrace) && <pre className="economics-trace"><code>{JSON.stringify(selected.ratingTrace, null, 2)}</code></pre>}</Inspector>
  </section>;
}
