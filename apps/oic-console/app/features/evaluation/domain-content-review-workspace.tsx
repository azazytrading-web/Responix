"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button, TextInput, TextArea } from "@/app/components/oic-primitives";
import type { Locale } from "@/app/i18n";

type Row = Record<string, unknown>;
type ConflictRow = { state?: string };
class ReviewRequestError extends Error { constructor(readonly code: string) { super(code); } }
const applicationId = "7f25c69e-bdbb-4949-ad7b-ef6412119850";
const text = (value: unknown) => typeof value === "string" ? value : "";
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): Row[] => Array.isArray(value) ? value.map(row) : [];
const labels: Record<string, Record<string, string>> = {
  en: { msa_understanding: "Modern Standard Arabic · understanding", msa_generation: "Modern Standard Arabic · generation", egyptian_understanding: "Egyptian Arabic · understanding", egyptian_generation: "Egyptian Arabic · generation", arabic_english_mixed: "Arabic and English mixed", translation: "Translation", localization: "Localization", business_communication: "Business communication", sales_support_dialogue: "Sales and support dialogue", APPROVE: "Approve", REJECT: "Reject", FLAG: "Flag for follow-up", title: "Arabic content review", instructions: "Review the Arabic prompt for linguistic quality, dialect fit, cultural clarity, and the displayed rubric. The protected reference answer is not shown.", login: "Reviewer login", password: "Reviewer password", signIn: "Sign in", signOut: "Sign out", open: "Open item", submit: "Submit review", notes: "Optional note (up to 1000 characters)", item: "Arabic slice", ready: "Ready", opened: "In progress", submitted: "Submitted", noAssignments: "No review items are available yet.", completed: "{count} / {count} assigned review items submitted.", saved: "Your review was saved as immutable evidence.", already: "This review was already recorded. The saved submission is unchanged.", sessionExpired: "Your reviewer session expired. Sign in again, then check the assignment status.", notAuthorized: "You are not authorized to submit this review.", notFound: "This assignment is no longer available.", stateChanged: "The assignment state changed. The current status has been refreshed.", invalid: "The review submission is invalid.", unavailable: "The review service is unavailable. Check the assignment status before continuing.", internal: "The review could not be processed. Check the assignment status before continuing.", failure: "The review request could not be processed.", rubric: "Review criteria", prompt: "Content to review", role: "Review role", primary: "Primary review", independent: "Independent second review" },
  ar: { msa_understanding: "العربية الفصحى الحديثة · فهم", msa_generation: "العربية الفصحى الحديثة · توليد", egyptian_understanding: "اللهجة المصرية · فهم", egyptian_generation: "اللهجة المصرية · توليد", arabic_english_mixed: "مزيج العربية والإنجليزية", translation: "الترجمة", localization: "التوطين", business_communication: "التواصل المهني", sales_support_dialogue: "الحوار في المبيعات والدعم", APPROVE: "موافقة", REJECT: "رفض", FLAG: "إحالة للمراجعة", title: "مراجعة المحتوى العربي", instructions: "راجع جودة الصياغة العربية وملاءمة اللهجة والوضوح الثقافي ومعايير التقييم المعروضة. لا تظهر الإجابة المرجعية المحمية.", login: "اسم دخول المراجع", password: "كلمة مرور المراجع", signIn: "تسجيل الدخول", signOut: "تسجيل الخروج", open: "فتح العنصر", submit: "إرسال المراجعة", notes: "ملاحظة اختيارية (حتى 1000 حرف)", item: "الشريحة العربية", ready: "جاهز", opened: "قيد المراجعة", submitted: "تم الإرسال", noAssignments: "لا توجد عناصر مراجعة متاحة حالياً.", completed: "تم إرسال {count} / {count} من عناصر المراجعة المسندة.", saved: "حُفظت المراجعة كدليل غير قابل للتعديل.", already: "تم تسجيل هذه المراجعة مسبقاً. لم يتغير الإرسال المحفوظ.", sessionExpired: "انتهت جلسة المراجع. سجّل الدخول مجدداً ثم تحقق من حالة التكليف.", notAuthorized: "ليست لديك صلاحية إرسال هذه المراجعة.", notFound: "لم يعد هذا التكليف متاحاً.", stateChanged: "تغيرت حالة التكليف. تم تحديث الحالة الحالية.", invalid: "بيانات إرسال المراجعة غير صالحة.", unavailable: "خدمة المراجعة غير متاحة. تحقق من حالة التكليف قبل المتابعة.", internal: "تعذر إتمام المراجعة. تحقق من حالة التكليف قبل المتابعة.", failure: "تعذر تنفيذ طلب المراجعة.", rubric: "معايير المراجعة", prompt: "المحتوى المطلوب مراجعته", role: "دور المراجع", primary: "المراجعة الأساسية", independent: "مراجعة ثانية مستقلة" }
};

