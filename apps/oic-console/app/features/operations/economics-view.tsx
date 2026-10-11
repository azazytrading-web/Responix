"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale, View } from "../../i18n";
import { ErrorState, LoadingState } from "../../components/oic-primitives";
import { ActionButton, CompareSurface, DiscreteStepSelector, Inspector, RevisionPicker } from "../../components/interface";
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
      <section className="economics-source-summary"><article className="metric-card"><p>{tr("Published provider rate books", "دفاتر أسعار المزوّد المنشورة")}</p><strong>{data.rateBooks.filter((item) => item.status === "PUBLISHED").length}</strong><small>{tr("revisioned sources", "مصادر ذات مراجعات")}</small></article><article className="metric-card"><p>{tr("Published OIU policies", "سياسات OIU المنشورة")}</p><strong>{data.policies.filter((item) => item.status === "PUBLISHED").length}</strong><small>{tr("pinned calculation rules", "قواعد حساب مثبتة")}</small></article><article className="metric-card"><p>{tr("Unknown provider expense", "نفقات مزوّد غير معروفة")}</p><strong>{data.costs.filter((item) => item.status === "UNKNOWN").length}</strong><small>{tr("never treated as zero", "لا تُعامل كأنها صفر")}</small></article><article className="metric-card"><p>{tr("Unknown or partial OIU", "وحدات OIU غير معروفة أو جزئية")}</p><strong>{data.oiu.filter((item) => item.status === "UNKNOWN" || item.status === "PARTIAL").length}</strong><small>{tr("source status shown per record", "تظهر حالة المصدر لكل سجل")}</small></article></section>
      {panel(tr("Provider cost assessments", "تقييمات تكلفة المزوّد"), tr("Native currency amounts derived from pinned provider rates and captured usage.", "مبالغ بالعملة الأصلية مشتقة من أسعار المزوّد المثبتة والاستخدام المسجل."), data.costs, "cost")}
      {panel(tr("OIU assessments & postings", "تقييمات وترحيلات OIU"), tr("Exact weighted dimensions, rounded once using the published half-even policy.", "أبعاد موزونة بدقة وتقريب لمرة واحدة وفق سياسة التقريب إلى الزوجي المنشورة."), data.oiu, "oiu")}
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
      {selectedSource && <pre className="economics-trace"><code>{JSON.stringify(selectedSourceRows, null, 2)}</code></pre>}
    </Inspector>
  </section>;
}
