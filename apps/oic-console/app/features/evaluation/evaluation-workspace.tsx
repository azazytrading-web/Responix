"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Locale, View } from "../../i18n";
import { DataTable, EmptyState, ErrorState, LoadingState } from "../../components/oic-primitives";
import { ActionButton, Inspector, WorkspaceTabs } from "../../components/interface";
import { NumericInstrument } from "../../components/instruments";
import { OiuValue } from "../../components/oiu-value";
import { domainCoverageRows } from "./domain-coverage.cjs";
import { Packet76AccountingSummary } from "../operations/packet76-accounting-summary";
import { canonicalProviderLabel } from "../../lib/packet76-accounting.cjs";

type Row = Record<string, unknown>;
type Dataset = { overview: Row; packs: Row[]; releases: Row[]; metrics: Row[]; judges: Row[]; campaigns: Row[]; runs: Row[]; reports: Row[]; comparisons: Row[]; work: Row[]; outbox: Row[]; state: Row; packet76Accounting: Row };
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const text = (value: unknown, fallback = "—") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;

export function EvaluationWorkspace({ locale, navigate }: { locale: Locale; navigate: (view: View) => void }) {
  const ar = locale === "ar";
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const statusLabel = (value: unknown) => {
    const status = text(value, "UNKNOWN");
    const labels: Record<string, readonly [string, string]> = {
      PENDING: ["Pending", "قيد الانتظار"], LEASED: ["Leased", "مُسند"], RUNNING: ["Running", "قيد التشغيل"],
      QUEUED: ["Queued", "في قائمة الانتظار"], SUCCEEDED: ["Succeeded", "نجح"], EXECUTED: ["Executed", "نُفذ"],
      FAILED: ["Failed", "فشل"], PARTIAL: ["Partial", "جزئي"], BUDGET_BLOCKED: ["Budget blocked", "موقوف بسبب الميزانية"],
      INCONCLUSIVE: ["Inconclusive", "غير حاسم"], INVALID_ENVIRONMENT: ["Invalid environment", "بيئة غير صالحة"],
      CANCEL_PENDING: ["Cancellation pending", "الإلغاء قيد الانتظار"], CANCELLED: ["Cancelled", "أُلغي"],
      DRAFT: ["Draft", "مسودة"], VALIDATED: ["Validated", "تم التحقق"], PUBLISHED: ["Published", "نُشر"],
      DEPRECATED: ["Deprecated", "مهمل"], RETIRED: ["Retired", "متقاعد"], COMPROMISED: ["Compromised", "مخترق"]
    };
    const label = labels[status];
    return label ? (ar ? label[1] : label[0]) : status;
  };
  const [data, setData] = useState<Dataset>({ overview: {}, packs: [], releases: [], metrics: [], judges: [], campaigns: [], runs: [], reports: [], comparisons: [], work: [], outbox: [], state: {}, packet76Accounting: { state: "UNAVAILABLE" } });
  const [state, setState] = useState<"idle" | "loading" | "available" | "failed">("idle");
  const [selectedTab, setSelectedTab] = useState("command");
  const [selected, setSelected] = useState<Row | null>(null);
  const [packDetails, setPackDetails] = useState<Row | null>(null);
  const [packDetailsState, setPackDetailsState] = useState<"idle" | "loading" | "available" | "failed">("idle");
  const packRequest = useRef(0);
  const [reportDetails, setReportDetails] = useState<Row | null>(null);
  const [reportDetailsState, setReportDetailsState] = useState<"idle" | "loading" | "available" | "failed">("idle");
  const reportRequest = useRef(0);
  const [runDetails, setRunDetails] = useState<Row | null>(null);
  const [runDetailsState, setRunDetailsState] = useState<"idle" | "loading" | "available" | "failed">("idle");
  const runRequest = useRef(0);
  const headerLabel = (header: string) => ar ? ({ PACKKEY: "الحزمة", DOMAIN: "المجال", REVISION: "المراجعة", STATUS: "الحالة", RELEASETIER: "مستوى الإتاحة", CAMPAIGNKEY: "الحملة", TARGETCLASS: "فئة الهدف", PLANNEDDENOMINATOR: "التجارب المخطط لها", METRICKEY: "المقياس", JUDGEKEY: "المحكّم", JUDGETYPE: "نوع التحكيم" } as Record<string, string>)[header] ?? header : ({ PACKKEY: "PACK", RELEASETIER: "EXPOSURE", CAMPAIGNKEY: "CAMPAIGN", TARGETCLASS: "TARGET CLASS", PLANNEDDENOMINATOR: "PLANNED TRIALS", METRICKEY: "METRIC", JUDGEKEY: "JUDGE", JUDGETYPE: "JUDGE TYPE" } as Record<string, string>)[header] ?? header;
  const executionLabels: Record<string, string> = { ATTEMPTCOUNT: tr("Attempts", "المحاولات"), MAXATTEMPTS: tr("Attempt limit", "حد المحاولات"), LASTFAILURECLASS: tr("Failure class", "فئة الإخفاق"), EVENTTYPE: tr("Event", "الحدث") };
  const load = useCallback(async () => {
    setState("loading");
    try {
      const [response, accountingResponse] = await Promise.all([
        fetch("/api/console?view=evaluation", { cache: "no-store" }),
        fetch("/api/console?view=packet76-accounting", { cache: "no-store" })
      ]);
      const rawValue: unknown = await response.json().catch(() => null);
      const rawAccounting: unknown = await accountingResponse.json().catch(() => null);
      const value = record(rawValue);
      if (!response.ok) throw new Error("unavailable");
      const overview = record(value.overview);
      setData({ overview, packs: rows(value.packs).map((pack) => ({ ...pack, caseCount: record(pack._count).cases })), releases: rows(value.releases).map((release) => ({ ...release, packKey: record(release.pack).packKey })), metrics: rows(value.metrics), judges: rows(value.judges), campaigns: rows(value.campaigns), runs: rows(value.runs), reports: rows(value.reports), comparisons: rows(value.comparisons), work: rows(value.work), outbox: rows(value.outbox), state: record(value.state), packet76Accounting: accountingResponse.ok ? record(rawAccounting) : { state: "UNAVAILABLE" } });
      setState("available");
    } catch {
      setData((current) => ({ ...current, packet76Accounting: { state: "UNAVAILABLE" } }));
      setState("failed");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selectPack = useCallback(async (item: Row) => {
    setSelected(item);
    setPackDetails(null);
    const request = ++packRequest.current;
    const packId = item.id;
    if (typeof packId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(packId)) {
      setPackDetailsState("failed");
      return;
    }
    setPackDetailsState("loading");
    try {
      const response = await fetch(`/api/console?view=evaluation-pack&packId=${encodeURIComponent(packId)}`, { cache: "no-store" });
      const value = record(await response.json().catch(() => null));
      if (!response.ok) throw new Error("unavailable");
      if (request !== packRequest.current) return;
      setPackDetails(value);
      setPackDetailsState("available");
    } catch {
      if (request !== packRequest.current) return;
      setPackDetailsState("failed");
    }
  }, []);

  const selectReport = useCallback(async (item: Row) => {
    setSelected(item);
    setReportDetails(null);
    const request = ++reportRequest.current;
    const reportId = item.id;
    if (typeof reportId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reportId)) {
      setReportDetailsState("failed");
      return;
    }
    setReportDetailsState("loading");
    try {
      const response = await fetch(`/api/console?view=evaluation-report&reportId=${encodeURIComponent(reportId)}`, { cache: "no-store" });
      const value = record(await response.json().catch(() => null));
      if (!response.ok) throw new Error("unavailable");
      if (request !== reportRequest.current) return;
      setReportDetails(value);
      setReportDetailsState("available");
    } catch {
      if (request !== reportRequest.current) return;
      setReportDetailsState("failed");
    }
  }, []);

  const selectRun = useCallback(async (item: Row) => {
    setSelected(item);
    setRunDetails(null);
    const request = ++runRequest.current;
    const runId = item.id;
    if (typeof runId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
      setRunDetailsState("failed");
      return;
    }
    setRunDetailsState("loading");
    try {
      const response = await fetch(`/api/console?view=evaluation-run&runId=${encodeURIComponent(runId)}`, { cache: "no-store" });
      const value = record(await response.json().catch(() => null));
      if (!response.ok) throw new Error("unavailable");
      if (request !== runRequest.current) return;
      setRunDetails(value);
      setRunDetailsState("available");
    } catch {
      if (request !== runRequest.current) return;
      setRunDetailsState("failed");
    }
  }, []);

  const table = (label: string, headers: string[], items: Row[], emptyTitle: string, emptyDetail: string, onSelect?: (item: Row) => void): ReactNode => (
    <DataTable label={label} className="table-frame evaluation-table">
      <table><thead><tr>{headers.map((header) => <th key={header}>{executionLabels[header] ?? headerLabel(header)}</th>)}</tr></thead>
        <tbody>{items.length ? items.map((item, index) => {
          const normalized = Object.fromEntries(Object.entries(item).map(([key, value]) => [key.toLowerCase(), value]));
          return <tr key={text(item.id, String(index))}>{headers.map((header, column) => {
            const value = normalized[header.toLowerCase().replaceAll(" ", "")];
            return <td key={header}>{column === 0 && onSelect ? <button type="button" className="evaluation-row-link" onClick={() => onSelect(item)}>{text(value)}</button> : header === "STATUS" ? statusLabel(value) : text(value, "—")}</td>;
          })}</tr>;
        }) : <tr><td colSpan={headers.length} className="empty-cell"><EmptyState title={emptyTitle} description={emptyDetail} /></td></tr>}</tbody>
      </table>
    </DataTable>
  );

  const dormant = (title: string, detail: string, stateLabel = "NOT MEASURED") => <section className="evaluation-dormant" aria-label={title}><span className="eyebrow">{stateLabel}</span><h3>{title}</h3><p>{detail}</p></section>;
  const domainCoverage = domainCoverageRows(data.packs, data.releases);
  const domainFamilyLabel = (key: string) => ({
    "coding-tool-schema": tr("Coding / tool / schema", "\u0627\u0644\u0628\u0631\u0645\u062c\u0629 / \u0627\u0644\u0623\u062f\u0648\u0627\u062a / \u0627\u0644\u0645\u062e\u0637\u0637"),
    "retrieval-memory": tr("Retrieval / memory", "\u0627\u0644\u0627\u0633\u062a\u0631\u062c\u0627\u0639 / \u0627\u0644\u0630\u0627\u0643\u0631\u0629"),
    "multilingual-arabic": tr("Multilingual / Arabic", "\u0645\u062a\u0639\u062f\u062f \u0627\u0644\u0644\u063a\u0627\u062a / \u0627\u0644\u0639\u0631\u0628\u064a\u0629"),
    "communication-sales": tr("Communication / sales", "\u0627\u0644\u062a\u0648\u0627\u0635\u0644 / \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a")
  } as Record<string, string>)[key] ?? key;
  const content = (() => {
    const kpis = <section className="evaluation-kpis" aria-label={tr("Evaluation registry counts", "إحصاءات سجل التقييم")}>
      {([["Packs", data.overview.packs], ["Releases", data.overview.releases], ["Campaigns", data.overview.campaigns], ["Runs", data.overview.runs], ["Reports", data.overview.reports], ["Candidates", data.overview.candidates]] as const).map(([label, value]) => <NumericInstrument key={label} label={tr(label, ({ Packs: "الحزم", Releases: "الإصدارات", Campaigns: "الحملات", Runs: "التشغيلات", Reports: "التقارير", Candidates: "المرشحون" } as Record<string, string>)[label] ?? label)} value={typeof value === "number" ? value : null} unit={tr("records", "سجلات")} state={typeof value === "number" ? "LIVE" : "UNAVAILABLE"} stateLabel={typeof value === "number" ? tr("RECORDED", "مسجل") : tr("UNAVAILABLE", "غير متاح")} source={tr("OIC registry", "سجل OIC")} size="SM" />)}
    </section>;
    const items = [
      { id: "command", label: tr("Command Center", "مركز القيادة"), content: <>{kpis}<div className="evaluation-panels"><section className="evaluation-panel"><header><span className="eyebrow">{tr("EXECUTION BOUNDARY", "حدود التنفيذ")}</span><b>{text(data.state.providerExecution, "PROVIDER STATE UNAVAILABLE")} · {text(data.state.runExecution, "RUN STATE UNAVAILABLE")}</b></header><p>{tr(`Evaluator adapters: ${Array.isArray(data.state.executionAdapters) ? data.state.executionAdapters.join(", ") || "none configured" : "state unavailable"}. Provider dispatch requires an active connection, a ready worker, and enforced OIC-6 admission; no dispatch is inferred from configuration alone.`, `محولات التقييم: ${Array.isArray(data.state.executionAdapters) ? data.state.executionAdapters.join(", ") || "غير مهيأة" : "الحالة غير متاحة"}. يتطلب إرسال المزوّد اتصالاً نشطاً وعاملاً جاهزاً وقبول OIC-6 مفروضاً؛ ولا يُستنتج الإرسال من الإعداد وحده.`)}</p><small>{tr("Worker", "العامل")}: {text(data.state.worker, "UNKNOWN")} · {tr("fresh attestation", "إفادة حديثة")}: {text(data.state.workerFresh, "UNKNOWN")}</small></section><section className="evaluation-panel"><header><span className="eyebrow">{tr("DECISION STATUS", "حالة القرار")}</span><b>{text(data.state.promotion, "HUMAN GATE REQUIRED")}</b></header><p>{tr("No universal score is calculated. Missing evidence remains unknown, and reports require comparable protocol-pinned evidence.", "لا تُحسب درجة موحدة. يظل الدليل المفقود غير معروف، وتتطلب التقارير أدلة قابلة للمقارنة ومثبتة بالبروتوكول.")}</p></section></div></> },
      { id: "benchmarks", label: tr("Benchmark Studio", "استوديو المعايير"), content: <div className="evaluation-panels">{table(tr("Benchmark pack revisions", "مراجعات حزم المعايير"), ["PACKKEY", "DOMAIN", "REVISION", "CASES", "SECURITYTIER", "STATUS"], data.packs, tr("No benchmark packs", "لا توجد حزم معايير"), tr("Register a rights-reviewed revision before publishing a release.", "سجل مراجعة حقوقها مدققة قبل نشر إصدار."), (item) => { void selectPack(item); })}{table(tr("Benchmark releases", "إصدارات المعايير"), ["PACKKEY", "REVISION", "RELEASETIER", "STATUS"], data.releases, tr("No benchmark releases", "لا توجد إصدارات معايير"), tr("Validated packs become immutable releases after registry review.", "تصبح الحزم المتحقَّق منها إصدارات ثابتة بعد مراجعة السجل."), setSelected)}</div> },
      { id: "campaigns", label: tr("Campaigns & Runs", "الحملات والتشغيلات"), content: <div className="evaluation-panels">{table(tr("Campaigns", "الحملات"), ["CAMPAIGNKEY", "STATUS"], data.campaigns, tr("No campaigns", "لا توجد حملات"), tr("A campaign groups runs pinned to one benchmark release.", "تجمع الحملة تشغيلات مثبتة على إصدار معيار واحد."), setSelected)}{table(tr("Evaluation runs", "تشغيلات التقييم"), ["TARGETCLASS", "STATUS", "PLANNEDDENOMINATOR"], data.runs, tr("No evaluation runs", "لا توجد تشغيلات تقييم"), tr("Every run needs an immutable protocol manifest and a preregistered trial denominator.", "يتطلب كل تشغيل بيان بروتوكول ثابتاً ومقام تجارب مسجلاً مسبقاً."), (run) => { void selectRun(run); })}</div> },
      { id: "comparison", label: tr("Comparison Lab", "مختبر المقارنة"), content: <div className="evaluation-panels">{table(tr("Run analysis reports", "تقارير تحليل التشغيلات"), ["TARGETCLASS", "STATUS", "VERIFICATIONTIER", "DECISIONELIGIBLE"], data.reports.map((report) => ({ ...report, targetClass: record(report.run).targetClass })), tr("No analysis reports", "لا توجد تقارير تحليل"), tr("Reports preserve missing measurements and stay descriptive until a comparable cohort and accepted claim exist.", "تحفظ التقارير القياسات المفقودة وتظل وصفية حتى تتوفر مجموعة قابلة للمقارنة وادعاء مقبول."), (report) => { void selectReport(report); })}{table(tr("Protocol comparisons", "مقارنات البروتوكول"), ["OUTCOME", "COMMONCASES", "DECISIONELIGIBLE"], data.comparisons, tr("No comparisons recorded", "لم تسجل مقارنات"), tr("Comparisons retain compatibility reasons and paired uncertainty. They never become decision eligible before the owner accepts the claim.", "تحتفظ المقارنات بأسباب التوافق وعدم اليقين المزدوج. ولا تصبح مؤهلة للقرار قبل اعتماد المالك للادعاء."), setSelected)}</div> },
      { id: "dna", label: tr("DNA Observatory", "مرصد DNA"), content: dormant(tr("No measured DNA traits", "لا توجد سمات DNA مقاسة"), tr("Contextual traits require eligible source reports, validated scales and uncertainty. Profile settings are never treated as measured capability.", "تتطلب السمات السياقية تقارير مصدر مؤهلة ومقاييس متحققة وعدم يقين. لا تُعامل إعدادات الملف كقدرة مقاسة.")) },
      { id: "evolution", label: tr("Evolution & Promotion", "التطور والترقية"), content: dormant(tr("No promotion verdicts", "لا توجد قرارات ترقية"), tr("Candidate lineage is reviewed separately from evaluation. Production promotion requires a fresh eligible PASS verdict, privileged human approval and binding compare-and-swap.", "تُراجع سلسلة المرشح منفصلة عن التقييم. تتطلب ترقية الإنتاج حكماً PASS مؤهلاً وحديثاً وموافقة بشرية مميزة ومقارنة وتبديل للربط."), tr("HUMAN GATE · NO AUTO-PROMOTION", "بوابة بشرية · لا ترقية تلقائية")) }
    ];
    return [
      ...items.slice(0, 2),
      { id: "domain-coverage", label: tr("Domain Coverage", "تغطية المجالات"), content: <section className="evaluation-domain-coverage" aria-label={tr("Required evaluation domain coverage", "تغطية مجالات التقييم المطلوبة")}>
        <p>{tr("Counts come from the scoped pack and release registry. A published release does not imply human validation or measured model quality.", "تأتي الأعداد من سجل الحزم والإصدارات ضمن النطاق. نشر الإصدار لا يعني تحققاً بشرياً أو جودة نموذج مقاسة.")}</p>
        <DataTable label={tr("Required domain families", "عائلات المجالات المطلوبة")} className="table-frame evaluation-table">
          <table><thead><tr><th>{tr("Domain family", "مجموعة المجال")}</th><th>{tr("Pack revisions", "مراجعات الحزم")}</th><th>{tr("Cases", "الحالات")}</th><th>{tr("Published releases", "الإصدارات المنشورة")}</th><th>{tr("Registry state", "حالة السجل")}</th></tr></thead>
            <tbody>{domainCoverage.map((row) => <tr key={row.key}><th scope="row">{domainFamilyLabel(row.key)}</th><td>{row.packRevisionCount}</td><td>{row.caseCount}</td><td>{row.publishedReleaseCount}</td><td>{statusLabel(row.status)}</td></tr>)}</tbody>
          </table>
        </DataTable>
      </section> },
      { id: "metrics", label: tr("Metrics", "المقاييس"), content: table(tr("Versioned metrics", "المقاييس ذات الإصدارات"), ["METRICKEY", "REVISION", "STATUS"], data.metrics, tr("No metric revisions", "لا توجد مراجعات مقاييس"), tr("Metrics are typed and versioned; measurements remain absent until eligible evidence exists.", "المقاييس محددة النوع والإصدار؛ وتبقى القياسات غائبة حتى يتوفر دليل مؤهل."), setSelected) },
      { id: "judges", label: tr("Judges", "المحكّمون"), content: table(tr("Versioned judges", "المحكّمون ذوو الإصدارات"), ["JUDGEKEY", "JUDGETYPE", "REVISION", "STATUS"], data.judges, tr("No judge revisions", "لا توجد مراجعات محكّمين"), tr("Judge methods, rubrics and calibration are pinned by revision.", "تُثبّت طرق التحكيم ومعاييره ومعايرته حسب الإصدار."), setSelected) },
      ...items.slice(2, 3),
      { id: "execution", label: tr("Execution Monitor", "مراقبة التنفيذ"), content: <div className="evaluation-panels">
        {table(tr("Durable work", "العمل المسجل"), ["STATUS", "ATTEMPTCOUNT", "MAXATTEMPTS", "LASTFAILURECLASS"], data.work, tr("No scheduled work", "لا يوجد عمل مجدول"), tr("Work appears after a protocol-pinned run is scheduled.", "يظهر العمل بعد جدولة تشغيل مرتبط ببروتوكول محدد."), setSelected)}
        {table(tr("Delivery ledger", "سجل التسليم"), ["EVENTTYPE", "STATUS", "ATTEMPTCOUNT", "LASTFAILURECLASS"], data.outbox, tr("No delivery events", "لا توجد أحداث تسليم"), tr("Run transitions will appear here when durable work begins.", "ستظهر انتقالات التشغيل هنا عند بدء العمل المسجل."), setSelected)}
      </div> },
      ...items.slice(3)
    ];
  })();

  return <section className="workspace-page evaluation-view" dir={ar ? "rtl" : "ltr"}>
    <header className="lab-page-heading"><div><span className="eyebrow">OIC-7 / EVALUATION FABRIC</span><h1>{tr("Evaluation Fabric", "منظومة التقييم")}</h1><p>{tr("Governed benchmark releases, protocol-pinned runs and evidence-backed model comparisons.", "إصدارات معايير محكومة وتشغيلات مثبتة بالبروتوكول ومقارنات نماذج قائمة على الأدلة.")}</p></div><ActionButton variant="secondary" onPress={() => void load()}>{tr("Refresh", "تحديث")}</ActionButton></header>
    <Packet76AccountingSummary value={data.packet76Accounting} locale={locale} navigate={navigate} variant="evaluation" openRun={(runId) => { const run = data.runs.find((item) => item.id === runId); if (run) void selectRun(run); }} />
    {state === "loading" && <LoadingState label={tr("Loading evaluation records", "جارٍ تحميل سجلات التقييم")} />}
    {state === "failed" && <ErrorState title={tr("Evaluation data unavailable", "بيانات التقييم غير متاحة")} description={tr("The scoped OIC evaluation service could not be loaded.", "تعذر تحميل خدمة تقييم OIC ضمن النطاق المحدد.")} />}
    {state === "available" && <WorkspaceTabs label={tr("Evaluation workspaces", "مساحات عمل التقييم")} items={content} selected={selectedTab} onSelectionChange={setSelectedTab} dir={ar ? "rtl" : "ltr"} />}
    <Inspector open={selected !== null} onClose={() => { packRequest.current += 1; setSelected(null); setPackDetails(null); setPackDetailsState("idle"); }} title={text(selected?.packKey ?? selected?.campaignKey ?? selected?.metricKey ?? selected?.judgeKey ?? selected?.targetClass ?? selected?.id, tr("Evaluation record", "سجل تقييم"))} description={tr("Bounded registry metadata. Protected case content is not returned to the operator browser.", "بيانات سجل محدودة. لا يعاد محتوى الحالات المحمية إلى متصفح المشغل.")} closeLabel={tr("Close inspector", "إغلاق لوحة الفحص")} dir={ar ? "rtl" : "ltr"}>
      {selected && <dl className="evaluation-record-details">{Object.entries(selected).filter(([key, value]) => !["inputArtifact", "oracle", "manifest", "caseManifest", "_count"].includes(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")).map(([key, value]) => <div key={key}><dt>{headerLabel(key.toUpperCase())}</dt><dd>{text(value)}</dd></div>)}</dl>}
      {typeof selected?.plannedDenominator === "number" && <section className="evaluation-review" aria-label={tr("Provider and OIC-6 run accounting", "حساب المزوّد وOIC-6 للتشغيل")}>
        <h3>{tr("Provider & OIC-6 accounting", "حساب المزوّد وOIC-6")}</h3>
        {runDetailsState === "loading" && <LoadingState label={tr("Loading canonical run accounting", "جار تحميل حساب التشغيل من المصدر المعتمد")} />}
        {runDetailsState === "failed" && <ErrorState title={tr("Run accounting unavailable", "حساب التشغيل غير متاح")} description={tr("The scoped canonical run readback failed; accounting is not inferred.", "تعذرت قراءة التشغيل من المصدر ضمن النطاق؛ لم يُستنتج الحساب.")} />}
        {runDetailsState === "available" && runDetails && (() => {
          const accounting = record(runDetails.accounting);
          const oiu = record(accounting.oiu);
          const entries = Object.entries(record(accounting.providerCosts));
          const attempts = rows(accounting.attempts);
          const dispatches = attempts.flatMap((attempt) => rows(attempt.providerAttempts).map((provider) => ({ attempt, provider })));
          const tokenLabel = (value: unknown) => typeof value === "number" ? String(value) : tr("Unknown", "غير معروف");
          return <>
            <dl className="evaluation-record-details">
              <div><dt>{tr("Accounting state", "حالة الحساب")}</dt><dd>{text(accounting.state, "UNKNOWN")}</dd></div>
              <div><dt>{tr("Provider dispatches", "إرسالات المزوّد")}</dt><dd>{text(accounting.dispatchCount, "UNKNOWN")}</dd></div>
              <div><dt>{tr("Input tokens", "رموز الإدخال")}</dt><dd>{tokenLabel(accounting.inputTokens)}</dd></div>
              <div><dt>{tr("Output tokens", "رموز الإخراج")}</dt><dd>{tokenLabel(accounting.outputTokens)}</dd></div>
              <div><dt>{tr("Provider cost", "تكلفة المزوّد")}</dt><dd>{entries.length ? entries.map(([currency, detail]) => { const cost = record(detail); return `${text(cost.amount, tr("Unknown", "غير معروف"))} ${currency} · ${text(cost.state)}`; }).join("; ") : tr("No assessed provider cost", "لا توجد تكلفة مزوّد مُقيّمة")}</dd></div>
              <div><dt>{tr("OIU reserved", "OIU المحجوزة")}</dt><dd><OiuValue value={typeof oiu.reserved === "string" ? oiu.reserved : null} locale={ar ? "ar" : "en"} /></dd></div>
              <div><dt>{tr("OIU consumed", "OIU المستهلكة")}</dt><dd><OiuValue value={typeof oiu.consumed === "string" ? oiu.consumed : null} locale={ar ? "ar" : "en"} /></dd></div>
              <div><dt>{tr("OIU released", "OIU المحررة")}</dt><dd><OiuValue value={typeof oiu.released === "string" ? oiu.released : null} locale={ar ? "ar" : "en"} /> · {text(oiu.state, "UNKNOWN")}</dd></div>
            </dl>
            <div className="table-frame"><table><thead><tr>{[tr("Case execution / repetition", "تنفيذ الحالة / التكرار"), tr("Provider / model", "المزوّد / النموذج"), tr("Binding", "الربط"), tr("Dispatch state", "حالة الإرسال"), tr("Tokens in / out", "رموز الإدخال / الإخراج"), tr("Cost / OIU", "التكلفة / OIU")].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>
              {dispatches.map(({ attempt, provider }) => {
                const usage = rows(provider.usage);
                const dimensions = record(usage[0]?.dimensions);
                const costs = usage.flatMap((event) => rows(event.costs));
                const assessed = costs.map((cost) => `${text(cost.amount, tr("Unknown", "غير معروف"))} ${text(cost.currency)}`);
                const oiuValues = usage.flatMap((event) => rows(event.oiu));
                return <tr key={text(provider.id)}><td>{text(attempt.caseExecutionId)} · {text(attempt.repetition, "UNKNOWN")}</td><td>{text(canonicalProviderLabel(provider.provider, provider.model))} / {text(provider.model)}</td><td>{text(provider.bindingId, "UNKNOWN")}</td><td>{text(provider.status)} / {text(provider.usageStatus)}</td><td>{tokenLabel(dimensions.inputTokens)} / {tokenLabel(dimensions.outputTokens)}</td><td>{assessed.join(", ") || tr("Unknown", "غير معروف")} · {oiuValues.length ? oiuValues.map((item, index) => <span key={index}><OiuValue value={typeof item.amount === "string" ? item.amount : null} locale={ar ? "ar" : "en"} /></span>) : <OiuValue value={null} locale={ar ? "ar" : "en"} />}</td></tr>;
              })}
              {!dispatches.length && <tr><td colSpan={6}>{tr("No provider dispatch is linked to this run. Missing dispatch data stays unknown.", "لا يرتبط بهذا التشغيل إرسال مزوّد. تظل بيانات الإرسال المفقودة غير معروفة.")}</td></tr>}
            </tbody></table></div>
            <small>{tr("Read-only projection from OIC provider attempts, usage receipts, economics assessments and OIC-6 admission postings. It does not calculate or infer missing usage.", "عرض للقراءة فقط من محاولات المزوّد وإيصالات الاستخدام والتقييمات الاقتصادية وترحيلات قبول OIC-6. لا يحسب أو يستنتج الاستخدام المفقود.")}</small>
          </>;
        })()}
      </section>}
      {typeof selected?.packKey === "string" && <section className="evaluation-review" aria-label={tr("Coverage and rights review", "مراجعة التغطية والحقوق")}>
        <h3>{tr("Coverage and rights review", "مراجعة التغطية والحقوق")}</h3>
        {packDetailsState === "loading" && <LoadingState label={tr("Loading case rights and coverage", "جارٍ تحميل حقوق الحالات والتغطية")} />}
        {packDetailsState === "failed" && <ErrorState title={tr("Pack review unavailable", "مراجعة الحزمة غير متاحة")} description={tr("Scoped rights and coverage metadata could not be loaded.", "تعذر تحميل بيانات الحقوق والتغطية ضمن النطاق المحدد.")} />}
        {packDetailsState === "available" && packDetails && <>
          {typeof record(packDetails.validationJob).id === "string" && <article className="evaluation-validation-job">
            <h4>{tr("Latest compiler validation", "\u0622\u062e\u0631 \u062a\u062d\u0642\u0642 \u0644\u0644\u0645\u062c\u0645\u0651\u0639")}</h4>
            <dl className="evaluation-record-details">
              <div><dt>{tr("Status", "\u0627\u0644\u062d\u0627\u0644\u0629")}</dt><dd>{statusLabel(record(packDetails.validationJob).status)}</dd></div>
              <div><dt>{tr("Compiler", "\u0627\u0644\u0645\u062c\u0645\u0651\u0639")}</dt><dd>{text(record(record(packDetails.validationJob).report).compilerKey)} / {text(record(record(packDetails.validationJob).report).compilerRevision)}</dd></div>
              <div><dt>{tr("Artifact references checked", "\u0645\u0631\u0627\u062c\u0639 \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u062a\u062d\u0642\u0642 \u0645\u0646\u0647\u0627")}</dt><dd>{text(record(record(packDetails.validationJob).report).artifactReferencesChecked, "0")}</dd></div>
              {typeof record(record(packDetails.validationJob).report).failureCode === "string" && <div><dt>{tr("Failure code", "\u0631\u0645\u0632 \u0627\u0644\u0625\u062e\u0641\u0627\u0642")}</dt><dd>{text(record(record(packDetails.validationJob).report).failureCode)}</dd></div>}
              {strings(record(record(packDetails.validationJob).report).reasons).length > 0 && <div><dt>{tr("Validation findings", "\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u062a\u062d\u0642\u0642")}</dt><dd>{strings(record(record(packDetails.validationJob).report).reasons).join(", ")}</dd></div>}
            </dl>
          </article>}
          {typeof record(packDetails.importedFrom).adapterKey === "string" && <article className="evaluation-import-provenance">
            <h4>{tr("External import provenance", "\u0628\u064a\u0627\u0646\u0627\u062a \u0645\u0635\u062f\u0631 \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f")}</h4>
            <dl className="evaluation-record-details">
              <div><dt>{tr("Adapter", "\u0627\u0644\u0645\u062d\u0648\u0644")}</dt><dd>{text(record(packDetails.importedFrom).adapterKey)} / {text(record(packDetails.importedFrom).adapterRevision)}</dd></div>
              <div><dt>{tr("Upstream license", "\u062a\u0631\u062e\u064a\u0635 \u0627\u0644\u0645\u0635\u062f\u0631")}</dt><dd>{text(record(packDetails.importedFrom).upstreamLicense)}</dd></div>
              <div><dt>{tr("Source reference", "\u0645\u0631\u062c\u0639 \u0627\u0644\u0645\u0635\u062f\u0631")}</dt><dd>{text(record(packDetails.importedFrom).sourceRef)}</dd></div>
              <div><dt>{tr("Permitted uses", "\u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645\u0627\u062a \u0627\u0644\u0645\u0633\u0645\u0648\u062d \u0628\u0647\u0627")}</dt><dd>{strings(record(packDetails.importedFrom).permittedUses).join(", ")}</dd></div>
              <div><dt>{tr("Source checksum", "\u0628\u0635\u0645\u0629 \u0627\u0644\u0645\u0635\u062f\u0631")}</dt><dd>{text(record(packDetails.importedFrom).sourceChecksum)}</dd></div>
              <div><dt>{tr("Transform map digest", "\u0628\u0635\u0645\u0629 \u062e\u0631\u064a\u0637\u0629 \u0627\u0644\u062a\u062d\u0648\u064a\u0644")}</dt><dd>{text(record(packDetails.importedFrom).transformMapDigest)}</dd></div>
              <div><dt>{tr("Revocation reference", "\u0645\u0631\u062c\u0639 \u0627\u0644\u0625\u0644\u063a\u0627\u0621")}</dt><dd>{text(record(packDetails.importedFrom).revocationRef)}</dd></div>
            </dl>
          </article>}
          <div className="evaluation-coverage-summary">
            <div><span>{tr("Cases", "الحالات")}</span><strong>{text(record(packDetails.coverage).caseCount, "0")}</strong></div>
            <div><span>{tr("Rights reviewed", "الحقوق التي تمت مراجعتها")}</span><strong>{text(record(packDetails.coverage).rightsReviewed, "0")}</strong></div>
            <div><span>{tr("Missing required slices", "شرائح مطلوبة مفقودة")}</span><strong>{strings(record(packDetails.coverage).missingRequiredSlices).length}</strong></div>
          </div>
          {strings(record(packDetails.coverage).missingRequiredSlices).length > 0 && <p className="evaluation-missing-slices">{tr("Missing:", "مفقود:")} {strings(record(packDetails.coverage).missingRequiredSlices).join(", ")}</p>}
          <div className="evaluation-coverage-groups">
            {([["Slices", "الشرائح", "slices"], ["Task types", "أنواع المهام", "taskTypes"], ["Languages", "اللغات", "languages"], ["Exposure tiers", "مستويات الإتاحة", "exposureTiers"]] as const).map(([en, arabic, key]) => <section key={key}><h4>{tr(en, arabic)}</h4><ul>{Object.entries(record(record(packDetails.coverage)[key])).map(([label, count]) => <li key={label}><span>{label}</span><b>{text(count)}</b></li>)}</ul></section>)}
          </div>
          {rows(packDetails.cases).map((caseRow) => {
            const rights = record(caseRow.rights);
            const caseSlices = strings(caseRow.slices);
            const uses = strings(rights.permittedUses);
            return <article className="evaluation-case-review" key={text(caseRow.id, text(caseRow.caseKey))}>
              <header><strong>{text(caseRow.caseKey, tr("Case", "حالة"))}</strong><span>{statusLabel(caseRow.status)}</span></header>
              <dl className="evaluation-record-details">
                <div><dt>{tr("Task type", "نوع المهمة")}</dt><dd>{text(caseRow.taskType)}</dd></div>
                <div><dt>{tr("Language", "اللغة")}</dt><dd>{text(caseRow.language)}</dd></div>
                <div><dt>{tr("Slices", "الشرائح")}</dt><dd>{caseSlices.join(", ") || "—"}</dd></div>
                <div><dt>{tr("Exposure tier", "مستوى الإتاحة")}</dt><dd>{text(caseRow.exposureTier)}</dd></div>
                <div><dt>{tr("Rights status", "حالة الحقوق")}</dt><dd>{rights.confirmed === true ? tr("Confirmed", "مؤكدة") : tr("Unconfirmed", "غير مؤكدة")}</dd></div>
                <div><dt>{tr("License", "الترخيص")}</dt><dd>{text(rights.license)}</dd></div>
                <div><dt>{tr("Source reference", "مرجع المصدر")}</dt><dd>{text(rights.sourceRef)}</dd></div>
                <div><dt>{tr("Permitted uses", "الاستخدامات المسموح بها")}</dt><dd>{uses.join(", ") || "—"}</dd></div>
                <div><dt>{tr("Reviewed by", "تمت المراجعة بواسطة")}</dt><dd>{text(rights.reviewedBy)}</dd></div>
                <div><dt>{tr("Reviewed at", "تاريخ المراجعة")}</dt><dd>{text(rights.reviewedAt)}</dd></div>
              </dl>
            </article>;
          })}
          <p className="evaluation-review-note">{tr("This inspector shows registry provenance and coverage only; protected inputs and oracle answers stay sealed.", "تعرض لوحة الفحص مصدر البيانات والتغطية فقط؛ وتظل المدخلات المحمية وإجابات المرجع مختومة.")}</p>
        </>}
      </section>}
      {typeof selected?.analysisRevision === "number" && <section className="evaluation-review" aria-label={tr("Report evidence and missingness", "دليل التقرير والبيانات المفقودة")}>
        <h3>{tr("Report evidence and missingness", "دليل التقرير والبيانات المفقودة")}</h3>
        {reportDetailsState === "loading" && <LoadingState label={tr("Loading report summary", "جار تحميل ملخص التقرير")} />}
        {reportDetailsState === "failed" && <ErrorState title={tr("Report unavailable", "التقرير غير متاح")} description={tr("Scoped report evidence could not be loaded.", "تعذر تحميل دليل التقرير ضمن النطاق المحدد.")} />}
        {reportDetailsState === "available" && reportDetails && (() => {
          const analysis = record(record(reportDetails.summary).analysis);
          const completeness = record(analysis.completeness);
          const metrics = rows(analysis.metrics);
          return <>
            <dl className="evaluation-record-details">
              <div><dt>{tr("Report status", "حالة التقرير")}</dt><dd>{statusLabel(analysis.status)}</dd></div>
              <div><dt>{tr("Planned / terminal", "المخطط / النهائي")}</dt><dd>{text(completeness.terminalCases, "0")} / {text(completeness.plannedCases, "0")}</dd></div>
              <div><dt>{tr("Decision eligible", "مؤهل للقرار")}</dt><dd>{text(reportDetails.decisionEligible, "false")}</dd></div>
              {strings(analysis.limitations).length > 0 && <div><dt>{tr("Limitations", "القيود")}</dt><dd>{strings(analysis.limitations).join(", ")}</dd></div>}
            </dl>
            {metrics.length > 0 ? table(tr("Typed measurements", "القياسات المحددة النوع"), ["METRICKEY", "AVAILABILITY", "MEASUREDN", "MISSINGN", "UNIT"], metrics, tr("No measurements", "لا توجد قياسات"), tr("Unavailable and unsupported values remain explicit.", "تظل القيم غير المتاحة وغير المدعومة صريحة.")) : <EmptyState title={tr("No preregistered metrics", "لا توجد مقاييس مسجلة مسبقاً")} description={tr("No score was inferred from this run.", "لم تُستنتج درجة من هذا التشغيل.")} />}
          </>;
        })()}
      </section>}
    </Inspector>
    <footer className="evaluation-footer">{tr("Evidence coverage and decision eligibility are reported independently; no quality value is synthesized by this workspace.", "يُعرض اكتمال الأدلة وأهلية القرار كلٌ على حدة؛ ولا تنشئ مساحة العمل هذه قيمة جودة اصطناعية.")}</footer>
  </section>;
}
