"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale, View } from "../../i18n";
import { ErrorState, LoadingState } from "../../components/oic-primitives";
import { ActionButton, Inspector } from "../../components/interface";

type Row = Record<string, unknown>;
type Dataset = { costs: Row[]; oiu: Row[]; rateBooks: Row[]; policies: Row[] };
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const pageRows = (value: unknown): Row[] => {
  const candidate = record(value).items;
  return Array.isArray(candidate) ? candidate.map(record) : [];
};
const listRows = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
const valueText = (value: unknown, fallback = "—") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;

export function EconomicsView({ view, locale }: { view: View; locale: Locale }) {
  const [data, setData] = useState<Dataset>({ costs: [], oiu: [], rateBooks: [], policies: [] });
  const [state, setState] = useState<"idle" | "loading" | "available" | "failed">("idle");
  const [selected, setSelected] = useState<Row | null>(null);
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
  const details = selected ? Object.entries({
    [tr("Status", "الحالة")]: selected.status,
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
    <header className="lab-page-heading"><div><span className="eyebrow">OIC-6.2 / SOURCE-BACKED ECONOMICS</span><h1>{tr("Provider economics & OIU", "اقتصاديات المزوّد ووحدات OIU")}</h1><p>{tr("Provider expense and internal usage units remain separate, revision-pinned evidence. No customer rating or invoice is represented here.", "تظل نفقات المزوّد ووحدات الاستخدام الداخلية أدلة منفصلة ومثبتة بمراجعاتها. لا تُعرض هنا أسعار العملاء أو الفواتير.")}</p></div><ActionButton variant="secondary" onPress={() => void load()}>{tr("Refresh", "تحديث")}</ActionButton></header>
    <div className="economics-disclaimer">{tr("A missing rate, dimension, or conversion remains UNKNOWN or PARTIAL. It is never zero by default.", "يظل السعر أو البُعد أو التحويل المفقود UNKNOWN أو PARTIAL، ولا يُعامل على أنه صفر افتراضيًا.")}</div>
    {state === "loading" && <LoadingState label={tr("Loading economics evidence", "جارٍ تحميل الأدلة الاقتصادية")} />}
    {state === "failed" && <ErrorState title={tr("Economics evidence unavailable", "الأدلة الاقتصادية غير متاحة")} description={tr("The read-only economics source could not be loaded.", "تعذّر تحميل مصدر الأدلة الاقتصادية المخصص للقراءة فقط.")} />}
    {state === "available" && <>
      <section className="economics-source-summary"><article className="metric-card"><p>{tr("Published provider rate books", "دفاتر أسعار المزوّد المنشورة")}</p><strong>{data.rateBooks.filter((item) => item.status === "PUBLISHED").length}</strong><small>{tr("revisioned sources", "مصادر ذات مراجعات")}</small></article><article className="metric-card"><p>{tr("Published OIU policies", "سياسات OIU المنشورة")}</p><strong>{data.policies.filter((item) => item.status === "PUBLISHED").length}</strong><small>{tr("pinned calculation rules", "قواعد حساب مثبتة")}</small></article><article className="metric-card"><p>{tr("Unknown provider expense", "نفقات مزوّد غير معروفة")}</p><strong>{data.costs.filter((item) => item.status === "UNKNOWN").length}</strong><small>{tr("never treated as zero", "لا تُعامل كأنها صفر")}</small></article><article className="metric-card"><p>{tr("Unknown OIU", "وحدات OIU غير معروفة")}</p><strong>{data.oiu.filter((item) => item.status === "UNKNOWN" || item.status === "PARTIAL").length}</strong><small>{tr("no incomplete posting", "لا يوجد ترحيل ناقص")}</small></article></section>
      {panel(tr("Provider cost assessments", "تقييمات تكلفة المزوّد"), tr("Native currency amounts derived from pinned provider rates and captured usage.", "مبالغ بالعملة الأصلية مشتقة من أسعار المزوّد المثبتة والاستخدام المسجل."), data.costs, "cost")}
      {panel(tr("OIU assessments & postings", "تقييمات وترحيلات OIU"), tr("Exact weighted dimensions, rounded once using the published half-even policy.", "أبعاد موزونة بدقة وتقريب لمرة واحدة وفق سياسة التقريب إلى الزوجي المنشورة."), data.oiu, "oiu")}
    </>}
    <Inspector open={Boolean(selected)} onClose={() => setSelected(null)} title={tr(selectedIsOiu ? "OIU assessment" : "Provider cost assessment", selectedIsOiu ? "تقييم OIU" : "تقييم تكلفة المزوّد")} description={tr("Read-only economic evidence. No invoice, customer charge, or profit claim.", "أدلة اقتصادية للقراءة فقط. لا توجد فاتورة أو رسوم عميل أو ادعاء ربح.")} closeLabel={tr("Close", "إغلاق")} dir={ar ? "rtl" : "ltr"}>
      {details.map(([label, item]) => <div className="x14-detail-row" key={label}><span>{label}</span><bdi>{valueText(item)}</bdi></div>)}
    </Inspector>
  </section>;
}
