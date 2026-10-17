"use client";

import type { Locale, View } from "../../i18n";
import { ActionButton } from "../../components/interface";
import { NumericInstrument } from "../../components/instruments";
import { OiuValue } from "../../components/oiu-value";

type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, fallback = "UNKNOWN") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;

export function Packet76AccountingSummary({ value, locale, navigate, openRun, variant = "economics" }: {
  value: unknown;
  locale: Locale;
  navigate: (view: View) => void;
  openRun?: (runId: string) => void;
  variant?: "evaluation" | "economics" | "admission";
}) {
  const data = record(value);
  const oiu = record(data.oiu);
  const costs = record(data.providerCosts);
  const provider = Array.isArray(data.provider) ? data.provider.filter((item): item is string => typeof item === "string") : [];
  const model = Array.isArray(data.model) ? data.model.filter((item): item is string => typeof item === "string") : [];
  const adapter = Array.isArray(data.adapter) ? data.adapter.filter((item): item is string => typeof item === "string") : [];
  const runs = Array.isArray(data.runs) ? data.runs.map(record) : [];
  const ar = locale === "ar";
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const live = data.state === "LIVE";
  const count = (key: string) => typeof data[key] === "number" ? data[key] : null;
  const usd = record(costs.USD);
  const metricState = (amount: unknown) => amount !== null && amount !== undefined ? "LIVE" : data.state === "NO_DATA_YET" ? "UNMEASURED" : "UNAVAILABLE";
  const metricLabel = (amount: unknown) => amount !== null && amount !== undefined ? tr("CANONICAL", "RECORDED") : text(data.state);
  const oiuAmount = (key: string) => typeof oiu[key] === "string" ? oiu[key] : null;
  const runRows = runs.map((run) => <tr key={text(run.id)}>
    <td>{text(run.status)} · {text(run.accountingState)}</td>
    <td>{text(run.targetClass)}</td>
    <td>{openRun && typeof run.id === "string" ? <ActionButton variant="quiet" onPress={() => openRun(run.id as string)}>{tr("Open run accounting", "فتح حساب التشغيل")} ↗</ActionButton> : tr("Open from Evaluation runs", "افتح من تشغيلات التقييم")}</td>
  </tr>);

  const admission = variant === "admission";
  const evaluation = variant === "evaluation";
  const showFullOiu = variant === "economics" || admission;
  return <section className={`packet76-accounting-summary packet76-${variant}`} aria-label={tr("Packet 7.6 canonical provider and OIC-6 accounting", "حساب المزوّد وOIC-6 المعتمد للحزمة 7.6")}>
    <header className="panel-heading">
      <div><span className="eyebrow">{tr("LIVE RUN ACCOUNTING · OIC-6", "حساب التشغيل المباشر · OIC-6")}</span>
        <h2>{tr(admission ? "Packet 7.6 admission liability" : evaluation ? "Evaluation execution evidence" : "Packet 7.6 provider activity", admission ? "التزامات القبول للحزمة 7.6" : evaluation ? "أدلة تنفيذ التقييم" : "نشاط المزوّد للحزمة 7.6")}</h2>
        <p>{tr(admission ? "Scope: paired and candidate cohorts. Reservation and settlement values come from OIC-6 admission records." : evaluation ? "Scope: paired and candidate cohorts. This is a compact execution summary; use run accounting for provider cost and admission detail." : "Scope: paired and candidate cohorts. Values are read from canonical evaluation run, provider usage, cost assessment and OIC-6 admission records.", admission ? "النطاق: مجموعتا المقارنة والمرشح. تُقرأ قيم الحجز والتسوية من سجلات قبول OIC-6." : evaluation ? "النطاق: مجموعتا المقارنة والمرشح. هذا ملخص تنفيذ موجز؛ راجع تفاصيل التشغيل لتكلفة المزوّد والقبول." : "النطاق: مجموعتا المقارنة والمرشح. تُقرأ القيم من سجلات التشغيل واستخدام المزوّد وتقييم التكلفة وقبول OIC-6 المعتمدة.")}</p>
      </div><span className={`eyebrow packet76-state ${live ? "is-live" : ""}`}>{text(data.state)}</span>
    </header>
    <div className={`evaluation-kpis packet76-kpis ${admission ? "is-liability" : ""}`}>
      <NumericInstrument label={tr("Real provider dispatches", "إرسالات المزوّد الحقيقية")} value={count("dispatchCount")} state={metricState(data.dispatchCount)} stateLabel={metricLabel(data.dispatchCount)} source={tr("Canonical provider attempts", "محاولات المزوّد المعتمدة")} size="SM" />
      {!admission && <>
        <NumericInstrument label={tr("Input tokens", "رموز الإدخال")} value={count("inputTokens")} state={metricState(data.inputTokens)} stateLabel={metricLabel(data.inputTokens)} source={tr("Provider usage receipts", "إيصالات استخدام المزوّد")} size="SM" />
        <NumericInstrument label={tr("Output tokens", "رموز الإخراج")} value={count("outputTokens")} state={metricState(data.outputTokens)} stateLabel={metricLabel(data.outputTokens)} source={tr("Provider usage receipts", "إيصالات استخدام المزوّد")} size="SM" />
        {!evaluation && <NumericInstrument label={tr("Assessed provider cost", "تكلفة المزوّد المقدّرة")} value={typeof usd.amount === "string" ? usd.amount : null} formattedValue={typeof usd.amount === "string" ? usd.amount : undefined} unit="USD" state={metricState(usd.state === "ASSESSED" ? usd.amount : null)} stateLabel={metricLabel(usd.state === "ASSESSED" ? usd.amount : null)} source={tr("Original assessed usage", "الاستخدام الأصلي المقدّر")} size="SM" />}
      </>}
    </div>
    {!admission && <div className="packet76-provider-line" aria-label={tr("Provider identity", "هوية المزوّد")}>
      <span><b>{tr("Provider", "المزوّد")}</b>{provider.join(", ") || tr("Unavailable", "غير متاح")}</span>
      <span><b>{tr("Upstream model", "النموذج الخارجي")}</b>{model.join(", ") || tr("Unavailable", "غير متاح")}</span>
      <span><b>{tr("Adapter", "المحوّل")}</b>{adapter.join(", ") || tr("Unavailable", "غير متاح")}</span>
      <span><b>{tr("Cohort scope", "نطاق المجموعة")}</b>{text(data.campaignCount, "UNKNOWN")} {tr("campaigns", "حملات")} · {text(data.runCount, "UNKNOWN")} {tr("runs", "تشغيلات")}</span>
    </div>}
    {showFullOiu && <div className="packet76-oiu-grid" aria-label={tr("Packet 7.6 OIU reconciliation", "تسوية OIU للحزمة 7.6")}>
      {[["AUTHORIZED · CAMPAIGN CEILINGS", "authorized", "السقف المصرح · حدود الحملات"], ["RESERVED", "reserved", "محجوز"], ["CONSUMED", "consumed", "مستهلك"], ["RELEASED", "released", "محرر"], ["REMAINING", "remaining", "متبقي"]].map(([label, key, arabic]) => <div className="packet76-oiu-cell" key={key}>
        <span className="eyebrow">{tr(label, arabic)}</span><OiuValue value={oiuAmount(key)} locale={locale} variant="CARD" label={tr(label, arabic)} />
        {key === "authorized" && <small>{tr("Published campaign hard-budget ceilings", "حدود الميزانية الصلبة المنشورة للحملات")}</small>}
        {key === "remaining" && <small>{tr("Not exposed by the canonical run-accounting read model; see Admission balances for source availability.", "لا يعرضها نموذج حساب التشغيل المعتمد؛ راجع أرصدة القبول لمعرفة السعة المصدرية.")}</small>}
      </div>)}
    </div>}
    {!admission && (runs.length > 0 ? <div className="table-frame packet76-run-drilldown"><table><thead><tr><th>{tr("Run / accounting state", "حالة التشغيل")}</th><th>{tr("Execution target", "هدف التنفيذ")}</th><th>{tr("Accounting drill-down", "تفاصيل الحساب")}</th></tr></thead><tbody>{runRows}</tbody></table></div> : <p className="packet76-no-runs">{data.state === "NO_DATA_YET" ? tr("NO DATA YET · no run is recorded in these two cohort campaigns.", "لا توجد بيانات بعد · لا يوجد تشغيل مسجل في حملتي المجموعة.") : tr("UNAVAILABLE · the canonical cohort run list could not be read.", "غير متاح · تعذرت قراءة قائمة تشغيلات المجموعة المعتمدة.")}</p>)}
    <div className="packet76-actions"><ActionButton variant="secondary" onPress={() => navigate("evaluation")}>{tr("Evaluation run details", "تفاصيل تشغيل التقييم")} ↗</ActionButton><ActionButton variant="secondary" onPress={() => navigate("economics")}>{tr("Economics detail", "تفاصيل الاقتصاديات")} ↗</ActionButton><ActionButton variant="secondary" onPress={() => navigate("admission")}>{tr("Admission & budget", "القبول والميزانية")} ↗</ActionButton></div>
  </section>;
}
