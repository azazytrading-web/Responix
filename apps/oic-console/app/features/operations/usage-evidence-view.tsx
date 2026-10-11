"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale, View } from "../../i18n";
import { ErrorState, LoadingState } from "../../components/oic-primitives";
import { ActionButton, Inspector, SearchableSelect, TextInput } from "../../components/interface";
import { EconomicFlowStrip } from "./economic-flow-strip";

type UsageRow = Record<string, unknown>;
type Page = { items: UsageRow[]; nextCursor: string | null };
const rows = (value: unknown): UsageRow[] => value && typeof value === "object" && !Array.isArray(value) && Array.isArray((value as Page).items)
  ? (value as Page).items.filter((item): item is UsageRow => !!item && typeof item === "object" && !Array.isArray(item))
  : [];
const objectFields = (value: unknown): UsageRow => value && typeof value === "object" && !Array.isArray(value) ? value as UsageRow : {};
const text = (value: unknown, fallback = "â€”") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;

export function UsageEvidenceView({ view, locale, navigate }: { view: View; locale: Locale; navigate: (view: View, entityId?: string) => void }) {
  const [attempts, setAttempts] = useState<UsageRow[]>([]);
  const [events, setEvents] = useState<UsageRow[]>([]);
  const [costAssessments, setCostAssessments] = useState<UsageRow[]>([]);
  const [oiuAssessments, setOiuAssessments] = useState<UsageRow[]>([]);
  const [ratedEvents, setRatedEvents] = useState<UsageRow[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "available" | "failed">("idle");
  const [selected, setSelected] = useState<UsageRow | null>(null);
  const [query, setQuery] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("usageQ") ?? "");
  const [provider, setProvider] = useState(() => typeof window === "undefined" ? "*" : new URLSearchParams(window.location.search).get("usageProvider") ?? "*");
  const [usageState, setUsageState] = useState(() => typeof window === "undefined" ? "*" : new URLSearchParams(window.location.search).get("usageState") ?? "*");
  const ar = locale === "ar";
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const load = useCallback(async () => {
    setState("loading");
    try {
      const [attemptResponse, eventResponse, economicsResponse, ratingResponse] = await Promise.all([
        fetch("/api/console?view=usage-attempts&limit=50", { cache: "no-store" }),
        fetch("/api/console?view=usage-events&limit=50", { cache: "no-store" }),
        fetch("/api/console?view=economics", { cache: "no-store" }).catch(() => null),
        fetch("/api/console?view=rating", { cache: "no-store" }).catch(() => null)
      ]);
      if (!attemptResponse.ok || !eventResponse.ok) throw new Error("usage evidence unavailable");
      const attemptBody: unknown = await attemptResponse.json();
      const eventBody: unknown = await eventResponse.json();
      setAttempts(rows(attemptBody));
      setEvents(rows(eventBody));
      const economicsBody = objectFields(economicsResponse?.ok ? await economicsResponse.json().catch(() => null) : null);
      const ratingBody = objectFields(ratingResponse?.ok ? await ratingResponse.json().catch(() => null) : null);
      setCostAssessments(rows(economicsBody.costs));
      setOiuAssessments(rows(economicsBody.oiu));
      setRatedEvents(rows(ratingBody.rated));
      setState("available");
    } catch {
      setAttempts([]);
      setEvents([]);
      setCostAssessments([]);
      setOiuAssessments([]);
      setRatedEvents([]);
      setState("failed");
    }
  }, []);
  useEffect(() => { if (view === "usage") void load(); }, [view, load]);
  useEffect(() => {
    if (view !== "usage" || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (query) url.searchParams.set("usageQ", query); else url.searchParams.delete("usageQ");
    if (provider !== "*") url.searchParams.set("usageProvider", provider); else url.searchParams.delete("usageProvider");
    if (usageState !== "*") url.searchParams.set("usageState", usageState); else url.searchParams.delete("usageState");
    window.history.replaceState({}, "", url);
  }, [view, query, provider, usageState]);
  if (view !== "usage") return null;

  const selectedIsEvent = !!selected && "normalizedDimensions" in selected;
  const selectedEventId = selectedIsEvent ? text(selected?.id, "") : "";
  const hasCostRelationship = costAssessments.some((item) => item.usageEventId === selectedEventId);
  const hasOiuRelationship = oiuAssessments.some((item) => item.usageEventId === selectedEventId);
  const hasRatingRelationship = ratedEvents.some((item) => item.usageEventId === selectedEventId);
  const providers = Array.from(new Set([...attempts, ...events].map((row) => text(row.providerKey, "")).filter(Boolean))).sort();
  const providerOptions = [{ id: "*", label: tr("All providers", "كل المزوّدين") }, ...providers.map((id) => ({ id, label: id }))];
  const stateOptions = [{ id: "*", label: tr("All states", "كل الحالات") }, ...Array.from(new Set(attempts.map((row) => text(row.usageStatus, "")).filter(Boolean))).sort().map((id) => ({ id, label: id }))];
  const visibleAttempts = attempts.filter((row) => {
    if (provider !== "*" && row.providerKey !== provider) return false;
    if (usageState !== "*" && row.usageStatus !== usageState) return false;
    const needle = query.trim().toLocaleLowerCase(ar ? "ar" : "en");
    return !needle || [row.id, row.providerKey, row.upstreamModelId, row.status, row.usageStatus, row.traceId].map((item) => text(item, "")).join(" ").toLocaleLowerCase(ar ? "ar" : "en").includes(needle);
  });
  const visibleEvents = events.filter((row) => {
    if (provider !== "*" && row.providerKey !== provider) return false;
    const needle = query.trim().toLocaleLowerCase(ar ? "ar" : "en");
    return !needle || [row.id, row.providerKey, row.transportProfile, row.receiptSequence, JSON.stringify(row.normalizedDimensions ?? {}), row.sourceDigest].map((item) => text(item, "")).join(" ").toLocaleLowerCase(ar ? "ar" : "en").includes(needle);
  });
  const partialUsageCount = events.filter((item) => item.usageStatus === "PARTIAL").length;
  const latestRecorded = events.map((item) => item.recordedAt).filter((item): item is string => typeof item === "string" && Number.isFinite(Date.parse(item))).sort().at(-1);
  const unknownAttempts = attempts.filter((item) => item.usageStatus === "UNKNOWN" || item.status === "DISPATCH_UNKNOWN");
  const receiptDimensionCount = events.filter((item) => item.normalizedDimensions && typeof item.normalizedDimensions === "object" && !Array.isArray(item.normalizedDimensions) && Object.keys(item.normalizedDimensions).length > 0).length;
  const values: Array<[string, unknown]> = selected ? selectedIsEvent ? [
    [tr("Evidence ID", "معرّف الدليل"), selected.id],
    [tr("Provider attempt", "محاولة المزوّد"), selected.providerAttemptId],
    [tr("Provider", "المزوّد"), selected.providerKey],
    [tr("Model identity", "هوية النموذج"), selected.upstreamModelId ?? objectFields(selected.providerAttempt).upstreamModelId],
    [tr("Provider connection", "اتصال المزوّد"), selected.providerConnectionId ?? selected.connectionId ?? objectFields(selected.providerAttempt).connectionId],
    [tr("Execution ID", "معرّف التنفيذ"), selected.executionId],
    [tr("Transport", "النقل"), selected.transportProfile],
    [tr("Receipt sequence", "تسلسل الإيصال"), selected.receiptSequence],
    [tr("Evidence digest", "بصمة الدليل"), selected.sourceDigest],
    [tr("Normalization revision", "مراجعة التطبيع"), selected.normalizationRevision],
    [tr("Raw provider dimensions", "أبعاد استخدام المزوّد"), JSON.stringify(selected.rawDimensions ?? {})],
    [tr("Normalized dimensions", "الأبعاد الموحّدة"), JSON.stringify(selected.normalizedDimensions ?? {})],
    [tr("Unknown fields", "حقول غير معروفة"), selected.unknownDimensions ? JSON.stringify(selected.unknownDimensions) : undefined],
    [tr("Evidence state", "حالة الدليل"), selected.usageStatus ?? (selected.normalizedDimensions ? "NORMALIZED" : "UNKNOWN")],
    [tr("Occurred at", "وقت الحدوث"), selected.occurredAt],
    [tr("Recorded at", "وقت التسجيل"), selected.recordedAt]
  ] : [
    [tr("Attempt ID", "معرّف المحاولة"), selected.id],
    [tr("State", "الحالة"), selected.status],
    [tr("Usage evidence", "دليل الاستخدام"), selected.usageStatus],
    [tr("Provider", "المزوّد"), selected.providerKey],
    [tr("Upstream model", "النموذج المزوّد"), selected.upstreamModelId],
    [tr("Transport", "النقل"), selected.transportProfile],
    [tr("Trace", "التتبّع"), selected.traceId],
    [tr("Started", "بدأت"), selected.startedAt],
    [tr("Completed", "اكتملت"), selected.completedAt],
    [tr("Safe failure code", "رمز الفشل"), selected.safeErrorCode],
    [tr("Usage receipts", "إيصالات الاستخدام"), (selected._count as UsageRow | undefined)?.usageEvents]
  ] : [];

  return <section className="panel usage-evidence" aria-labelledby="usage-evidence-title" dir={ar ? "rtl" : "ltr"}>
    <header className="panel-heading">
      <div><span className="eyebrow">{tr("OIC-6.1 / METERING OBSERVATORY", "OIC-6.1 / مرصد القياس")}</span><h2 id="usage-evidence-title">{tr("Metering Observatory", "مرصد القياس")}</h2><p>{tr("Follow provider attempts through reported usage receipts. Missing dimensions remain unknown; no cost or customer charge is inferred.", "تتبّع محاولات المزوّد وإيصالات الاستخدام المبلّغ عنها. تظل الأبعاد المفقودة غير معروفة، ولا تُستنتج تكلفة أو رسوم عميل.")}</p></div>
      <ActionButton variant="secondary" onPress={() => void load()}>{tr("Refresh evidence", "تحديث الأدلة")}</ActionButton>
    </header>
    <EconomicFlowStrip current="usage" locale={locale} navigate={navigate} states={{ usage: events.length ? "AVAILABLE" : attempts.length ? "PARTIAL" : "UNKNOWN", provider: "UNKNOWN", oiu: "UNKNOWN", admission: "UNKNOWN", rating: "UNKNOWN" }} />
    {state === "loading" && <LoadingState label={tr("Loading source evidenceâ€¦", "جارٍ تحميل أدلة المصدر…")} />}
    {state === "failed" && <ErrorState title={tr("Evidence unavailable", "الأدلة غير متاحة")} description={tr("The scoped OIC usage evidence source could not be read.", "تعذرت قراءة مصدر أدلة الاستخدام ضمن النطاق.")} action={<ActionButton variant="secondary" onPress={() => void load()}>{tr("Try again", "إعادة المحاولة")}</ActionButton>} />}
    {state === "available" && <>
      <div className="usage-investigation-tools" aria-label={tr("Evidence investigation filters", "مرشحات استقصاء الأدلة")}>
        <TextInput label={tr("Search captured evidence", "ابحث في الأدلة المسجلة")} type="search" value={query} onChange={setQuery} placeholder={tr("Provider, model, trace, digestâ€¦", "المزوّد أو النموذج أو التتبّع أو البصمة…")} dir={ar ? "rtl" : "ltr"} />
        <SearchableSelect label={tr("Provider", "المزوّد")} value={provider} onChange={setProvider} options={providerOptions} placeholder={tr("All providers", "كل المزوّدين")} searchLabel={tr("Search providers", "ابحث عن مزوّد")} emptyLabel={tr("No matching provider", "لا يوجد مزوّد مطابق")} locale={locale} dir={ar ? "rtl" : "ltr"} />
        <SearchableSelect label={tr("Usage state", "حالة الاستخدام")} value={usageState} onChange={setUsageState} options={stateOptions} placeholder={tr("All states", "كل الحالات")} searchLabel={tr("Search states", "ابحث عن حالة")} emptyLabel={tr("No matching state", "لا توجد حالة مطابقة")} locale={locale} dir={ar ? "rtl" : "ltr"} />
        <small>{tr("Provider attempt and receipt records · bounded latest page · read only", "سجلات محاولات المزوّد والإيصالات · أحدث صفحة محدودة · للقراءة فقط")}</small>
      </div>
      <div className="metrics-grid">
        <article className="metric-card"><p>{tr("Provider attempts", "محاولات المزوّد")}</p><strong>{attempts.length || "â€”"}</strong><small>{tr("latest bounded page", "أحدث صفحة محدودة")}</small></article>
        <article className="metric-card"><p>{tr("Usage receipts", "إيصالات الاستخدام")}</p><strong>{events.length || "â€”"}</strong><small>{tr("source-backed observations", "ملاحظات موثقة بالمصدر")}</small></article>
        <article className="metric-card"><p>{tr("Unknown usage", "استخدام غير معروف")}</p><strong>{attempts.length ? unknownAttempts.length : "â€”"}</strong><small>{tr("not treated as zero", "لا يُعامل كصفر")}</small></article>
        <article className="metric-card"><p>{tr("Partial evidence", "الدليل الجزئي")}</p><strong>{events.length ? partialUsageCount : "â€”"}</strong><small>{tr("source-reported partial status", "حالة جزئية مبلّغ عنها من المصدر")}</small></article>
        <article className="metric-card"><p>{tr("Latest receipt", "أحدث إيصال")}</p><strong className="usage-latest-time">{latestRecorded ?? "â€”"}</strong><small>{tr("recorded time", "وقت التسجيل")}</small></article>
      </div>
      <section className="usage-evidence-pipeline" aria-label={tr("Usage evidence pipeline", "مسار أدلة الاستخدام")}>
        {[{ label: tr("Execution", "التنفيذ"), value: attempts.filter((item) => typeof item.executionId === "string").length, available: attempts.length > 0 }, { label: tr("Provider attempt", "محاولة المزوّد"), value: attempts.length, available: attempts.length > 0 }, { label: tr("Provider response", "استجابة المزوّد"), value: attempts.filter((item) => Boolean(item.completedAt || item.safeErrorCode)).length, available: attempts.length > 0 }, { label: tr("Usage receipt", "إيصال الاستخدام"), value: events.length, available: events.length > 0 }, { label: tr("Normalized dimensions", "الأبعاد الموحّدة"), value: receiptDimensionCount, available: events.length > 0 }].map((stage, index, stages) => <div className="usage-pipeline-stage" key={stage.label}><span className="eyebrow">{String(index + 1).padStart(2, "0")} / {stage.label}</span><strong>{stage.available ? stage.value : "â€”"}</strong><small>{stage.available ? tr("source observed", "مرصود بالمصدر") : tr("not present in bounded source page", "غير موجود في صفحة المصدر المحدودة")}</small>{index < stages.length - 1 && <span className="usage-pipeline-arrow" aria-hidden="true">â†’</span>}</div>)}
        {unknownAttempts.length > 0 && <div className="usage-liability-branch"><span className="eyebrow">{tr("UNKNOWN / LIABILITY PENDING", "غير معروف / التزام قيد الانتظار")}</span><strong>{unknownAttempts.length}</strong><small>{tr("uncertain source attempts; no amount inferred", "محاولات مصدر غير مؤكدة؛ لا يُستنتج مبلغ")}</small></div>}
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>{tr("Provider attempts", "محاولات المزوّد")}</h3><p>{tr("Execution attempts can remain uncertain when provider dispatch or usage cannot be confirmed.", "قد تبقى حالة المحاولة غير مؤكدة عندما يتعذر تأكيد الإرسال أو الاستخدام.")}</p></div></div>
        <div className="table-frame"><table><thead><tr>{[tr("Started", "بدأت"), tr("Provider", "المزوّد"), tr("Upstream model", "النموذج المزوّد"), tr("State", "الحالة"), tr("Usage", "الاستخدام"), tr("Evidence", "الأدلة")].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>
          {visibleAttempts.map((item) => <tr key={text(item.id)}><td><ActionButton variant="quiet" onPress={() => setSelected(item)}>{text(item.startedAt)}</ActionButton></td><td>{text(item.providerKey)}</td><td>{text(item.upstreamModelId)}</td><td>{text(item.status)}</td><td>{text(item.usageStatus)}</td><td>{text((item._count as UsageRow | undefined)?.usageEvents)}</td></tr>)}
          {!attempts.length && <tr><td colSpan={6}>{tr("No provider attempts have been captured.", "لم تُسجّل محاولات مزوّد بعد.")}</td></tr>}
        </tbody></table></div>
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>{tr("Provider usage receipts", "إيصالات استخدام المزوّد")}</h3><p>{tr("Only allowlisted numeric usage fields are retained; raw provider responses and credentials are never stored here.", "تُحفظ حقول الاستخدام الرقمية المسموح بها فقط؛ لا تُخزّن استجابات المزوّد الخام أو بيانات الاعتماد هنا.")}</p></div></div>
        <div className="table-frame"><table><thead><tr>{[tr("Recorded", "وقت التسجيل"), tr("Provider", "المزوّد"), tr("Transport", "النقل"), tr("Sequence", "التسلسل"), tr("Normalized usage", "الاستخدام الموحّد"), tr("Source digest", "بصمة المصدر")].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>
          {visibleEvents.map((item) => <tr key={text(item.id)}><td><ActionButton variant="quiet" onPress={() => setSelected(item)}>{text(item.recordedAt)}</ActionButton></td><td>{text(item.providerKey)}</td><td>{text(item.transportProfile)}</td><td>{text(item.receiptSequence)}</td><td><code>{JSON.stringify(item.normalizedDimensions ?? {})}</code></td><td><code>{text(item.sourceDigest).slice(0, 12)}â€¦</code></td></tr>)}
          {!events.length && <tr><td colSpan={6}>{tr("No provider usage receipts have been reported.", "لم يبلّغ المزوّد عن إيصالات استخدام بعد.")}</td></tr>}
        </tbody></table></div>
      </section>
      {!attempts.length && !events.length && <section className="usage-empty-state"><span className="eyebrow">{tr("NO SOURCE EVIDENCE", "لا توجد أدلة مصدر")}</span><h3>{tr("No provider usage evidence has been captured yet.", "لم يتم تسجيل دليل استخدام من المزوّد بعد.")}</h3><p>{tr("A runtime execution can produce reportable provider usage. Missing usage is not inferred; an uncertain dispatch can leave provider liability unknown.", "قد ينتج التنفيذ بيانات استخدام أبلغ عنها المزوّد. لا يُستنتج الاستخدام المفقود؛ وقد يترك الإرسال غير المؤكد التزام المزوّد مجهولاً.")}</p><div><ActionButton variant="secondary" onPress={() => navigate("runtime")}>{tr("Open Runtime Lab", "افتح مختبر التشغيل")}</ActionButton><ActionButton variant="quiet" onPress={() => navigate("traces")}>{tr("Open Execution Traces", "افتح آثار التنفيذ")}</ActionButton><ActionButton variant="quiet" onPress={() => void load()}>{tr("Refresh evidence", "حدّث الأدلة")}</ActionButton></div></section>}
    </>}
    <Inspector open={Boolean(selected)} onClose={() => setSelected(null)} title={tr(selectedIsEvent ? "Usage receipt inspector" : "Provider attempt inspector", selectedIsEvent ? "فاحص إيصال الاستخدام" : "فاحص محاولة المزوّد")} description={tr("Read-only, source-backed evidence. No monetary interpretation.", "أدلة موثقة بالمصدر للقراءة فقط، دون تفسير نقدي.")} closeLabel={tr("Close", "إغلاق")} dir={ar ? "rtl" : "ltr"} footer={selectedIsEvent && (hasCostRelationship || hasOiuRelationship || hasRatingRelationship) ? <div className="usage-row-links">{(hasCostRelationship || hasOiuRelationship) && <ActionButton variant="secondary" onPress={() => navigate("economics", selectedEventId)}>{tr("Inspect linked economics", "افحص الأدلة الاقتصادية المرتبطة")}</ActionButton>}{hasRatingRelationship && <ActionButton variant="secondary" onPress={() => navigate("rating", selectedEventId)}>{tr("Inspect linked rating", "افحص التسعير المرتبط")}</ActionButton>}</div> : undefined}>
      {values.filter(([, value]) => value !== undefined).map(([label, value]) => <div className="x14-detail-row" key={label}><span>{label}</span><bdi>{text(value)}</bdi></div>)}
    </Inspector>
  </section>;
}
