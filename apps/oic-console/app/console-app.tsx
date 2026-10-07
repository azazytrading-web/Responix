"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { arabicLiterals, messages, nav } from "./i18n";
import type { Locale, Messages, View } from "./i18n";
import { dateValue, entryText, getString, pretty, safeText } from "./format";
import type { Row, Snapshot } from "./types";
import {
  ActionFeedback,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Slider
} from "./components/oic-primitives";
import { PageFrame } from "./components/oic-frames";
import { IdentityViews } from "./features/identity/identity-views";
import { ActionButton, ArmThenExecute, Inspector } from "./components/interface";
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
const rowsOf = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Row => !!item && typeof item === "object" && !Array.isArray(item)
      )
    : [];
const scalarText = (value: unknown, fallback = "—") =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : fallback;

const nestedRecord = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
function verifyIdentityReadback(
  action: string,
  values: Row,
  response: Row,
  snapshot: Snapshot
): boolean {
  const result = nestedRecord(response.value);
  const entityId = scalarText(result.id, scalarText(response.id, ""));
  if (
    [
      "application.create",
      "tenant.create",
      "principal.create",
      "externalReference.create"
    ].includes(action)
  ) {
    const collection =
      action === "application.create"
        ? snapshot.applications
        : action === "tenant.create"
          ? snapshot.tenants
          : action === "principal.create"
            ? snapshot.principals
            : snapshot.tenants.flatMap((tenant) => rowsOf(tenant.references));
    return Boolean(entityId && collection.some((row) => row.id === entityId));
  }
  if (action === "identity.status") {
    const rows =
      values.kind === "application"
        ? snapshot.applications
        : values.kind === "tenant"
          ? snapshot.tenants
          : snapshot.principals;
    return rows.some((row) => row.id === values.id && row.status === values.status);
  }
  if (action.startsWith("principal.scope.")) {
    const principal = snapshot.principals.find((row) => row.id === values.id);
    const found = rowsOf(principal?.scopes).some((scope) => scope.scope === values.scope);
    return action.endsWith("grant") ? found : !found;
  }
  if (action.startsWith("principal.tenant.")) {
    const principal = snapshot.principals.find((row) => row.id === values.id);
    const found = rowsOf(principal?.tenantGrants).some(
      (grant) => grant.tenantId === values.tenantId
    );
    return action.endsWith("grant") ? found : !found;
  }
  if (action === "credential.issue") {
    const principal = snapshot.principals.find((row) => row.id === values.id);
    const credentials = rowsOf(principal?.credentials);
    const newId = scalarText(result.id, scalarText(response.id, ""));
    return Boolean(
      newId &&
      credentials.some((credential) => credential.id === newId && credential.status === "ACTIVE") &&
      (!values.replacesId ||
        credentials.some(
          (credential) => credential.id === values.replacesId && credential.status === "REVOKED"
        ))
    );
  }
  if (action === "credential.revoke")
    return snapshot.principals.some((principal) =>
      rowsOf(principal.credentials).some(
        (credential) => credential.id === values.id && credential.status === "REVOKED"
      )
    );
  if (action === "externalReference.revoke")
    return snapshot.tenants.some((tenant) =>
      rowsOf(tenant.references).some(
        (reference) => reference.id === values.id && Boolean(reference.revokedAt)
      )
    );
  if (action === "externalReference.remap")
    return snapshot.tenants.some(
      (tenant) =>
        tenant.id === values.tenantId &&
        rowsOf(tenant.references).some(
          (reference) => reference.id === values.id && !reference.revokedAt
        )
    );
  return true;
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
  const [credentialIntent, setCredentialIntent] = useState<{
    applicationId: unknown;
    principalId: unknown;
    replacesId?: unknown;
    expiresAt?: unknown;
  } | null>(null);
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const commandTriggerRef = useRef<HTMLButtonElement>(null);
  const commandResultsRef = useRef<HTMLDivElement>(null);
  const commandDialogRef = useRef<HTMLElement>(null);
  const t = messages[locale] as Messages;
  const literal = (value: string) => (locale === "ar" ? (arabicLiterals[value] ?? value) : value);
  const navigateTo = useCallback((destination: View, entityId?: string) => {
    setView(destination);
    setFilter("");
    setCommandOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("view", destination);
    if (entityId) url.searchParams.set("entity", entityId);
    else url.searchParams.delete("entity");
    window.history.replaceState({}, "", url);
  }, []);

  const loadSnapshot = useCallback(async (): Promise<Snapshot | null> => {
    setLoading(true);
    setPageError("");
    try {
      const response = await fetch("/api/console?view=snapshot", { cache: "no-store" });
      if (response.status === 401) {
        setAuthenticated(false);
        setSessionError(t.sessionExpired);
        return null;
      }
      const data = await responseRecord(response);
      if (!response.ok) throw new Error(t.unavailable);
      setSnapshot(data as Snapshot);
      setAuthenticated(true);
      return data as Snapshot;
    } catch (error) {
      setPageError(error instanceof Error ? error.message : t.unavailable);
      return null;
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
      setProfiles(response.ok && Array.isArray(value) ? (value as Row[]) : []);
    } catch {
      setProfiles([]);
    }
  }, [navigateTo]);

  const loadExecutions = useCallback(async () => {
    try {
      const response = await fetch("/api/console?view=executions", { cache: "no-store" });
      const value: unknown = await response.json().catch(() => []);
      setExecutions(response.ok && Array.isArray(value) ? (value as Row[]) : []);
    } catch {
      setExecutions([]);
    }
  }, []);
  const loadIntelligenceRecords = useCallback(async (resource: "memory" | "knowledge") => {
    try {
      const response = await fetch(`/api/console?view=${resource}`, { cache: "no-store" });
      const value: unknown = await response.json().catch(() => []);
      const data = response.ok ? rowsOf(value) : [];
      if (resource === "memory") setMemories(data);
      else setKnowledge(data);
    } catch {
      if (resource === "memory") setMemories([]);
      else setKnowledge([]);
    }
  }, []);
  const inspectKnowledge = async (id: string) => {
    try {
      const response = await fetch(`/api/console?view=knowledge&id=${encodeURIComponent(id)}`, {
        cache: "no-store"
      });
      const value: unknown = await response.json().catch(() => null);
      setSelectedKnowledge(
        value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null
      );
    } catch {
      setSelectedKnowledge(null);
    }
  };
  const inspectMemory = async (id: string) => {
    try {
      const response = await fetch(`/api/console?view=memory&id=${encodeURIComponent(id)}`, {
        cache: "no-store"
      });
      const value: unknown = await response.json().catch(() => null);
      setSelectedMemory(
        value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null
      );
    } catch {
      setSelectedMemory(null);
    }
  };
  const inspectTrace = async (traceId: string) => {
    try {
      const response = await fetch(
        `/api/console?view=executions&traceId=${encodeURIComponent(traceId)}`,
        { cache: "no-store" }
      );
      const value: unknown = await response.json().catch(() => null);
      setSelectedExecution(
        value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null
      );
    } catch {
      setSelectedExecution(null);
    }
  };
  const [selectedMemory, setSelectedMemory] = useState<Row | null>(null);
  const loadExecution = async (traceId: string) => {
    try {
      const response = await fetch(
        `/api/console?view=executions&traceId=${encodeURIComponent(traceId)}`,
        { cache: "no-store" }
      );
      const value: unknown = await response.json().catch(() => null);
      setSelectedExecution(
        value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null
      );
    } catch {
      setSelectedExecution(null);
    }
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
    if (authenticated && snapshot) void loadHealth();
  }, [authenticated, snapshot, loadHealth]);
  useEffect(() => {
    if (authenticated) void loadProfiles();
  }, [authenticated, loadProfiles]);
  useEffect(() => {
    if (authenticated) void loadExecutions();
  }, [authenticated, loadExecutions]);
  useEffect(() => {
    if (authenticated) {
      void loadIntelligenceRecords("memory");
      void loadIntelligenceRecords("knowledge");
    }
  }, [authenticated, loadIntelligenceRecords]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view");
    if (
      requestedView &&
      [
        "overview",
        "applications",
        "tenants",
        "principals",
        "providers",
        "catalog",
        "models",
        "profiles",
        "memory",
        "knowledge",
        "workbench",
        "traces",
        "runtime",
        "health",
        "audit"
      ].includes(requestedView)
    )
      setView(requestedView as View);
  }, []);

  useEffect(() => {
    const navigateIdentity = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: View; id?: string }>).detail;
      if (detail?.view && ["applications", "tenants", "principals"].includes(detail.view)) {
        navigateTo(detail.view, detail.id);
      }
    };
    window.addEventListener("oic:navigate-identity", navigateIdentity);
    return () => window.removeEventListener("oic:navigate-identity", navigateIdentity);
  }, [navigateTo]);

  useEffect(() => {
    if (!authenticated) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        setCommandQuery("");
      }
      if (event.key === "Escape") setCommandOpen(false);
      if (commandOpen && event.key === "Tab") {
        const focusable = Array.from(
          commandDialogRef.current?.querySelectorAll<HTMLElement>(
            'input:not(:disabled),button:not(:disabled),[tabindex]:not([tabindex="-1"])'
          ) ?? []
        );
        if (!focusable.length) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault();
          focusable.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
          event.preventDefault();
          focusable[0]?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authenticated, commandOpen]);

  useEffect(() => {
    if (!commandOpen) return;
    return () => commandTriggerRef.current?.focus();
  }, [commandOpen]);

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
    const refreshedSnapshot = await loadSnapshot();
    const identityAction = [
      "application.create",
      "tenant.create",
      "principal.create",
      "externalReference.create",
      "externalReference.revoke",
      "externalReference.remap",
      "principal.scope.grant",
      "principal.scope.revoke",
      "principal.tenant.grant",
      "principal.tenant.revoke",
      "credential.issue",
      "credential.revoke",
      "identity.status"
    ].includes(action);
    const verified =
      refreshedSnapshot &&
      (!identityAction || verifyIdentityReadback(action, values, data, refreshedSnapshot));
    if (action !== "runtime.invoke")
      setToast(
        identityAction
          ? verified
            ? locale === "ar"
              ? "تم التطبيق والتحقق من لقطة الخدمة"
              : "APPLIED · VERIFIED FROM SERVICE SNAPSHOT"
            : locale === "ar"
              ? "تم التطبيق · تعذّر التحقق من القراءة"
              : "APPLIED · VERIFICATION UNKNOWN"
          : t.saved
      );
    if (action.startsWith("intelligence.profile.")) await loadProfiles();
    if (action.startsWith("intelligence.memory.")) {
      await loadIntelligenceRecords("memory");
      await loadExecutions();
    }
    if (action.startsWith("intelligence.knowledge.")) await loadIntelligenceRecords("knowledge");
    if (action === "runtime.invoke" || action === "intelligence.workbench.run")
      await loadExecutions();
    if (
      action === "intelligence.workbench.run" &&
      data.result &&
      typeof data.result === "object" &&
      !Array.isArray(data.result)
    )
      setWorkbenchResult(data.result as Row);
    const result =
      action === "intelligence.workbench.run" &&
      data.result &&
      typeof data.result === "object" &&
      !Array.isArray(data.result)
        ? (data.result as Row)
        : data;
    return identityAction && !verified ? { ...result, __verificationStatus: "unknown" } : result;
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
      className={`badge badge-${safeText(value ?? "unknown")
        .toLowerCase()
        .replaceAll("_", "-")}`}
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
    <DataTable label={headers.join(", ")} className="table-frame">
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
                <EmptyState title={empty} description={t.emptyTableExplain} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </DataTable>
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
        const confirmation =
          action === "provider.credential.revoke"
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
        if (action !== "connection.test" && !window.confirm(confirmation)) return;
        void perform(action, values);
      }}
    >
      {label}
    </button>
  );
  const issueCredential = (
    applicationId: unknown,
    principalId: unknown,
    replacesId?: unknown,
    expiresAt?: unknown
  ) => {
    setCredentialIntent({
      applicationId,
      principalId,
      ...(replacesId ? { replacesId } : {}),
      ...(expiresAt ? { expiresAt } : {})
    });
  };
  const executeCredentialIssue = async () => {
    if (!credentialIntent) return "BLOCKED" as const;
    const result = await perform("credential.issue", {
      applicationId: credentialIntent.applicationId,
      id: credentialIntent.principalId,
      ...(credentialIntent.replacesId ? { replacesId: credentialIntent.replacesId } : {}),
      ...(credentialIntent.expiresAt ? { expiresAt: credentialIntent.expiresAt } : {})
    });
    setCredentialIntent(null);
    if (!result) return "FAILED" as const;
    if (typeof result.credential !== "string" || result.replayed === true) {
      setToast(
        locale === "ar"
          ? "اكتمل الأمر دون قيمة سرية جديدة؛ راجع بيانات الاعتماد المسجلة."
          : "The command completed without a new secret value; reconcile credential metadata."
      );
      return "SUCCEEDED" as const;
    }
    setIssuedCredential(result.credential);
    window.setTimeout(
      () => setIssuedCredential((current) => (current === result.credential ? "" : current)),
      60_000
    );
    return "SUCCEEDED" as const;
  };
  const data = snapshot;
  const activeDestination = nav.find((item) => item.id === view);
  const title = activeDestination?.label ? t[activeDestination.label] : t[view];
  const commandItems = nav.filter((item) => {
    const label = item.label ? t[item.label] : t[item.id];
    return `${label} ${t[item.group]}`
      .toLocaleLowerCase()
      .includes(commandQuery.trim().toLocaleLowerCase());
  });
  const selectDestination = (id: View) => navigateTo(id);

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
            Oi {t.intelligenceCore}
            <span className="brand-sub">{literal("CONTROL PLANE")} / 01</span>
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
          {(["command", "foundation", "factory", "intelligence", "lab", "operations"] as const).map(
            (group) => (
              <div className="nav-group" key={group}>
                <p>{t[group]}</p>
                {nav
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`nav-item ${view === item.id ? "selected" : ""}`}
                      aria-current={view === item.id ? "page" : undefined}
                      onClick={() => selectDestination(item.id)}
                    >
                      <span className="nav-item-label">
                        {item.label ? t[item.label] : t[item.id]}
                      </span>
                      {view === item.id && (
                        <span className="nav-arrow" aria-hidden="true">
                          ↗
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            )
          )}
        </nav>
        <div className="sidebar-foot">
          <span className="foot-label">{literal("OI SMART SOLUTIONS")}</span>
          <span>{literal("INDEPENDENT BY DESIGN")}</span>
          <span>{literal("OIC · INTERNAL SYSTEM")}</span>
        </div>
      </aside>
      <main className="main-frame">
        <header className="topbar oi-interface-system" data-density="compact">
          <div className="crumb">
            <span>OIC</span>
            <b>/</b>
            <span>{title}</span>
          </div>
          <div className="top-actions">
            <div className="api-state">
              <span className={`status-light ${health?.status === "ok" ? "online" : "offline"}`} />
              {health?.status === "ok" ? t.connected : t.unavailable}
            </div>
            <button
              className="command-trigger"
              ref={commandTriggerRef}
              type="button"
              onClick={() => {
                setCommandOpen(true);
                setCommandQuery("");
              }}
              aria-label={t.openCommand}
              aria-keyshortcuts="Control+K Meta+K"
              title={t.openCommand}
            >
              <span className="command-trigger-icon" aria-hidden="true">
                ⌕
              </span>
              <span className="command-trigger-label">{t.openCommand}</span>
              <kbd>CTRL K</kbd>
            </button>
            <ActionButton
              className="locale-button"
              variant="quiet"
              size="compact"
              onPress={() => setLanguage(locale === "en" ? "ar" : "en")}
              label={t.language}
            >
              {t.locale}
            </ActionButton>
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
        <PageFrame
          breadcrumbLabel={t.breadcrumb}
          workspaceNavigationLabel={t.workspaceNavigation}
          context={`Oi ${t.intelligenceCore} / ${t[activeDestination?.group ?? "command"]}`}
          title={title}
          description={view === "overview" ? t.subtitle : `${t.product} / ${title}`}
          dir={locale === "ar" ? "rtl" : "ltr"}
          wide={view === "overview"}
          headerMode={["applications", "tenants", "principals"].includes(view) ? "meta" : "full"}
          meta={
            <div className="heading-meta">
              <span>{literal("CONTROL PLANE")}</span>
              <strong>OIC—4.5</strong>
              <small>
                {data ? `${t.generated} · ${dateValue(data.generatedAt, locale)}` : t.loading}
              </small>
            </div>
          }
        >
          {pageError && (
            <ErrorState
              title={t.unavailable}
              description={pageError}
              action={
                <button type="button" className="button subtle" onClick={() => void loadSnapshot()}>
                  {t.retry}
                </button>
              }
            />
          )}
          {toast && <ActionFeedback result={toast} />}
          {loading && <LoadingState label={t.loading} />}

          <OverviewView
            view={view}
            data={data}
            health={health}
            executions={executions}
            locale={locale}
            literal={literal}
            navigate={setView}
            loading={loading}
            refresh={() => {
              void Promise.all([loadSnapshot(), loadHealth(), loadExecutions()]);
            }}
          />
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
            load={(resource) => {
              if (resource === "traces") void loadExecutions();
              else void loadIntelligenceRecords(resource);
            }}
            inspectMemory={(id) => {
              void inspectMemory(id);
            }}
            inspectKnowledge={(id) => {
              void inspectKnowledge(id);
            }}
            inspectTrace={(traceId) => {
              void inspectTrace(traceId);
            }}
            perform={perform}
          />
          {view === "profiles" && (
            <section className="panel-stack">
              <form
                className="form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const key = entryText(form.get("profileKey"));
                  const displayName = entryText(form.get("displayName"));
                  const source = profiles
                    .flatMap((profile) => rowsOf(profile.revisions))
                    .find(
                      (revision) => String(revision.id) === entryText(form.get("sourceRevisionId"))
                    );
                  if (!source) return;
                  void perform("intelligence.profile.clone", {
                    sourceRevisionId: String(source.id),
                    profileKey: key,
                    displayName
                  });
                }}
              >
                <label>
                  {locale === "ar" ? "مفتاح الملف الجديد" : "New profile key"}
                  <input name="profileKey" pattern="[a-z][a-z0-9._-]{1,63}" required />
                </label>
                <label>
                  {t.displayName}
                  <input name="displayName" required maxLength={160} />
                </label>
                <label>
                  {locale === "ar" ? "نسخة المصدر" : "Source revision"}
                  <select name="sourceRevisionId" required>
                    {profiles.flatMap((profile) =>
                      rowsOf(profile.revisions).map((revision) => (
                        <option key={String(revision.id)} value={String(revision.id)}>
                          {String(profile.profileKey)} · r{String(revision.revision)}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <button className="button primary" type="submit">
                  {locale === "ar" ? "استنساخ الملف" : "Clone profile"}
                </button>
              </form>
              {profiles.map((profile) => (
                <article className="data-card" key={String(profile.id)}>
                  <header>
                    <div>
                      <strong>{String(profile.displayName)}</strong>
                      <small>
                        {String(profile.profileKey)} · {String(profile.lifecycle)} ·{" "}
                        {profile.source === "BUILTIN" ? "Built-in" : "Custom"}
                      </small>
                    </div>
                    <span>
                      {rowsOf(profile.revisions).length
                        ? `${scalarText(rowsOf(profile.revisions)[0]?.revision, "0")} revisions`
                        : "No revisions"}
                    </span>
                  </header>
                  {rowsOf(profile.revisions).map((revision) => (
                    <details key={String(revision.id)}>
                      <summary>
                        {String(profile.profileKey)} r{String(revision.revision)} ·{" "}
                        {String(revision.id)}
                      </summary>
                      <div className="metric-grid">
                        {[
                          "contextIntensity",
                          "memoryIntensity",
                          "retrievalIntensity",
                          "reasoningIntensity",
                          "toolsIntensity",
                          "verificationIntensity",
                          "synthesisIntensity",
                          "efficiencyIntensity"
                        ].map((key) => (
                          <Slider
                            key={key}
                            label={key}
                            min={0}
                            max={100}
                            step={1}
                            defaultValue={Number(revision[key] ?? 0)}
                            unavailableLabel={locale === "ar" ? "غير متاح" : "UNAVAILABLE"}
                            disabled={profile.source === "BUILTIN"}
                            compact
                            dir={locale === "ar" ? "rtl" : "ltr"}
                            inputProps={{ "aria-label": key, "data-profile-intensity": key }}
                          />
                        ))}
                      </div>
                      {profile.source !== "BUILTIN" && (
                        <button
                          className="button subtle"
                          type="button"
                          onClick={() => {
                            const inputs = Array.from(
                              document.querySelectorAll<HTMLInputElement>(
                                "[data-profile-intensity]"
                              )
                            );
                            const currentInputs = inputs.filter((input) =>
                              input
                                .closest("details")
                                ?.querySelector("summary")
                                ?.textContent?.includes(
                                  `${String(profile.profileKey)} r${String(revision.revision)}`
                                )
                            );
                            const policy: Row = {};
                            for (const key of [
                              "contextIntensity",
                              "memoryIntensity",
                              "retrievalIntensity",
                              "reasoningIntensity",
                              "toolsIntensity",
                              "verificationIntensity",
                              "synthesisIntensity",
                              "efficiencyIntensity",
                              "maxStages",
                              "maxProviderCalls",
                              "maxToolCalls",
                              "maxRetrievalQueries",
                              "maxMemoryItems",
                              "maxCandidates",
                              "maxVerificationRounds",
                              "maxContextTokens",
                              "maxExecutionMs",
                              "allowMemoryWrites",
                              "allowRevision",
                              "requireEvidence"
                            ])
                              if (revision[key] !== undefined) policy[key] = revision[key];
                            for (const input of currentInputs) {
                              const key = input.dataset.profileIntensity;
                              if (key) policy[key] = Number(input.value);
                            }
                            for (const key of [
                              "id",
                              "profileId",
                              "revision",
                              "createdAt",
                              "updatedAt"
                            ])
                              delete policy[key];
                            void perform("intelligence.profile.revision", {
                              profileId: String(profile.id),
                              policy
                            });
                          }}
                        >
                          {locale === "ar" ? "حفظ كنسخة جديدة" : "Save as new revision"}
                        </button>
                      )}
                    </details>
                  ))}
                  {profile.source !== "BUILTIN" && (
                    <div className="button-row">
                      {actionButton("Disable", "intelligence.profile.lifecycle", {
                        profileId: profile.id,
                        lifecycle: "DISABLED"
                      })}
                      {actionButton("Archive", "intelligence.profile.lifecycle", {
                        profileId: profile.id,
                        lifecycle: "ARCHIVED"
                      })}
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
          {view === "profiles" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="section-index">TRACE / SAFE STAGE DATA</span>
                  <h3>{locale === "ar" ? "آثار التنفيذ" : "Execution traces"}</h3>
                </div>
                <button
                  className="button subtle"
                  type="button"
                  onClick={() => void loadExecutions()}
                >
                  {t.refresh}
                </button>
              </div>
              {table(
                [
                  "Trace",
                  "Model",
                  "Profile",
                  "Strategy",
                  "Stages",
                  "Provider calls",
                  "Retrieval",
                  "Verification",
                  "Duration"
                ],
                executions.map((execution) => {
                  const summary =
                    execution.summary &&
                    typeof execution.summary === "object" &&
                    !Array.isArray(execution.summary)
                      ? (execution.summary as Row)
                      : {};
                  return [
                    <button
                      className="text-button"
                      key={String(execution.traceId)}
                      type="button"
                      onClick={() => {
                        void loadExecution(String(execution.traceId));
                      }}
                    >
                      {String(execution.traceId)}
                    </button>,
                    scalarText(execution.modelId),
                    scalarText(execution.profileRevisionId, "FAST"),
                    scalarText(execution.strategy),
                    scalarText(execution.stageCount),
                    scalarText(execution.providerCallCount),
                    scalarText(execution.retrievalQueryCount),
                    scalarText(execution.verificationStatus),
                    scalarText(summary.durationMs)
                  ];
                })
              )}
              {selectedExecution && (
                <div className="runtime-context-row">
                  <b>
                    {String(selectedExecution.traceId)} · {String(selectedExecution.status)}
                  </b>
                  <span>Stage records contain no prompt or response content.</span>
                  {rowsOf(selectedExecution.stages).map((stage) => (
                    <span key={String(stage.stageIndex)}>
                      {String(stage.stageIndex)} · {String(stage.stageType)} ·{" "}
                      {String(stage.status)} · {String(stage.durationMs)} ms ·{" "}
                      {scalarText(stage.strategy, "")}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}
          {data && ["applications", "tenants", "principals"].includes(view) && (
            <IdentityViews
              view={view}
              data={data}
              locale={locale}
              t={t}
              filter={filter}
              setFilter={setFilter}
              badge={badge}
              appLabel={appLabel}
              tenantLabel={tenantLabel}
              perform={perform}
              issueCredential={issueCredential}
            />
          )}
          {data && (
            <ModelFabricViews
              view={view}
              data={data}
              locale={locale}
              t={t}
              literal={literal}
              filter={filter}
              setFilter={setFilter}
              filtered={filtered}
              table={table}
              badge={badge}
              mono={mono}
              appLabel={appLabel}
              tenantLabel={tenantLabel}
              actionButton={actionButton}
              perform={perform}
              navigate={navigateTo}
              profileRevisions={profiles.flatMap((profile) =>
                (Array.isArray(profile.revisions) ? (profile.revisions as Row[]) : []).map(
                  (revision) => ({ ...revision, profile })
                )
              )}
            />
          )}
          <RuntimeView
            view={view}
            data={data}
            locale={locale}
            t={t}
            literal={literal}
            runInvocation={(event) => {
              void runInvocation(event);
            }}
            running={running}
            invocation={invocation}
          />
          <HealthView
            view={view}
            health={health}
            t={t}
            literal={literal}
            badge={badge}
            loadHealth={loadHealth}
          />
          <AuditView
            view={view}
            data={data}
            t={t}
            literal={literal}
            filter={filter}
            setFilter={setFilter}
            filtered={filtered}
            renderAudit={(events) => renderAudit(events, table, mono, dateValue, locale, t)}
          />
          <footer className="content-footer">
            <span>OIC · {t.independentPlatform}</span>
            <span>
              {data ? `${t.refreshed} ${dateValue(data.generatedAt, locale)}` : "OIC—4.5"}
            </span>
          </footer>
        </PageFrame>
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
      {commandOpen && (
        <div
          className="command-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCommandOpen(false);
          }}
        >
          <section
            ref={commandDialogRef}
            className="command-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-title"
          >
            <div className="command-dialog-head">
              <div>
                <span className="section-index">OIC / {t.command}</span>
                <h2 id="command-title">{t.openCommand}</h2>
              </div>
              <kbd>ESC</kbd>
            </div>
            <label className="command-search">
              <span aria-hidden="true">⌕</span>
              <input
                autoFocus
                aria-label={t.commandSearch}
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    commandResultsRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    commandResultsRef.current
                      ?.querySelectorAll<HTMLButtonElement>("button")
                      .item(commandItems.length - 1)
                      ?.focus();
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commandResultsRef.current?.querySelector<HTMLButtonElement>("button")?.click();
                  }
                }}
                placeholder={t.commandSearch}
              />
              <kbd>↵</kbd>
            </label>
            <div
              className="command-results"
              ref={commandResultsRef}
              role="group"
              aria-label={t.openCommand}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                const results = Array.from(
                  commandResultsRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []
                );
                if (!results.length) return;
                event.preventDefault();
                const current = results.indexOf(event.target as HTMLButtonElement);
                const delta = event.key === "ArrowDown" ? 1 : -1;
                results[(current + delta + results.length) % results.length]?.focus();
              }}
            >
              {commandItems.map((item) => {
                const label = item.label ? t[item.label] : t[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={view === item.id ? "page" : undefined}
                    className={view === item.id ? "command-result current" : "command-result"}
                    onClick={() => selectDestination(item.id)}
                  >
                    <span>
                      <small>{t[item.group]}</small>
                      <b>{label}</b>
                    </span>
                    {view === item.id && <i>{locale === "ar" ? "الحالي" : "CURRENT"}</i>}
                    <span aria-hidden="true">↗</span>
                  </button>
                );
              })}
              {!commandItems.length && <p className="command-empty">{t.noCommands}</p>}
            </div>
            <footer>
              <span>OIC · INTELLIGENCE OPERATING ENVIRONMENT</span>
              <span>{t.closeCommand}</span>
            </footer>
          </section>
        </div>
      )}
      <Inspector
        open={Boolean(credentialIntent)}
        onClose={() => setCredentialIntent(null)}
        title={t.issueCredential}
        description={
          locale === "ar"
            ? "تأكيد إصدار بيانات اعتماد سرية لمرة واحدة"
            : "Confirm one-time machine credential issuance"
        }
        closeLabel={t.close}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        {credentialIntent && (
          <ArmThenExecute
            title={
              credentialIntent.replacesId
                ? locale === "ar"
                  ? "تدوير بيانات الاعتماد"
                  : "Rotate credential"
                : t.issueCredential
            }
            target={`${safeText(snapshot?.principals.find((principal) => principal.id === credentialIntent.principalId)?.displayName)} · ${safeText(snapshot?.principals.find((principal) => principal.id === credentialIntent.principalId)?.key)}${credentialIntent.replacesId ? ` · ${safeText(credentialIntent.replacesId)}` : ""}`}
            consequence={t.confirmIssue}
            labels={{
              arm: locale === "ar" ? "مراجعة الهدف" : "Review target",
              execute: locale === "ar" ? "تأكيد الإصدار" : "Confirm issuance",
              cancel: t.cancel,
              status: {
                IDLE: "IDLE",
                READY: locale === "ar" ? "جاهز للمراجعة" : "READY TO REVIEW",
                ARMED: locale === "ar" ? "تمت المراجعة" : "REVIEWED",
                EXECUTING: t.loading,
                SUCCEEDED: locale === "ar" ? "تم الإصدار" : "ISSUED",
                FAILED: t.actionFailed,
                PARTIAL: "PARTIAL",
                CANCELLED: t.cancel,
                BLOCKED: "BLOCKED",
                DENIED: "DENIED",
                CONFLICT: "CONFLICT",
                UNKNOWN_RESULT: "UNKNOWN RESULT"
              }
            }}
            onExecute={executeCredentialIssue}
          />
        )}
      </Inspector>
      <Inspector
        open={Boolean(issuedCredential)}
        onClose={() => setIssuedCredential("")}
        title={t.oneTimeSecret}
        description={t.secretWarning}
        closeLabel={t.close}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <div className="credential-dialog x14-one-time-secret">
          <code dir="ltr" aria-live="polite">
            {issuedCredential}
          </code>
          <div className="credential-dialog-actions">
            <ActionButton
              variant="primary"
              onPress={() => {
                void navigator.clipboard
                  .writeText(issuedCredential)
                  .then(() => setToast(t.copied))
                  .catch(() => setToast(t.actionFailed));
              }}
            >
              {t.copySecret}
            </ActionButton>
            <ActionButton onPress={() => setIssuedCredential("")}>{t.close}</ActionButton>
          </div>
        </div>
      </Inspector>
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