const conflictLabels: Record<string, Record<string, string>> = {
  en: { blocked: "Blocked until conflict declaration", conflictTitle: "Packet 7.5 conflict declaration", conflictStatus: "Conflict state", sales_support_dialogue: "Sales and support dialogue", unresolved: "REQUIRES_ATTESTATION", cleared: "CLEARED", conflicted: "CONFLICTED", unknown: "UNKNOWN", declare: "I truthfully confirm that each statement below applies to this review batch.", didNotAuthor: "I did not author the reviewed source material in a disqualifying role.", didNotPublish: "I did not publish or approve this release candidate in a conflicting role.", didNotOperate: "I do not operate the reviewed process in a disqualifying role.", didNotOwn: "I do not own or control the evaluated material in a disqualifying role.", didNotAccessOracle: "I have not accessed protected reference material beyond my authorized review role.", noOtherProtocolConflict: "I have no other disqualifying conflict under this review protocol.", yes: "Yes, true", no: "No, conflict exists", recordConflict: "Record declaration", conflictSaved: "Packet 7.5 conflict declaration recorded.", conflictRequired: "Complete the conflict declaration before opening review items." },
  ar: { blocked: "محظور حتى إقرار تضارب المصالح", conflictTitle: "إقرار تضارب المصالح — الحزمة 7.5", conflictStatus: "حالة تضارب المصالح", sales_support_dialogue: "الحوار في المبيعات والدعم", unresolved: "يتطلب إقراراً", cleared: "تمت التصفية", conflicted: "يوجد تعارض", unknown: "غير معروف", declare: "أؤكد بصدق انطباق كل عبارة أدناه على حزمة المراجعة.", didNotAuthor: "لم أؤلف مواد المصدر محل المراجعة بدور يسبب الاستبعاد.", didNotPublish: "لم أنشر أو أعتمد هذا الإصدار بدور متعارض.", didNotOperate: "لا أدير العملية محل المراجعة بدور يسبب الاستبعاد.", didNotOwn: "لا أملك أو أتحكم في المواد المقيمة بدور يسبب الاستبعاد.", didNotAccessOracle: "لم أطلع على المواد المرجعية المحمية خارج دور المراجعة المصرح به.", noOtherProtocolConflict: "ليس لدي تعارض آخر يمنع المراجعة وفق البروتوكول.", yes: "نعم، صحيح", no: "لا، يوجد تعارض", recordConflict: "تسجيل الإقرار", conflictSaved: "تم تسجيل إقرار تضارب المصالح للحزمة 7.5.", conflictRequired: "أكمل إقرار تضارب المصالح قبل فتح عناصر المراجعة." }
};

