"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale, View } from "../../i18n";
import { ErrorState, LoadingState } from "../../components/oic-primitives";
import { Inspector } from "../../components/interface";

type UsageRow = Record<string, unknown>;
type Page = { items: UsageRow[]; nextCursor: string | null };
const rows = (value: unknown): UsageRow[] => value && typeof value === "object" && !Array.isArray(value) && Array.isArray((value as Page).items)
  ? (value as Page).items.filter((item): item is UsageRow => !!item && typeof item === "object" && !Array.isArray(item))
  : [];
const text = (value: unknown, fallback = "—") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;

export function UsageEvidenceView({ view, locale }: { view: View; locale: Locale }) {
  const [attempts, setAttempts] = useState<UsageRow[]>([]);
  const [events, setEvents] = useState<UsageRow[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "available" | "failed">("idle");
  const [selected, setSelected] = useState<UsageRow | null>(null);
  const ar = locale === "ar";
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const load = useCallback(async () => {
    setState("loading");
    try {
      const [attemptResponse, eventResponse] = await Promise.all([
        fetch("/api/console?view=usage-attempts&limit=50", { cache: "no-store" }),
        fetch("/api/console?view=usage-events&limit=50", { cache: "no-store" })
      ]);
      if (!attemptResponse.ok || !eventResponse.ok) throw new Error("usage evidence unavailable");
      const attemptBody: unknown = await attemptResponse.json();
      const eventBody: unknown = await eventResponse.json();
      setAttempts(rows(attemptBody));
      setEvents(rows(eventBody));
      setState("available");
    } catch {
      setAttempts([]);
      setEvents([]);
      setState("failed");
    }
  }, []);
  useEffect(() => { if (view === "usage") void load(); }, [view, load]);
  if (view !== "usage") return null;

  const selectedIsEvent = !!selected && "normalizedDimensions" in selected;
  const values: Array<[string, unknown]> = selected ? selectedIsEvent ? [
    [tr("Evidence ID", "معرّف الدليل"), selected.id],
    [tr("Provider attempt", "محاولة المزوّد"), selected.providerAttemptId],
    [tr("Provider", "المزوّد"), selected.providerKey],
    [tr("Transport", "النقل"), selected.transportProfile],
    [tr("Receipt sequence", "تسلسل الإيصال"), selected.receiptSequence],
    [tr("Evidence digest", "بصمة الدليل"), selected.sourceDigest],
    [tr("Raw provider dimensions", "أبعاد استخدام المزوّد"), JSON.stringify(selected.rawDimensions ?? {})],
    [tr("Normalized dimensions", "الأبعاد الموحّدة"), JSON.stringify(selected.normalizedDimensions ?? {})],
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
      <div><span className="eyebrow">{tr("OIC-6.1 / SOURCE-BACKED", "OIC-6.1 / أدلة المصدر")}</span><h2 id="usage-evidence-title">{tr("Raw usage evidence", "أدلة الاستخدام الخام")}</h2><p>{tr("Provider-reported dimensions and attempt provenance. Missing values remain unknown; this view makes no cost or charge claim.", "أبعاد الاستخدام التي أبلغ عنها المزوّد ومصدر المحاولات. القيم المفقودة تبقى غير معروفة؛ لا تعرض هذه الصفحة تكلفة أو رسوماً.")}</p></div>
      <button type="button" className="button subtle" onClick={() => void load()}>{tr("Refresh evidence", "تحديث الأدلة")}</button>
    </header>
    {state === "loading" && <LoadingState label={tr("Loading source evidence…", "جارٍ تحميل أدلة المصدر…")} />}
    {state === "failed" && <ErrorState title={tr("Evidence unavailable", "الأدلة غير متاحة")} description={tr("The scoped OIC usage evidence source could not be read.", "تعذرت قراءة مصدر أدلة الاستخدام ضمن النطاق.")} action={<button className="button subtle" type="button" onClick={() => void load()}>{tr("Try again", "إعادة المحاولة")}</button>} />}
    {state === "available" && <>
      <div className="metrics-grid">
        <article className="metric-card"><p>{tr("Provider attempts", "محاولات المزوّد")}</p><strong>{attempts.length}</strong><small>{tr("latest bounded page", "أحدث صفحة محدودة")}</small></article>
        <article className="metric-card"><p>{tr("Usage receipts", "إيصالات الاستخدام")}</p><strong>{events.length}</strong><small>{tr("source-backed observations", "ملاحظات موثقة بالمصدر")}</small></article>
        <article className="metric-card"><p>{tr("Unknown usage", "استخدام غير معروف")}</p><strong>{attempts.filter((item) => item.usageStatus === "UNKNOWN").length}</strong><small>{tr("not treated as zero", "لا يُعامل كصفر")}</small></article>
      </div>
      <section className="panel"><div className="panel-heading"><div><h3>{tr("Provider attempts", "محاولات المزوّد")}</h3><p>{tr("Execution attempts can remain uncertain when provider dispatch or usage cannot be confirmed.", "قد تبقى حالة المحاولة غير مؤكدة عندما يتعذر تأكيد الإرسال أو الاستخدام.")}</p></div></div>
        <div className="table-frame"><table><thead><tr>{[tr("Started", "بدأت"), tr("Provider", "المزوّد"), tr("Upstream model", "النموذج المزوّد"), tr("State", "الحالة"), tr("Usage", "الاستخدام"), tr("Evidence", "الأدلة")].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>
          {attempts.map((item) => <tr key={text(item.id)}><td><button className="table-link" type="button" onClick={() => setSelected(item)}>{text(item.startedAt)}</button></td><td>{text(item.providerKey)}</td><td>{text(item.upstreamModelId)}</td><td>{text(item.status)}</td><td>{text(item.usageStatus)}</td><td>{text((item._count as UsageRow | undefined)?.usageEvents, "0")}</td></tr>)}
          {!attempts.length && <tr><td colSpan={6}>{tr("No provider attempts have been captured.", "لم تُسجّل محاولات مزوّد بعد.")}</td></tr>}
        </tbody></table></div>
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>{tr("Provider usage receipts", "إيصالات استخدام المزوّد")}</h3><p>{tr("Only allowlisted numeric usage fields are retained; raw provider responses and credentials are never stored here.", "تُحفظ حقول الاستخدام الرقمية المسموح بها فقط؛ لا تُخزّن استجابات المزوّد الخام أو بيانات الاعتماد هنا.")}</p></div></div>
        <div className="table-frame"><table><thead><tr>{[tr("Recorded", "وقت التسجيل"), tr("Provider", "المزوّد"), tr("Transport", "النقل"), tr("Sequence", "التسلسل"), tr("Normalized usage", "الاستخدام الموحّد"), tr("Source digest", "بصمة المصدر")].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>
          {events.map((item) => <tr key={text(item.id)}><td><button className="table-link" type="button" onClick={() => setSelected(item)}>{text(item.recordedAt)}</button></td><td>{text(item.providerKey)}</td><td>{text(item.transportProfile)}</td><td>{text(item.receiptSequence)}</td><td><code>{JSON.stringify(item.normalizedDimensions ?? {})}</code></td><td><code>{text(item.sourceDigest).slice(0, 12)}…</code></td></tr>)}
          {!events.length && <tr><td colSpan={6}>{tr("No provider usage receipts have been reported.", "لم يبلّغ المزوّد عن إيصالات استخدام بعد.")}</td></tr>}
        </tbody></table></div>
      </section>
    </>}
    <Inspector open={Boolean(selected)} onClose={() => setSelected(null)} title={tr(selectedIsEvent ? "Usage receipt inspector" : "Provider attempt inspector", selectedIsEvent ? "فاحص إيصال الاستخدام" : "فاحص محاولة المزوّد")} description={tr("Read-only, source-backed evidence. No monetary interpretation.", "أدلة موثقة بالمصدر للقراءة فقط، دون تفسير نقدي.")} closeLabel={tr("Close", "إغلاق")} dir={ar ? "rtl" : "ltr"}>
      {values.map(([label, value]) => <div className="x14-detail-row" key={label}><span>{label}</span><bdi>{text(value)}</bdi></div>)}
    </Inspector>
  </section>;
}
