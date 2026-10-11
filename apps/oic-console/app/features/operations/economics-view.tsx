"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale, View } from "../../i18n";
import { ErrorState, LoadingState } from "../../components/oic-primitives";
import { ActionButton, CompareSurface, DiscreteStepSelector, Inspector, RevisionPicker } from "../../components/interface";
import { NumericInstrument } from "../../components/instruments";
import { EconomicFlowStrip } from "./economic-flow-strip";

type Row = Record<string, unknown>;
type Dataset = { costs: Row[]; oiu: Row[]; rateBooks: Row[]; policies: Row[] };
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const pageRows = (value: unknown): Row[] => {
  const candidate = record(value).items;
  return Array.isArray(candidate) ? candidate.map(record) : [];
};
const listRows = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
const valueText = (value: unknown, fallback = "—") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;

export function EconomicsView({ view, locale, navigate }: { view: View; locale: Locale; navigate: (view: View) => void }) {
  const [data, setData] = useState<Dataset>({ costs: [], oiu: [], rateBooks: [], policies: [] });
  const [state, setState] = useState<"idle" | "loading" | "available" | "failed">("idle");
  const [selected, setSelected] = useState<Row | null>(null);
  const [compareKind, setCompareKind] = useState("rate-book");
  const [compareLeftId, setCompareLeftId] = useState("");
  const [compareRightId, setCompareRightId] = useState("");
  const ar = locale === "ar";
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/console?view=economics", { cache: "no-store" });
      if (!response.ok) throw new Error("economics unavailable");
      const body: unknown = await response.json();
      const root = record(body);
      setData({ costs: pageRows(root.costs), oiu: pageRows(root.oiu), rateBooks: listRows(root.rateBooks), policies: listRows(root.policies) });
      setState("available");
    } catch {
      setData({ costs: [], oiu: [], rateBooks: [], policies: [] });
      setState("failed");
    }
  }, []);
  useEffect(() => { if (view === "economics") void load(); }, [view, load]);
  useEffect(() => {
    if (view !== "economics" || typeof window === "undefined") return;
    const entityId = new URLSearchParams(window.location.search).get("entity");
    if (!entityId) return;
    const candidates: Row[] = [...data.costs.map((item) => ({ ...item, _kind: "cost" })), ...data.oiu.map((item) => ({ ...item, _kind: "oiu" }))];
    const assessment = candidates
      .find((item) => item.usageEventId === entityId);
    if (assessment) setSelected(assessment);
  }, [view, data]);
  if (view !== "economics") return null;

  const panel = (title: string, subtitle: string, items: Row[], kind: "cost" | "oiu") => <section className="panel economics-panel" key={kind}>
    <header className="panel-heading"><div><span className="eyebrow">{kind === "cost" ? "PROVIDER EXPENSE / PINNED RATE" : "INTERNAL UNIT / PINNED POLICY"}</span><h2>{title}</h2><p>{subtitle}</p></div><span className="eyebrow">{items.length} {tr("assessments", "تقييمات")}</span></header>
    <div className="table-frame"><table><thead><tr><th>{tr("Status", "الحالة")}</th><th>{tr("Amount", "المقدار")}</th><th>{tr("Provider model", "نموذج المزوّد")}</th><th>{tr("Revision", "المراجعة")}</th><th>{tr("Evidence", "الدليل")}</th></tr></thead><tbody>
      {items.map((item) => {
        const event = record(item.usageEvent);
        const providerAttempt = record(event.providerAttempt);
        const revision = record(kind === "cost" ? item.rateBookRevision : item.policyRevision);
        const amount = kind === "cost" ? item.nativeAmount : item.oiu;
        const unit = kind === "cost" ? item.currency : "OIU";
        return <tr key={valueText(item.id)}><td>{valueText(item.status)}</td><td>{amount == null ? tr("Unknown", "غير معروف") : `${valueText(amount)} ${valueText(unit)}`}</td><td>{valueText(providerAttempt.upstreamModelId)}</td><td>{valueText(revision.revision)}</td><td><ActionButton variant="quiet" onPress={() => setSelected({ ...item, _kind: kind })}>{tr("Inspect", "فحص")} ↗</ActionButton></td></tr>;
      })}
      {!items.length && <tr><td colSpan={5}>{tr("No assessments have been produced. Rates and policies are never inferred from catalog metadata.", "لم تُنتج تقييمات بعد. لا تُستنتج الأسعار أو السياسات من بيانات الفهرس.")}</td></tr>}
    </tbody></table></div>
  </section>;

  const selectedIsOiu = selected?._kind === "oiu";
  const selectedSource = selected?._kind === "rate-book" || selected?._kind === "policy";
  const selectedSourceRows = Array.isArray(selected?.rates) ? selected.rates : Array.isArray(selected?.dimensions) ? selected.dimensions : [];
  const selectedUsage = record(selected?.usageEvent);
  const selectedAttempt = record(selectedUsage.providerAttempt);
  const selectedRevision = record(selectedIsOiu ? selected?.policyRevision : selected?.rateBookRevision);
  const selectedDimensionLines = listRows(selected?.dimensionLines ?? selected?.inputs);
  const compareRows = compareKind === "rate-book" ? data.rateBooks : data.policies;
  const compareOptions = compareRows.filter((item) => typeof item.id === "string").map((item) => ({ id: valueText(item.id, ""), label: valueText(compareKind === "rate-book" ? item.rateBookKey : item.policyKey) + " · r" + valueText(item.revision), secondary: valueText(item.status), scope: valueText(item.effectiveFrom) }));
  const compareLeft = compareRows.find((item) => item.id === compareLeftId);
  const compareRight = compareRows.find((item) => item.id === compareRightId);
  const details = selected ? Object.entries({
    [tr("Status", "الحالة")]: selected.status,
    [tr("Source", "المصدر")]: selected._kind === "rate-book" ? tr("Provider rate book", "دفتر أسعار المزوّد") : selected._kind === "policy" ? tr("OIU policy revision", "مراجعة سياسة OIU") : undefined,
    [tr("Policy / book key", "مفتاح السياسة / الدفتر")]: selected.policyKey ?? selected.rateBookKey,
    [tr("Effective interval", "فترة السريان")]: [selected.effectiveFrom, selected.effectiveTo].filter(Boolean).join(" → "),
    [tr("Usage event", "حدث الاستخدام")]: selected.usageEventId,
    [tr("Source provider / model", "المزوّد / النموذج المصدر")]: [selectedUsage.providerKey ?? selectedAttempt.providerKey, selectedAttempt.upstreamModelId].filter(Boolean).join(" / "),
    [tr("Source occurrence time", "وقت حدوث المصدر")]: selectedUsage.occurredAt,
    [tr("Pinned revision / effective interval", "المراجعة المثبتة / فترة السريان")]: `${valueText(selectedRevision.revision)} · ${[selectedRevision.effectiveFrom, selectedRevision.effectiveTo].filter(Boolean).map((value) => valueText(value)).join(" → ")}`,
    [tr("Evidence classification", "تصنيف الدليل")]: selected.evidenceClass ?? selected.status,
    [tr("Rounding", "التقريب")]: selectedIsOiu ? tr("HALF_EVEN · policy minimum increment", "تقريب HALF_EVEN · الحد الأدنى وفق السياسة") : tr("Provider amount precision retained; no extra conversion", "حُفظت دقة مبلغ المزوّد؛ دون تحويل إضافي"),
    [tr("Native provider amount", "مبلغ المزوّد بالعملة الأصلية")]: selected.nativeAmount == null ? tr("Unknown", "غير معروف") : `${valueText(selected.nativeAmount)} ${valueText(selected.currency)}`,
    [tr("OIU amount", "مقدار OIU")]: selected.oiu == null ? tr("Unknown", "غير معروف") : valueText(selected.oiu),
    [tr("Rate book", "دفتر الأسعار")]: record(selected.rateBookRevision).sourceDigest,
    [tr("OIU policy", "سياسة OIU")]: record(selected.policyRevision).sourceDigest,
    [tr("Dimension details", "تفاصيل الأبعاد")]: JSON.stringify(selected.dimensionLines ?? selected.inputs ?? {}),
    [tr("Source digest", "بصمة المصدر")]: selected.sourceDigest,
    [tr("Assessment key", "مفتاح التقييم")]: selected.assessmentKey,
    [tr("Recorded at", "وقت التسجيل")]: selected.recordedAt
  }).filter(([, item]) => item !== undefined) : [];

  return <section className="workspace-page economics-view" dir={ar ? "rtl" : "ltr"}>
    <header className="lab-page-heading"><div><span className="eyebrow">OIC-6.2 / ECONOMICS OBSERVATORY</span><h1>{tr("Economics Observatory", "مرصد الاقتصاديات")}</h1><p>{tr("Inspect provider expense and OIU as separate revision-pinned evidence layers. No customer rating or invoice is represented here; quota remains governed elsewhere.", "افحص نفقات المزوّد ووحدات OIU كطبقتي أدلة منفصلتين ومثبتتين بالمراجعة. لا يعرض هذا المساحة تسعير العميل أو الفواتير؛ وتظل الحصص في مساحة أخرى.")}</p></div><ActionButton variant="secondary" onPress={() => void load()}>{tr("Refresh", "تحديث")}</ActionButton></header>
    <EconomicFlowStrip current="provider" locale={locale} navigate={navigate} states={{ usage: "UNKNOWN", provider: data.costs.length ? "AVAILABLE" : "UNKNOWN", oiu: data.oiu.length ? "AVAILABLE" : "UNKNOWN", admission: "UNKNOWN", rating: "UNKNOWN" }} />
    <div className="economics-disclaimer">{tr("A missing rate, dimension, or conversion remains UNKNOWN or PARTIAL. It is never zero by default.", "يظل السعر أو البُعد أو التحويل المفقود UNKNOWN أو PARTIAL، ولا يُعامل على أنه صفر افتراضيًا.")}</div>
    {state === "loading" && <LoadingState label={tr("Loading economics evidence", "جارٍ تحميل الأدلة الاقتصادية")} />}
    {state === "failed" && <ErrorState title={tr("Economics evidence unavailable", "الأدلة الاقتصادية غير متاحة")} description={tr("The read-only economics source could not be loaded.", "تعذّر تحميل مصدر الأدلة الاقتصادية المخصص للقراءة فقط.")} />}
    {state === "available" && <>
      {!data.costs.length && !data.oiu.length && !data.rateBooks.length && !data.policies.length ? <section className="economics-empty-summary" aria-label={tr("Economics source state", "حالة مصدر الاقتصاديات")}><span className="eyebrow">{tr("ECONOMICS / DORMANT", "الاقتصاديات / خاملة")}</span><strong>{tr("No assessment or published revision evidence is available.", "لا تتوفر أدلة تقييم أو مراجعة منشورة.")}</strong><p>{tr("Provider expense and internal OIU remain separate and unassessed. This workspace activates when captured usage and an applicable published revision are available.", "تظل نفقات المزوّد ووحدات OIU الداخلية منفصلة وغير مُقيّمة. ينشط هذا المساحة عند توفر استخدام مسجل ومراجعة منشورة منطبقة.")}</p></section> : <section className="economics-source-summary economics-instrument-rack" aria-label={tr("Source-backed economics state", "حالة الاقتصاد الموثقة بالمصدر")}>
        <NumericInstrument label={tr("Published rate books", "دفاتر الأسعار المنشورة")} value={data.rateBooks.filter((item) => item.status === "PUBLISHED").length} state="LIVE" stateLabel={tr("SOURCE", "مصدر")} source={tr("OIC source records", "سجلات مصدر OIC")} size="SM" />
        <NumericInstrument label={tr("Published OIU policies", "سياسات OIU المنشورة")} value={data.policies.filter((item) => item.status === "PUBLISHED").length} state="LIVE" stateLabel={tr("SOURCE", "مصدر")} source={tr("revisioned rules", "قواعد ذات مراجعات")} size="SM" />
        <NumericInstrument label={tr("Known expense assessments", "تقييمات النفقات المعروفة")} value={data.costs.filter((item) => item.status === "ASSESSED" || item.nativeAmount != null).length} state="LIVE" stateLabel={tr("RECORDED", "مسجل")} unit={tr("records", "سجلات")} size="SM" />
        <NumericInstrument label={tr("Unknown expense", "نفقات غير معروفة")} value={data.costs.filter((item) => item.status === "UNKNOWN").length} state={data.costs.some((item) => item.status === "UNKNOWN") ? "DEGRADED" : "LIVE"} stateLabel={tr("SOURCE STATUS", "حالة المصدر")} unit={tr("records", "سجلات")} size="SM" />
        <NumericInstrument label={tr("Known OIU assessments", "تقييمات OIU المعروفة")} value={data.oiu.filter((item) => item.oiu != null).length} state="LIVE" stateLabel={tr("RECORDED", "مسجل")} unit={tr("records", "سجلات")} size="SM" />
        <NumericInstrument label={tr("Unknown or partial OIU", "وحدات OIU غير معروفة أو جزئية")} value={data.oiu.filter((item) => item.status === "UNKNOWN" || item.status === "PARTIAL").length} state={data.oiu.some((item) => item.status === "UNKNOWN" || item.status === "PARTIAL") ? "DEGRADED" : "LIVE"} stateLabel={tr("SOURCE STATUS", "حالة المصدر")} unit={tr("records", "سجلات")} size="SM" />
      </section>}
      <section className="economics-dual-path" aria-label={tr("Separate provider expense and OIU paths", "مساران منفصلان لنفقات المزوّد وOIU")}>
        <div className="economics-path-heading"><span className="eyebrow">{tr("RAW USAGE", "الاستخدام الخام")}</span><span aria-hidden="true">→</span><span>{tr("Independent, revision-pinned assessments", "تقييمات مستقلة ومثبتة المراجعة")}</span></div>
        <div className="economics-paths">
          <div className="economics-path economics-path-expense"><div className="economics-path-flow"><b>{tr("Provider rate book", "دفتر أسعار المزوّد")}</b><span aria-hidden="true">→</span><b>{tr("Provider expense", "نفقات المزوّد")}</b></div>{data.costs.length ? panel(tr("Provider expense assessments", "تقييمات نفقات المزوّد"), tr("Native currency amounts derived from captured provider usage and the pinned rate revision.", "مبالغ بالعملة الأصلية مشتقة من استخدام المزوّد المسجل ومراجعة السعر المثبتة."), data.costs, "cost") : <div className="economics-empty-path"><span className="eyebrow">{tr("DORMANT · NO EXPENSE EVIDENCE", "خامل · لا توجد أدلة نفقات")}</span><p>{tr("Awaiting captured usage and an applicable published rate revision. No provider amount is inferred.", "بانتظار استخدام مسجل ومراجعة سعر منشورة منطبقة. لا يُستنتج مبلغ للمزوّد.")}</p></div>}</div>
          <div className="economics-path economics-path-oiu"><div className="economics-path-flow"><b>{tr("OIU policy", "سياسة OIU")}</b><span aria-hidden="true">→</span><b>{tr("Internal OIU", "وحدات OIU الداخلية")}</b></div>{data.oiu.length ? panel(tr("OIU assessments & postings", "تقييمات وترحيلات OIU"), tr("Weighted dimensions follow the pinned policy and are rounded once using its half-even rule.", "تتبع الأبعاد الموزونة السياسة المثبتة وتُقرّب مرة واحدة وفق قاعدة التقريب إلى الزوجي."), data.oiu, "oiu") : <div className="economics-empty-path"><span className="eyebrow">{tr("DORMANT · NO OIU EVIDENCE", "خامل · لا توجد أدلة OIU")}</span><p>{tr("Awaiting usage dimensions and an applicable published OIU policy. Internal units remain separate from provider expense.", "بانتظار أبعاد الاستخدام وسياسة OIU منشورة منطبقة. تظل الوحدات الداخلية منفصلة عن نفقات المزوّد.")}</p></div>}</div>
        </div>
      </section>
      {!data.costs.length && !data.oiu.length && <section className="economics-dormant-derivation" aria-label={tr("Dormant derivation topology", "مسار الاشتقاق الخامل")}><span className="eyebrow">{tr("DERIVATION DORMANT · NO ASSESSMENTS", "الاشتقاق خامل · لا توجد تقييمات")}</span><div><b>{tr("RAW USAGE", "الاستخدام الخام")}</b><span aria-hidden="true">→</span><b>{tr("RATE REVISION", "مراجعة السعر")}</b><span aria-hidden="true">→</span><b>{tr("PROVIDER EXPENSE", "نفقات المزوّد")}</b></div><div><b>{tr("RAW USAGE", "الاستخدام الخام")}</b><span aria-hidden="true">→</span><b>{tr("OIU POLICY REVISION", "مراجعة سياسة OIU")}</b><span aria-hidden="true">→</span><b>{tr("OIU", "وحدات OIU")}</b></div><p>{tr("Captured usage, applicable revision, dimension inputs, calculation and evidence class will appear here after an authoritative assessment. No derivation is inferred from an empty source.", "سيظهر الاستخدام المسجل والمراجعة المنطبقة ومدخلات الأبعاد والحساب وتصنيف الدليل بعد التقييم المعتمد. لا يُستنتج اشتقاق من مصدر فارغ.")}</p></section>}
      <section className="economics-source-explorer">
        <header><span className="eyebrow">{tr("POLICY / PROVENANCE", "السياسة / المصدر")}</span><h2>{tr("Rate books and OIU policies", "دفاتر الأسعار وسياسات OIU")}</h2><p>{tr("Published revisions are immutable evidence sources; values are not inferred from catalog metadata.", "المراجعات المنشورة مصادر أدلة ثابتة؛ ولا تُستنتج القيم من بيانات الفهرس.")}</p></header>
        {[{ key: "rate-book", title: tr("Provider rate books", "دفاتر أسعار المزوّد"), items: data.rateBooks }, { key: "policy", title: tr("OIU policy revisions", "مراجعات سياسة OIU"), items: data.policies }].map(({ key, title, items }) => <section className="economics-source-table" key={key} aria-label={title}><h3>{title}</h3><div className="table-frame"><table><thead><tr><th>{tr("Policy / book", "السياسة / الدفتر")}</th><th>{tr("Revision", "المراجعة")}</th><th>{tr("Status", "الحالة")}</th><th>{tr("Source", "المصدر")}</th><th>{tr("Evidence", "الدليل")}</th></tr></thead><tbody>{items.map((item) => <tr key={valueText(item.id)}><td>{valueText(item.rateBookKey ?? item.policyKey)}</td><td>{valueText(item.revision)}</td><td>{valueText(item.status)}</td><td>{valueText(item.sourceQuality ?? item.sourceDigest, tr("Not supplied", "غير متوفر"))}</td><td><ActionButton variant="quiet" onPress={() => setSelected({ ...item, _kind: key })}>{tr("Inspect revision", "افحص المراجعة")}</ActionButton></td></tr>)}{!items.length && <tr><td colSpan={5}>{tr("No revision records in the current source response. No rates or weights are inferred.", "لا توجد سجلات مراجعة في استجابة المصدر الحالية. لا تُستنتج أسعار أو أوزان.")}</td></tr>}</tbody></table></div></section>)}
      </section>
      <section className="economics-revision-review">
        <header><span className="eyebrow">{tr("SOURCE REVISION REVIEW", "مراجعة مراجعات المصدر")}</span><h2>{tr("Compare pinned economics policy", "قارن سياسة الاقتصاد المثبتة")}</h2><p>{tr("Compare only source records returned by OIC. Historical assessments remain pinned and are not recalculated.", "قارن سجلات المصدر التي أعادها OIC فقط. تظل التقييمات التاريخية مثبتة ولا يعاد حسابها.")}</p></header>
        <DiscreteStepSelector label={tr("Revision source", "مصدر المراجعة")} value={compareKind} onChange={(value) => { setCompareKind(value); setCompareLeftId(""); setCompareRightId(""); }} options={[{ id: "rate-book", label: tr("Provider rate book", "دفتر أسعار المزوّد") }, { id: "oiu-policy", label: tr("OIU policy", "سياسة OIU") }]} placeholder={tr("Choose source", "اختر المصدر")} locale={locale} dir={ar ? "rtl" : "ltr"} />
        <div className="economics-compare-pickers"><RevisionPicker label={tr("Current source revision", "مراجعة المصدر الحالية")} value={compareLeftId} onChange={setCompareLeftId} options={compareOptions} placeholder={tr("Choose a revision", "اختر مراجعة")} searchLabel={tr("Search revisions", "ابحث عن مراجعات")} emptyLabel={tr("No source revisions available", "لا توجد مراجعات مصدر")} locale={locale} dir={ar ? "rtl" : "ltr"} /><RevisionPicker label={tr("Compare with", "قارن مع")} value={compareRightId} onChange={setCompareRightId} options={compareOptions.filter((item) => item.id !== compareLeftId)} placeholder={tr("Choose a revision", "اختر مراجعة")} searchLabel={tr("Search revisions", "ابحث عن مراجعات")} emptyLabel={tr("No other source revisions available", "لا توجد مراجعة مصدر أخرى")} locale={locale} dir={ar ? "rtl" : "ltr"} /></div>
        {compareLeft && compareRight ? <CompareSurface title={tr("Recorded source values", "قيم المصدر المسجلة")} leftLabel={valueText(compareKind === "rate-book" ? compareLeft.rateBookKey : compareLeft.policyKey) + " · r" + valueText(compareLeft.revision)} rightLabel={valueText(compareKind === "rate-book" ? compareRight.rateBookKey : compareRight.policyKey) + " · r" + valueText(compareRight.revision)} left={<pre className="economics-trace"><code>{JSON.stringify(compareKind === "rate-book" ? compareLeft.rates ?? compareLeft : compareLeft.dimensions ?? compareLeft, null, 2)}</code></pre>} right={<pre className="economics-trace"><code>{JSON.stringify(compareKind === "rate-book" ? compareRight.rates ?? compareRight : compareRight.dimensions ?? compareRight, null, 2)}</code></pre>} /> : <p className="economics-compare-empty">{tr("Select two revisions from the current source response to compare their recorded dimensions and effective periods.", "اختر مراجعتين من استجابة المصدر الحالية لمقارنة الأبعاد المسجلة وفترات السريان.")}</p>}
      </section>
    </>}
    <Inspector open={Boolean(selected)} onClose={() => setSelected(null)} title={tr(selectedSource ? "Economics source revision" : selectedIsOiu ? "OIU assessment" : "Provider cost assessment", selectedSource ? "مراجعة مصدر اقتصادي" : selectedIsOiu ? "تقييم OIU" : "تقييم تكلفة المزوّد")} description={tr("Read-only economic evidence. No invoice, customer charge, or profit claim.", "أدلة اقتصادية للقراءة فقط. لا توجد فاتورة أو رسوم عميل أو ادعاء ربح.")} closeLabel={tr("Close", "إغلاق")} dir={ar ? "rtl" : "ltr"}>
      {details.map(([label, item]) => <div className="x14-detail-row" key={label}><span>{label}</span><bdi>{valueText(item)}</bdi></div>)}
      {selected && selectedDimensionLines.map((line, index) => <div className="economics-derivation-line" key={`${valueText(line.dimension, "dimension")}-${index}`}><span className="eyebrow">{valueText(line.dimension, tr("Dimension", "البُعد"))} · {valueText(line.state, tr("recorded", "مسجل"))}</span><div><b>{tr("Quantity", "الكمية")}: <bdi>{valueText(line.quantity, tr("unknown", "غير معروف"))} {valueText(line.unit, "")}</bdi></b><b>{tr("Rate / weight", "السعر / الوزن")}: <bdi>{selectedIsOiu ? valueText(line.weight, valueText(line.multiplier, tr("policy-defined", "وفق السياسة"))) : `${valueText(line.pricePerUnit, tr("unknown", "غير معروف"))} / ${valueText(line.divisor, "1")}`}</bdi></b><b>{tr("Result", "النتيجة")}: <bdi>{valueText(line.amount, valueText(line.oiu, tr("not assessed", "لم يُقيّم")))}</bdi></b></div></div>)}
      {selectedSource && <pre className="economics-trace"><code>{JSON.stringify(selectedSourceRows, null, 2)}</code></pre>}
    </Inspector>
  </section>;
}