export function DomainContentReviewWorkspace({ locale }: { locale: Locale }) {
  const t: Record<string, string> = { ...labels[locale], ...conflictLabels[locale] };
  const [authenticated, setAuthenticated] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [conflict, setConflict] = useState<ConflictRow>({ state: "UNKNOWN" });
  const [declarations, setDeclarations] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Row | null>(null);
  const [decision, setDecision] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const value: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = row(row(value).error);
      throw new ReviewRequestError(text(error.code) || "REVIEW_REQUEST_FAILED");
    }
    return row(value);
  }, []);
  const refresh = useCallback(async () => {
    const current = await request("/api/reviewer/auth");
    setAuthenticated(current.authenticated === true);
    if (current.authenticated === true) {
      const [assignmentResult, conflictResult] = await Promise.all([request("/api/reviewer/domain-content-assignments"), request("/api/reviewer/domain-review/conflict")]);
      setAssignments(list(assignmentResult.assignments));
      setConflict(conflictResult);
    }
  }, [request]);

  useEffect(() => { void refresh().catch(() => setAuthenticated(false)); }, [refresh]);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setFeedback("");
    try {
      const result = await request("/api/reviewer/auth", { method: "POST", body: JSON.stringify({ applicationId, loginHandle: login, password }) });
      setAuthenticated(result.authenticated === true); setPassword(""); setFeedback(""); await refresh();
    } catch { setFeedback(t.failure); }
    finally { setPassword(""); setBusy(false); }
  }

  async function openAssignment(id: string) {
    setBusy(true); setFeedback("");
    try { setSelected(await request(`/api/reviewer/domain-content-assignments/${encodeURIComponent(id)}`)); setDecision(""); setNotes(""); }
    catch { setFeedback(t.failure); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!selected || !["APPROVE", "REJECT", "FLAG"].includes(decision)) return;
    setBusy(true); setFeedback("");
    try {
      const result = await request(`/api/reviewer/domain-content-assignments/${encodeURIComponent(text(selected.id))}`, { method: "POST", body: JSON.stringify({ decision, notes }) });
      setSelected(null); setDecision(""); setNotes(""); setFeedback(result.status === "ALREADY_RECORDED" ? t.already : t.saved); await refresh();
    } catch (error) {
      const code = error instanceof ReviewRequestError ? error.code : "REVIEW_REQUEST_FAILED";
      setSelected(null); setDecision(""); setNotes("");
      setFeedback(code === "REVIEWER_SESSION_EXPIRED" ? t.sessionExpired : code === "REVIEW_NOT_AUTHORIZED" ? t.notAuthorized : code === "ASSIGNMENT_NOT_FOUND" ? t.notFound : code === "ASSIGNMENT_STATE_CHANGED" || code === "ASSIGNMENT_ALREADY_SUBMITTED" ? t.stateChanged : code === "INVALID_REVIEW_SUBMISSION" ? t.invalid : code === "API_UNAVAILABLE" ? t.unavailable : code === "INTERNAL_REVIEW_ERROR" ? t.internal : t.failure);
      await refresh().catch(() => undefined);
    }
    finally { setBusy(false); }
  }

  async function submitConflict() {
    const keys = ["didNotAuthor", "didNotPublish", "didNotOperate", "didNotOwn", "didNotAccessOracle", "noOtherProtocolConflict"];
    if (keys.some((key) => typeof declarations[key] !== "boolean")) return;
    setBusy(true); setFeedback("");
    try {
      await request("/api/reviewer/domain-review/conflict", { method: "POST", body: JSON.stringify({ declarations }) });
      setDeclarations({}); setFeedback(t.conflictSaved); await refresh();
    } catch { setFeedback(t.failure); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await fetch("/api/reviewer/auth", { method: "DELETE" }); setAuthenticated(false); setAssignments([]); setSelected(null); setPassword(""); setConflict({ state: "UNKNOWN" }); setDeclarations({});
  }

  return <section className="domain-content-review" aria-labelledby="domain-content-review-title" dir={locale === "ar" ? "rtl" : "ltr"}>
    <header className="reviewer-page-head"><div><p className="section-index">OIC-7 · PACKET 7.5</p><h2 id="domain-content-review-title">{t.title}</h2><p>{t.instructions}</p></div>{authenticated && <Button type="button" variant="secondary" size="compact" onClick={() => void signOut()}>{t.signOut}</Button>}</header>
    {feedback && <p className="reviewer-feedback" role="status" aria-live="polite">{feedback}</p>}
    {!authenticated ? <form className="reviewer-form-grid" onSubmit={(event) => { void signIn(event); }}>
      <TextInput id="domain-review-login" label={t.login} value={login} onChange={(event) => setLogin(event.currentTarget.value)} autoComplete="username" disabled={busy} />
      <TextInput id="domain-review-password" label={t.password} type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} autoComplete="current-password" disabled={busy} />
      <Button type="submit" variant="primary" disabled={busy || !login || !password}>{t.signIn}</Button>
    </form> : selected ? (() => {
      const projection = row(selected.projection);
      const slice = text(projection.slice);
      return <article className="domain-review-item">
        <div className="reviewer-registry-facts"><div><span>{t.item}</span><strong>{t[slice] ?? slice}</strong></div><div><span>{t.role}</span><strong>{text(selected.reviewerRole) === "PRIMARY" ? t.primary : t.independent}</strong></div></div>
        <section className="reviewer-readable-block"><h3>{t.prompt}</h3><p>{text(projection.prompt)}</p></section>
        <section className="reviewer-rubric"><h3>{t.rubric}</h3><p>{text(projection.rubric)}</p></section>
        <fieldset className="domain-review-decisions"><legend>{locale === "ar" ? "قرار المراجعة" : "Review decision"}</legend>
          {(["APPROVE", "REJECT", "FLAG"] as const).map((choice) => <label key={choice}><input type="radio" name="domain-review-decision" value={choice} checked={decision === choice} onChange={() => setDecision(choice)} disabled={busy} /><span>{t[choice]}</span></label>)}
        </fieldset>
        <TextArea id="domain-review-notes" label={t.notes} maxLength={1000} value={notes} onChange={(event) => setNotes(event.currentTarget.value)} disabled={busy} />
        <Button type="button" variant="primary" disabled={busy || !decision} onClick={() => void submit()}>{t.submit}</Button>
      </article>;
    })() : <>
      <article className="reviewer-calibration-card" aria-labelledby="domain-review-conflict-title">
        <h3 id="domain-review-conflict-title">{t.conflictTitle}</h3>
        <p>{t.conflictStatus}: <strong>{text(conflict.state) === "CLEARED" ? t.cleared : text(conflict.state) === "CONFLICTED" ? t.conflicted : text(conflict.state) === "REQUIRES_ATTESTATION" ? t.unresolved : t.unknown}</strong></p>
        {text(conflict.state) !== "CLEARED" && text(conflict.state) !== "CONFLICTED" && <>
          <p>{t.declare}</p>
          {(["didNotAuthor", "didNotPublish", "didNotOperate", "didNotOwn", "didNotAccessOracle", "noOtherProtocolConflict"] as const).map((key) => <fieldset className="reviewer-conflict-choice" key={key} disabled={busy}>
            <legend>{t[key]}</legend>
            <label><input type="radio" name={`domain-conflict-${key}`} checked={declarations[key] === true} onChange={() => setDeclarations((current) => ({ ...current, [key]: true }))}/><span>{t.yes}</span></label>
            <label><input type="radio" name={`domain-conflict-${key}`} checked={declarations[key] === false} onChange={() => setDeclarations((current) => ({ ...current, [key]: false }))}/><span>{t.no}</span></label>
          </fieldset>)}
          <Button type="button" variant="primary" disabled={busy || ["didNotAuthor", "didNotPublish", "didNotOperate", "didNotOwn", "didNotAccessOracle", "noOtherProtocolConflict"].some((key) => typeof declarations[key] !== "boolean")} onClick={() => void submitConflict()}>{t.recordConflict}</Button>
        </>}
        {text(conflict.state) === "CONFLICTED" && <p role="alert">{t.conflictRequired}</p>}
      </article>
      <ul className="reviewer-assignment-list">{assignments.map((assignment) => {
        const projection = row(assignment.blindProjection);
        const slice = text(projection.slice);
        const status = text(assignment.status);
        return <li key={text(assignment.id)}><span><strong>{t[slice] ?? slice}</strong><small>{status === "BLOCKED_CONFLICT" ? t.blocked : status === "OPENED" ? t.opened : status === "SUBMITTED" ? t.submitted : t.ready}</small></span>{status !== "SUBMITTED" && <Button type="button" variant="secondary" size="compact" disabled={busy || assignment.actionable !== true} onClick={() => void openAssignment(text(assignment.id))}>{t.open}</Button>}</li>;
      })}</ul>
      {!assignments.length && <p className="x14-empty">{t.noAssignments}</p>}
      {assignments.length > 0 && assignments.every((assignment) => assignment.status === "SUBMITTED") && <p className="reviewer-feedback" role="status">{t.completed.replaceAll("{count}", String(assignments.length))}</p>}
    </>}
  </section>;
}
