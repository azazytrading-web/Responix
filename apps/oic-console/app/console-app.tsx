"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { arabicLiterals, messages, nav } from "./i18n";
import type { Locale, Messages, View } from "./i18n";
import { dateValue, entryText, getString, pretty, safeText } from "./format";
import type { Row, Snapshot } from "./types";
import { IdentityViews } from "./features/identity/identity-views";
import { ModelFabricViews } from "./features/model-fabric/model-fabric-views";
import { OverviewView } from "./features/overview/overview-view";
import { AuditView } from "./features/operations/audit-view";
import { HealthView } from "./features/operations/health-view";
import { RuntimeView } from "./features/runtime/runtime-view";
import { IntelligenceCenter } from "./features/intelligence/intelligence-center";
async function responseRecord(response: Response): Promise<Row> {
  const value: unknown = await response.json().catch(() => ({}));
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}
const rowsOf = (value: unknown): Row[] => Array.isArray(value) ? value.filter((item): item is Row => !!item && typeof item === "object" && !Array.isArray(item)) : [];
const scalarText = (value: unknown, fallback = "—") => typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : fallback;

export default function ConsoleApp({ platformUrl }: { platformUrl: string }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [view, setView] = useState<View>("overview");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [health, setHealth] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [pageError, setPageError] = useState("");
  const [toast, setToast] = useState("");
  const [issuedCredential, setIssuedCredential] = useState("");
  const [filter, setFilter] = useState("");
  const [password, setPassword] = useState("");
  const [invocation, setInvocation] = useState<Row | null>(null);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [executions, setExecutions] = useState<Row[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<Row | null>(null);
  const [memories, setMemories] = useState<Row[]>([]);
  const [knowledge, setKnowledge] = useState<Row[]>([]);
  const [selectedKnowledge, setSelectedKnowledge] = useState<Row | null>(null);
  const [workbenchResult, setWorkbenchResult] = useState<Row | null>(null);
  const [running, setRunning] = useState(false);
  const t = messages[locale] as Messages;
  const literal = (value: string) => (locale === "ar" ? (arabicLiterals[value] ?? value) : value);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const response = await fetch("/api/console?view=snapshot", { cache: "no-store" });
      if (response.status === 401) {
        setAuthenticated(false);
        setSessionError(t.sessionExpired);
        return;
      }
      const data = await responseRecord(response);
      if (!response.ok) throw new Error(t.unavailable);
      setSnapshot(data as Snapshot);
      setAuthenticated(true);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : t.unavailable);
    } finally {
      setLoading(false);
    }
  }, [t.sessionExpired, t.unavailable]);

  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/console?view=health", { cache: "no-store" });
      const data = await responseRecord(response);
      setHealth(response.ok ? data : { status: "error" });
    } catch {
      setHealth({ status: "error" });
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const response = await fetch("/api/console?view=profiles", { cache: "no-store" });
      const value: unknown = await response.json().catch(() => []);
      setProfiles(response.ok && Array.isArray(value) ? value as Row[] : []);
    } catch { setProfiles([]); }
  }, []);

  const loadExecutions = useCallback(async () => {
    try { const response = await fetch("/api/console?view=executions", { cache: "no-store" }); const value: unknown = await response.json().catch(() => []); setExecutions(response.ok && Array.isArray(value) ? value as Row[] : []); }
    catch { setExecutions([]); }
  }, []);
  const loadIntelligenceRecords = useCallback(async (resource: "memory" | "knowledge") => {
    try { const response = await fetch(`/api/console?view=${resource}`, { cache: "no-store" }); const value: unknown = await response.json().catch(() => []); const data = response.ok ? rowsOf(value) : []; if (resource === "memory") setMemories(data); else setKnowledge(data); }
    catch { if (resource === "memory") setMemories([]); else setKnowledge([]); }
  }, []);
  const inspectKnowledge = async (id: string) => { try { const response = await fetch(`/api/console?view=knowledge&id=${encodeURIComponent(id)}`, { cache: "no-store" }); const value: unknown = await response.json().catch(() => null); setSelectedKnowledge(value && typeof value === "object" && !Array.isArray(value) ? value as Row : null); } catch { setSelectedKnowledge(null); } };
  const inspectMemory = async (id: string) => { try { const response = await fetch(`/api/console?view=memory&id=${encodeURIComponent(id)}`, { cache: "no-store" }); const value: unknown = await response.json().catch(() => null); setSelectedMemory(value && typeof value === "object" && !Array.isArray(value) ? value as Row : null); } catch { setSelectedMemory(null); } };
  const inspectTrace = async (traceId: string) => { try { const response = await fetch(`/api/console?view=executions&traceId=${encodeURIComponent(traceId)}`, { cache: "no-store" }); const value: unknown = await response.json().catch(() => null); setSelectedExecution(value && typeof value === "object" && !Array.isArray(value) ? value as Row : null); } catch { setSelectedExecution(null); } };
  const [selectedMemory, setSelectedMemory] = useState<Row | null>(null);
  const loadExecution = async (traceId: string) => {
    try { const response = await fetch(`/api/console?view=executions&traceId=${encodeURIComponent(traceId)}`, { cache: "no-store" }); const value: unknown = await response.json().catch(() => null); setSelectedExecution(value && typeof value === "object" && !Array.isArray(value) ? value as Row : null); }
    catch { setSelectedExecution(null); }
  };

  useEffect(() => {
    const savedLocale = document.cookie
      .split("; ")
      .find((item) => item.startsWith("oic_locale="))
      ?.split("=")[1];
    if (savedLocale === "ar") setLocale("ar");
    fetch("/api/session", { cache: "no-store" })
      .then(responseRecord)
      .then((data) => {
        setConfigured(data.configured === true);
        setAuthenticated(data.authenticated === true);
        if (data.authenticated === true) void loadSnapshot();
      })
      .catch(() => {
        setConfigured(false);
        setAuthenticated(false);
      });
  }, [loadSnapshot]);

  useEffect(() => {
    if (authenticated) void loadHealth();
  }, [authenticated, loadHealth]);
  useEffect(() => { if (authenticated) void loadProfiles(); }, [authenticated, loadProfiles]);
  useEffect(() => { if (authenticated) void loadExecutions(); }, [authenticated, loadExecutions]);
  useEffect(() => { if (authenticated) { void loadIntelligenceRecords("memory"); void loadIntelligenceRecords("knowledge"); } }, [authenticated, loadIntelligenceRecords]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLanguage = (next: Locale) => {
    setLocale(next);
    document.cookie = `oic_locale=${next};path=/;max-age=31536000;samesite=lax`;
  };
  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSessionError("");
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    setPassword("");
    if (!response.ok) {
      setSessionError(t.actionFailed);
      return;
    }
    setAuthenticated(true);
    await loadSnapshot();
  };
  const signOut = async () => {
    await fetch("/api/session", { method: "DELETE" });
    setAuthenticated(false);
    setSnapshot(null);
  };

  const perform = async (action: string, values: Row = {}) => {
    setPageError("");
    setToast("");
    let response: Response;
    let data: Row;
    try {
      response = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...values })
      });
      data = await responseRecord(response);
    } catch {
      setPageError(t.actionFailed);
      return null;
    }
    if (response.status === 401) {
      setAuthenticated(false);
      setSessionError(t.sessionExpired);
      return null;
    }
    if (!response.ok) {
      if (action === "runtime.invoke") return data;
      setPageError(t.actionFailed);
      return null;
    }
    if (action !== "runtime.invoke") setToast(t.saved);
    await loadSnapshot();
    if (action.startsWith("intelligence.profile.")) await loadProfiles();
    if (action.startsWith("intelligence.memory.")) { await loadIntelligenceRecords("memory"); await loadExecutions(); }
    if (action.startsWith("intelligence.knowledge.")) await loadIntelligenceRecords("knowledge");
    if (action === "runtime.invoke" || action === "intelligence.workbench.run") await loadExecutions();
    if (action === "intelligence.workbench.run" && data.result && typeof data.result === "object" && !Array.isArray(data.result)) setWorkbenchResult(data.result as Row);
    return action === "intelligence.workbench.run" && data.result && typeof data.result === "object" && !Array.isArray(data.result) ? data.result as Row : data;
  };

  const runInvocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRunning(true);
    setInvocation(null);
    setPageError("");
    const form = new FormData(event.currentTarget);
    const payload: Row = {
      model: entryText(form.get("model")),
      maxOutputUnits: Number(entryText(form.get("maxOutputUnits")) || 1024),
      input: [{ speaker: "user", content: [{ type: "text", text: entryText(form.get("prompt")) }] }]
    };
    const tenantId = entryText(form.get("tenantId")).trim();
    if (tenantId) payload.tenant = { kind: "id", tenantId };
    const result = await perform("runtime.invoke", payload);
    if (result) setInvocation(result);
    setRunning(false);
  };

  const filtered = <T extends Row>(rows: T[] | undefined): T[] => {
    const list = rows ?? [];
    if (!filter.trim()) return list;
    const needle = filter.toLocaleLowerCase();
    return list.filter((row) => JSON.stringify(row).toLocaleLowerCase().includes(needle));
  };

  const badge = (value: unknown) => (
    <span
      className={`badge badge-${safeText(value ?? "unknown").toLowerCase().replaceAll("_", "-")}`}
    >
      {(t.enums as Record<string, string>)[safeText(value)] ?? pretty(value)}
    </span>
  );
  const mono = (value: unknown, clipped = false) => (
    <span className={`mono${clipped ? " clipped" : ""}`} title={safeText(value)}>
      {safeText(value)}
    </span>
  );
  const table = (headers: string[], rows: React.ReactNode[][], empty: string = t.noData) => (
    <div className="table-frame">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="empty-cell">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
  const metric = (index: string, label: string, value: number, note: string) => (
    <article className="metric-card" key={label}>
      <div className="metric-top">
        <span>{index}</span>
        <span className="metric-mark">↗</span>
      </div>
      <p>{label}</p>
      <strong>{value.toString().padStart(2, "0")}</strong>
      <small>{note}</small>
    </article>
  );
  const appFor = (applicationId: unknown) =>
    snapshot?.applications.find((app) => app.id === applicationId);
  const appLabel = (applicationId: unknown) => {
    const app = appFor(applicationId);
    return app
      ? `${getString(app, "key")} · ${getString(app, "displayName")}`
      : safeText(applicationId);
  };
  const tenantLabel = (tenantId: unknown) => {
    const tenant = snapshot?.tenants.find((item) => item.id === tenantId);
    return tenant
      ? getString(tenant, "key") || getString(tenant, "displayName")
      : safeText(tenantId);
  };
  const actionButton = (
    label: string,
    action: string,
    values: Row,
    className = "button subtle"
  ) => (
    <button
      className={className}
      type="button"
      onClick={() => {
        const confirmation = action === "provider.credential.revoke"
          ? t.confirmProviderCredentialRevoke
          : values.status === "ARCHIVED" || values.lifecycle === "ARCHIVED"
            ? t.confirmArchive
          : action === "model.family.retire" || values.lifecycle === "RETIRED"
            ? t.confirmRetire
          : action === "model.visibility.revoke"
            ? t.confirmVisibilityRevoke
          : action.endsWith(".revoke")
            ? t.confirmRevoke
            : t.confirmStatus;
        if (action !== "connection.test" && !window.confirm(confirmation))
          return;
        void perform(action, values);
      }}
    >
      {label}
    </button>
  );
  const issueCredential = async (applicationId: unknown, principalId: unknown) => {
    if (!window.confirm(t.confirmIssue)) return;
    const result = await perform("credential.issue", { applicationId, id: principalId });
    if (typeof result?.credential !== "string" || result.replayed === true) return;
    setIssuedCredential(result.credential);
    window.setTimeout(
      () => setIssuedCredential((current) => (current === result.credential ? "" : current)),
      60_000
    );
  };
  const data = snapshot;
  const title = t[view];

  if (authenticated === null)
    return (
      <main className="loading-screen">
        <span className="oi-glyph">Oi</span>
        <p>{t.loading}</p>
      </main>
    );
  if (!authenticated)
    return (
      <main className="login-screen" dir={locale === "ar" ? "rtl" : "ltr"}>
        <div className="login-mark">
          <span className="oi-glyph">Oi</span>
          <span>
            Oi {t.intelligenceCore}<span className="brand-sub">{literal("CONTROL PLANE")} / 01</span>
          </span>
        </div>
        <section className="login-card">
          <div className="eyebrow">
            {literal("INTERNAL OPERATOR ACCESS")} <span>OIC—4.5</span>
          </div>
          <h1>{t.signIn}</h1>
          <p>{t.signInHint}</p>
          <form
            onSubmit={(event) => {
              void signIn(event);
            }}
          >
            <label htmlFor="operator-password">{t.password}</label>
            <input
              id="operator-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={!configured}
            />
            <button type="submit" className="button primary" disabled={!configured}>
              {t.continue}
              <span>↗</span>
            </button>
          </form>
          {!configured && <p className="notice error-notice">{t.setupMissing}</p>}
          {sessionError && <p className="notice error-notice">{sessionError}</p>}
          <div className="login-foot">
            <span>{literal("PRIVATE CONSOLE · AUTHENTICATED SESSION")}</span>
            <button type="button" onClick={() => setLanguage(locale === "en" ? "ar" : "en")}>
              {t.locale}
            </button>
          </div>
        </section>
        <div className="login-index">
          OI / {locale === "ar" ? "بيئة هندسة الذكاء" : "INTELLIGENCE ENGINEERING ENVIRONMENT"} /
          2026
        </div>
        <a
          className="oi-home login-home"
          href={platformUrl}
          rel="noreferrer"
          referrerPolicy="no-referrer"
          aria-label={t.home}
          title={t.home}
        >
          <span>Oi</span>
        </a>
      </main>
    );

  return (
    <div className="app-shell" dir={locale === "ar" ? "rtl" : "ltr"}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          onClick={(event) => {
            event.preventDefault();
            setView("overview");
          }}
        >
          <span className="oi-glyph">Oi</span>
          <span className="brand-copy">
            <strong>
            {t.intelligenceCore}
              <br />
              CORE
            </strong>
            <small>
              {t.operatorConsole} <i>4.5</i>
            </small>
          </span>
        </a>
        <div className="side-status">
          <span className={`status-light ${health?.status === "ok" ? "online" : "offline"}`} /> OIC
          API <b>{health?.status === "ok" ? t.online : t.check}</b>
        </div>
        <nav aria-label={locale === "ar" ? "التنقل الرئيسي" : "Primary navigation"}>
          {(["identity", "providersGroup", "intelligence", "operations"] as const).map((group) => (
            <div className="nav-group" key={group}>
              <p>{t[group]}</p>
              {nav
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${view === item.id ? "selected" : ""}`}
                    onClick={() => {
                      setView(item.id);
                      setFilter("");
                    }}
                  >
                    <span className="nav-number">{item.number}</span>
                    <span>{t[item.id]}</span>
                    {view === item.id && <span className="nav-arrow">↗</span>}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="foot-label">{literal("OI SMART SOLUTIONS")}</span>
          <span>{literal("INDEPENDENT BY DESIGN")}</span>
          <span>{literal("OIC · INTERNAL SYSTEM")}</span>
        </div>
      </aside>
      <main className="main-frame">
        <header className="topbar">
          <div className="crumb">
            <span>OIC</span>
            <b>/</b>
            <span>{title}</span>
            <span className="crumb-code">{nav.find((item) => item.id === view)?.number}</span>
          </div>
          <div className="top-actions">
            <div className="api-state">
              <span className={`status-light ${health?.status === "ok" ? "online" : "offline"}`} />
              {health?.status === "ok" ? t.connected : t.unavailable}
            </div>
            <button
              className="locale-button"
              type="button"
              onClick={() => setLanguage(locale === "en" ? "ar" : "en")}
              aria-label={t.language}
            >
              {t.locale}
            </button>
            <button
              className="icon-button refresh-button"
              type="button"
              onClick={() => void loadSnapshot()}
              aria-label={t.refresh}
              title={t.refresh}
            >
              ↻
            </button>
            <button className="signout-button" type="button" onClick={() => void signOut()}>
              {t.signOut} <span>↗</span>
            </button>
          </div>
        </header>
        <section className="content-area">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                Oi {t.intelligenceCore} <span>/{nav.find((item) => item.id === view)?.number}</span>
              </div>
              <h1>{title}</h1>
              <p>{view === "overview" ? t.subtitle : `${t.product} / ${title}`}</p>
            </div>
            <div className="heading-meta">
              <span>{literal("CONTROL PLANE")}</span>
              <strong>OIC—4.5</strong>
              <small>
                {data ? `${t.generated} · ${dateValue(data.generatedAt, locale)}` : t.loading}
              </small>
            </div>
          </div>
          {pageError && (
            <div className="notice error-notice" role="alert">
              {pageError}{" "}
              <button type="button" onClick={() => void loadSnapshot()}>
                {t.retry}
              </button>
            </div>
          )}
          {toast && (
            <div className="notice success-notice" role="status">
              {toast}
            </div>
          )}
          {loading && (
            <div className="loading-line">
              <span />
              {t.loading}
            </div>
          )}

          <OverviewView view={view} data={data} health={health} locale={locale} t={t} literal={literal} navigate={setView} badge={badge} mono={mono} table={table} metric={metric} renderAudit={(events) => renderAudit(events, table, mono, dateValue, locale, t)} />
          <IntelligenceCenter
            view={view}
            locale={locale}
            t={t}
            data={data}
            profiles={profiles}
            memories={memories}
            knowledge={knowledge}
            executions={executions}
            selectedMemory={selectedMemory}
            selectedKnowledge={selectedKnowledge}
            selectedTrace={selectedExecution}
            workbenchResult={workbenchResult}
            load={(resource) => { if (resource === "traces") void loadExecutions(); else void loadIntelligenceRecords(resource); }}
            inspectMemory={(id) => { void inspectMemory(id); }}
            inspectKnowledge={(id) => { void inspectKnowledge(id); }}
            inspectTrace={(traceId) => { void inspectTrace(traceId); }}
            perform={perform}
          />
          {view === "profiles" && <section className="panel-stack">
            <div className="section-heading"><div><div className="eyebrow">OIC / INTELLIGENCE</div><h2>{title}</h2><p>{locale === "ar" ? "إصدارات ملفات السياسات المرتبطة بمراجعات النماذج." : "Versioned policies assigned to Oi Model revisions."}</p></div></div>
            <form className="form-grid" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const key = entryText(form.get("profileKey")); const displayName = entryText(form.get("displayName")); const source = profiles.flatMap((profile) => rowsOf(profile.revisions)).find((revision) => String(revision.id) === entryText(form.get("sourceRevisionId"))); if (!source) return; void perform("intelligence.profile.clone", { sourceRevisionId: String(source.id), profileKey: key, displayName }); }}>
              <label>{locale === "ar" ? "مفتاح الملف الجديد" : "New profile key"}<input name="profileKey" pattern="[a-z][a-z0-9._-]{1,63}" required /></label><label>{t.displayName}<input name="displayName" required maxLength={160} /></label><label>{locale === "ar" ? "نسخة المصدر" : "Source revision"}<select name="sourceRevisionId" required>{profiles.flatMap((profile) => rowsOf(profile.revisions).map((revision) => <option key={String(revision.id)} value={String(revision.id)}>{String(profile.profileKey)} · r{String(revision.revision)}</option>))}</select></label><button className="button primary" type="submit">{locale === "ar" ? "استنساخ الملف" : "Clone profile"}</button>
            </form>
            {profiles.map((profile) => <article className="data-card" key={String(profile.id)}><header><div><strong>{String(profile.displayName)}</strong><small>{String(profile.profileKey)} · {String(profile.lifecycle)} · {profile.source === "BUILTIN" ? "Built-in" : "Custom"}</small></div><span>{rowsOf(profile.revisions).length ? `${scalarText(rowsOf(profile.revisions)[0]?.revision, "0")} revisions` : "No revisions"}</span></header>
              {rowsOf(profile.revisions).map((revision) => <details key={String(revision.id)}><summary>{String(profile.profileKey)} r{String(revision.revision)} · {String(revision.id)}</summary><div className="metric-grid">{["contextIntensity", "memoryIntensity", "retrievalIntensity", "reasoningIntensity", "toolsIntensity", "verificationIntensity", "synthesisIntensity", "efficiencyIntensity"].map((key) => <label key={key}>{key}<input aria-label={key} type="number" min={0} max={100} defaultValue={Number(revision[key] ?? 0)} disabled={profile.source === "BUILTIN"} data-profile-intensity={key} /></label>)}</div>{profile.source !== "BUILTIN" && <button className="button subtle" type="button" onClick={() => { const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-profile-intensity]")); const currentInputs = inputs.filter((input) => input.closest("details")?.querySelector("summary")?.textContent?.includes(`${String(profile.profileKey)} r${String(revision.revision)}`)); const policy: Row = {}; for (const key of ["contextIntensity", "memoryIntensity", "retrievalIntensity", "reasoningIntensity", "toolsIntensity", "verificationIntensity", "synthesisIntensity", "efficiencyIntensity", "maxStages", "maxProviderCalls", "maxToolCalls", "maxRetrievalQueries", "maxMemoryItems", "maxCandidates", "maxVerificationRounds", "maxContextTokens", "maxExecutionMs", "allowMemoryWrites", "allowRevision", "requireEvidence"]) if (revision[key] !== undefined) policy[key] = revision[key]; for (const input of currentInputs) { const key = input.dataset.profileIntensity; if (key) policy[key] = Number(input.value); } for (const key of ["id", "profileId", "revision", "createdAt", "updatedAt"]) delete policy[key]; void perform("intelligence.profile.revision", { profileId: String(profile.id), policy }); }}>{locale === "ar" ? "حفظ كنسخة جديدة" : "Save as new revision"}</button>}</details>)}
              {profile.source !== "BUILTIN" && <div className="button-row">{actionButton("Disable", "intelligence.profile.lifecycle", { profileId: profile.id, lifecycle: "DISABLED" })}{actionButton("Archive", "intelligence.profile.lifecycle", { profileId: profile.id, lifecycle: "ARCHIVED" })}</div>}
            </article>)}
          </section>}
          {view === "profiles" && <section className="panel"><div className="panel-heading"><div><span className="section-index">TRACE / SAFE STAGE DATA</span><h3>{locale === "ar" ? "آثار التنفيذ" : "Execution traces"}</h3></div><button className="button subtle" type="button" onClick={() => void loadExecutions()}>{t.refresh}</button></div>
            {table(["Trace", "Model", "Profile", "Strategy", "Stages", "Provider calls", "Retrieval", "Verification", "Duration"], executions.map((execution) => { const summary = execution.summary && typeof execution.summary === "object" && !Array.isArray(execution.summary) ? execution.summary as Row : {}; return [<button className="text-button" key={String(execution.traceId)} type="button" onClick={() => { void loadExecution(String(execution.traceId)); }}>{String(execution.traceId)}</button>, scalarText(execution.modelId), scalarText(execution.profileRevisionId, "FAST"), scalarText(execution.strategy), scalarText(execution.stageCount), scalarText(execution.providerCallCount), scalarText(execution.retrievalQueryCount), scalarText(execution.verificationStatus), scalarText(summary.durationMs)]; }))}
            {selectedExecution && <div className="runtime-context-row"><b>{String(selectedExecution.traceId)} · {String(selectedExecution.status)}</b><span>Stage records contain no prompt or response content.</span>{rowsOf(selectedExecution.stages).map((stage) => <span key={String(stage.stageIndex)}>{String(stage.stageIndex)} · {String(stage.stageType)} · {String(stage.status)} · {String(stage.durationMs)} ms · {scalarText(stage.strategy, "")}</span>)}</div>}
          </section>}
          {data && <IdentityViews view={view} data={data} locale={locale} t={t} literal={literal} filter={filter} setFilter={setFilter} filtered={filtered} table={table} badge={badge} mono={mono} appLabel={appLabel} tenantLabel={tenantLabel} actionButton={actionButton} perform={perform} issueCredential={issueCredential} />}
          {data && <ModelFabricViews view={view} data={data} locale={locale} t={t} literal={literal} filter={filter} setFilter={setFilter} filtered={filtered} table={table} badge={badge} mono={mono} appLabel={appLabel} tenantLabel={tenantLabel} actionButton={actionButton} perform={perform} profileRevisions={profiles.flatMap((profile) => (Array.isArray(profile.revisions) ? profile.revisions as Row[] : []).map((revision) => ({ ...revision, profile })))} />}
          <RuntimeView view={view} data={data} locale={locale} t={t} literal={literal} runInvocation={(event) => { void runInvocation(event); }} running={running} invocation={invocation} />
          <HealthView view={view} health={health} t={t} literal={literal} badge={badge} loadHealth={loadHealth} />
          <AuditView view={view} data={data} t={t} literal={literal} filter={filter} setFilter={setFilter} filtered={filtered} renderAudit={(events) => renderAudit(events, table, mono, dateValue, locale, t)} />
          <footer className="content-footer">
            <span>OIC · {t.independentPlatform}</span>
            <span>
              {data ? `${t.refreshed} ${dateValue(data.generatedAt, locale)}` : "OIC—4.5"}
            </span>
          </footer>
        </section>
      </main>
      <a
        className="oi-home"
        href={platformUrl}
        target="_self"
        rel="noreferrer"
        referrerPolicy="no-referrer"
        aria-label={t.home}
        title={t.home}
      >
        <span>Oi</span>
      </a>
      {issuedCredential && (
        <div className="credential-overlay" role="presentation">
          <section
            className="credential-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="credential-dialog-title"
          >
            <span className="section-index">
              {t.oneTimeSecret}
            </span>
            <h2 id="credential-dialog-title">{t.issueCredential}</h2>
            <p>{t.secretWarning}</p>
            <code dir="ltr">{issuedCredential}</code>
            <div className="credential-dialog-actions">
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(issuedCredential)
                    .then(() => setToast(t.copied))
                    .catch(() => setToast(t.actionFailed));
                }}
              >
                {t.copySecret}
              </button>
              <button
                type="button"
                className="button subtle"
                onClick={() => setIssuedCredential("")}
              >
                {t.close}
              </button>
            </div>
          </section>
        </div>
      )}
      {pageError && (
        <div className="mobile-error" role="alert">
          {pageError}
        </div>
      )}
    </div>
  );
}

function renderAudit(
  events: Row[],
  table: (headers: string[], rows: React.ReactNode[][], empty?: string) => React.ReactNode,
  mono: (value: unknown, clipped?: boolean) => React.ReactNode,
  dateValue: (value: unknown, locale: Locale) => string,
  locale: Locale,
  t: Messages
) {
  return table(
    [t.occurred, t.actor, t.application, t.tenant, t.action, t.target, t.request, t.trace],
    events.map((event) => [
      dateValue(event.occurredAt, locale),
      mono(event.actorPrincipalId, true),
      mono(event.applicationId, true),
      mono(event.tenantId, true),
      <span className="audit-action">{getString(event, "action")}</span>,
      <>
        {getString(event, "targetType")}
        <small className="table-sub">{mono(event.targetId, true)}</small>
      </>,
      mono(event.requestId, true),
      mono(event.traceId, true)
    ]),
    t.emptyAudit
  );
}
