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
async function responseRecord(response: Response): Promise<Row> {
  const value: unknown = await response.json().catch(() => ({}));
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

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
    return data;
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
          {data && <IdentityViews view={view} data={data} locale={locale} t={t} literal={literal} filter={filter} setFilter={setFilter} filtered={filtered} table={table} badge={badge} mono={mono} appLabel={appLabel} tenantLabel={tenantLabel} actionButton={actionButton} perform={perform} issueCredential={issueCredential} />}
          {data && <ModelFabricViews view={view} data={data} locale={locale} t={t} literal={literal} filter={filter} setFilter={setFilter} filtered={filtered} table={table} badge={badge} mono={mono} appLabel={appLabel} tenantLabel={tenantLabel} actionButton={actionButton} perform={perform} />}
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
