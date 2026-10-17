"use client";

import { useEffect, useState } from "react";
import type { Locale, View } from "../../i18n";
import { ActionButton } from "../../components/interface";
import { NumericInstrument } from "../../components/instruments";
import { OiuValue } from "../../components/oiu-value";

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const scalar = (value: unknown, fallback = "UNKNOWN") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
const amount = (value: unknown): string | null => typeof value === "string" ? value : null;

export function OverviewOperationalSummary({ locale, navigate, onQueueRead, onAccountingRead, onEvaluationRead }: { locale: Locale; navigate: (view: View) => void; onQueueRead?: (queue: Row | null) => void; onAccountingRead?: (accounting: Row | null) => void; onEvaluationRead?: (evaluation: Row | null) => void }) {
  const [accounting, setAccounting] = useState<Row>({ state: "LOADING" });
  const [evaluation, setEvaluation] = useState<Row>({ state: "LOADING" });
  const ar = locale === "ar";
  const tr = (en: string, arabic: string) => ar ? arabic : en;

  useEffect(() => {
    let active = true;
    const read = async (view: string) => {
      const response = await fetch(`/api/console?view=${view}`, { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error("source unavailable");
      return row(body);
    };
    void Promise.allSettled([read("packet76-accounting"), read("overview-readiness")])
      .then(([accountingResult, evaluationResult]) => {
        if (!active) return;
        setAccounting(accountingResult.status === "fulfilled" ? accountingResult.value : { state: "UNAVAILABLE" });
        setEvaluation(evaluationResult.status === "fulfilled" ? evaluationResult.value : { state: "UNAVAILABLE" });
        onAccountingRead?.(accountingResult.status === "fulfilled" ? accountingResult.value : null);
        onEvaluationRead?.(evaluationResult.status === "fulfilled" ? evaluationResult.value : null);
        onQueueRead?.(evaluationResult.status === "fulfilled" ? row(evaluationResult.value.queue) : null);
      });
    return () => { active = false; };
  }, [onAccountingRead, onEvaluationRead, onQueueRead]);

  const oiu = row(accounting.oiu);
  const costs = row(accounting.providerCosts);
  const usd = row(costs.USD);
  const readiness = row(evaluation.readiness);
  const counts = row(evaluation.counts);
  const state = scalar(accounting.state);
  const evaluationState = scalar(evaluation.state);
  const dispatchCount = typeof accounting.dispatchCount === "number" ? accounting.dispatchCount : null;
  const available = state === "LIVE";
  const metricState = (value: unknown) => value !== null && value !== undefined ? "LIVE" : state === "NO_DATA_YET" ? "IDLE" : "UNAVAILABLE";
  const metricLabel = (value: unknown) => value !== null && value !== undefined ? tr("RECORDED", "مسجل") : tr(state, state);

  return <section className="overview-operational-summary" aria-label={tr("Evaluation readiness and OIU accounting", "جاهزية التقييم وحساب OIU")}>
    <header className="overview-operational-heading">
      <div><span className="eyebrow">{tr("EVALUATION / ECONOMICS / OIC-6", "التقييم / الاقتصاديات / OIC-6")}</span><h2>{tr("Execution & unit ledger", "التنفيذ ودفتر الوحدات")}</h2><p>{tr("Live registry readiness and the bounded Packet 7.6 cohort accounting readback. No platform-wide total is inferred.", "جاهزية السجل المباشرة وقراءة حساب مجموعة الحزمة 7.6 المحدودة. لا يُستنتج إجمالي شامل للمنصة.")}</p></div>
      <span className={`overview-source-state is-${evaluationState.toLowerCase()}`}>{tr("Evaluation", "التقييم")} · {evaluationState}</span>
    </header>
    <div className="overview-ops-grid">
      <section className="overview-ops-cell overview-ops-evaluation" aria-label={tr("Evaluation registry readiness", "جاهزية سجل التقييم")}>
        <div className="overview-ops-cell-heading"><b>{tr("EVALUATION READINESS", "جاهزية التقييم")}</b><span>{scalar(readiness.runExecution, evaluationState === "LOADING" ? "LOADING" : "UNAVAILABLE")}</span></div>
        <div className="overview-registry-counts">
          {[["Packs", "packs"], ["Releases", "releases"], ["Campaigns", "campaigns"], ["Runs", "runs"], ["Reports", "reports"], ["Candidates", "candidates"]].map(([label, key]) => <span key={key}><b>{scalar(counts[key], evaluationState === "LIVE" ? "UNKNOWN" : evaluationState)}</b><small>{tr(label, label)}</small></span>)}
        </div>
        <p className="overview-readiness-line">{tr("Scheduler", "المجدول")}: <b>{scalar(readiness.scheduler, evaluationState === "LOADING" ? "LOADING" : "UNAVAILABLE")}</b> · {tr("Worker", "العامل")}: <b>{scalar(readiness.worker, evaluationState === "LOADING" ? "LOADING" : "UNAVAILABLE")}</b> · {tr("Fresh", "حديث")}: <b>{readiness.workerFresh === true ? tr("YES", "نعم") : readiness.workerFresh === false ? tr("NO", "لا") : tr("UNKNOWN", "غير معروف")}</b></p>
        {typeof readiness.workerReasonCode === "string" && <small className="overview-source-reason">{readiness.workerReasonCode}</small>}
        <p className="overview-unmeasured-note">{tr("Quality score: UNMEASURED · no approved universal quality method is bound.", "درجة الجودة: غير مقاسة · لا توجد طريقة جودة شاملة معتمدة.")}</p>
        <ActionButton variant="quiet" onPress={() => navigate("evaluation")}>{tr("Open Evaluation", "فتح التقييم")} →</ActionButton>
      </section>
      <section className="overview-ops-cell overview-ops-accounting" aria-label={tr("Packet 7.6 provider and OIU accounting", "حساب المزوّد وOIU للحزمة 7.6")}>
        <div className="overview-ops-cell-heading"><b>{tr("PACKET 7.6 · PAIRED + CANDIDATE COHORTS", "الحزمة 7.6 · مجموعتا المقارنة والمرشح")}</b><span>{state}</span></div>
        <div className="overview-accounting-id"><span>{tr("Provider", "المزوّد")} <b>{Array.isArray(accounting.provider) ? accounting.provider.join(", ") || tr("UNKNOWN", "غير معروف") : tr("UNKNOWN", "غير معروف")}</b></span><span>{tr("Model", "النموذج")} <b>{Array.isArray(accounting.model) ? accounting.model.join(", ") || tr("UNKNOWN", "غير معروف") : tr("UNKNOWN", "غير معروف")}</b></span><span>{tr("Transport", "النقل")} <b>{Array.isArray(accounting.adapter) ? accounting.adapter.join(", ") || tr("UNKNOWN", "غير معروف") : tr("UNKNOWN", "غير معروف")}</b></span></div>
        <div className="overview-accounting-metrics">
          <NumericInstrument label={tr("Provider dispatches", "إرسالات المزوّد")} value={dispatchCount} state={metricState(accounting.dispatchCount)} stateLabel={metricLabel(accounting.dispatchCount)} size="SM" />
          <NumericInstrument label={tr("Input tokens", "رموز الإدخال")} value={typeof accounting.inputTokens === "number" ? accounting.inputTokens : null} state={metricState(accounting.inputTokens)} stateLabel={metricLabel(accounting.inputTokens)} size="SM" />
          <NumericInstrument label={tr("Output tokens", "رموز الإخراج")} value={typeof accounting.outputTokens === "number" ? accounting.outputTokens : null} state={metricState(accounting.outputTokens)} stateLabel={metricLabel(accounting.outputTokens)} size="SM" />
          <NumericInstrument label={tr("Provider cost", "تكلفة المزوّد")} value={usd.state === "ASSESSED" && typeof usd.amount === "string" ? usd.amount : null} formattedValue={typeof usd.amount === "string" ? usd.amount : undefined} unit="USD" state={metricState(usd.state === "ASSESSED" ? usd.amount : null)} stateLabel={metricLabel(usd.state === "ASSESSED" ? usd.amount : null)} size="SM" />
        </div>
        <div className="overview-accounting-oiu" aria-label={tr("OIU amounts", "مبالغ OIU")}>
          {[["Reserved", "reserved"], ["Consumed", "consumed"], ["Released", "released"], ["Remaining", "remaining"]].map(([label, key]) => <span key={key}><small>{tr(label, label)}</small><OiuValue value={amount(oiu[key])} locale={locale} variant="COMPACT" label={tr(label, label)} /></span>)}
        </div>
        <small className="overview-accounting-scope">{available ? tr("Canonical run, provider usage, cost assessment and OIC-6 ledger read models. Remaining is not exposed by that read model.", "نماذج تشغيل واستخدام المزوّد وتقييم التكلفة ودفتر OIC-6 المعتمدة. لا يعرض نموذج القراءة قيمة المتبقي.") : tr("The scoped accounting source is not currently available; values remain unknown.", "مصدر الحساب المحدد النطاق غير متاح حالياً؛ وتظل القيم غير معروفة.")}</small>
        <div className="overview-ops-actions"><ActionButton variant="quiet" onPress={() => navigate("economics")}>{tr("Economics detail", "تفاصيل الاقتصاديات")} →</ActionButton><ActionButton variant="quiet" onPress={() => navigate("admission")}>{tr("Admission & budget", "القبول والميزانية")} →</ActionButton></div>
      </section>
    </div>
  </section>;
}
