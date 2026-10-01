"use client";

import type { ReactNode } from "react";
import type { Locale, Messages, View } from "../../i18n";
import { dateValue, getString } from "../../format";
import type { Row, Snapshot } from "../../types";

type Props = {
  view: View;
  data: Snapshot | null;
  health: Row | null;
  locale: Locale;
  t: Messages;
  literal: (value: string) => string;
  navigate: (view: View) => void;
  badge: (value: unknown) => ReactNode;
  mono: (value: unknown, clipped?: boolean) => ReactNode;
  table: (headers: string[], rows: ReactNode[][], empty?: string) => ReactNode;
  metric: (index: string, label: string, value: number, note: string) => ReactNode;
  renderAudit: (events: Row[]) => ReactNode;
};

export function OverviewView({ view, data, health, locale, t, literal, navigate, badge, mono, table, metric, renderAudit }: Props) {
  return <>          {view === "overview" && data && (
            <>
              <div className="hero-panel">
                <div>
                  <div className="eyebrow">
                    {literal("SYSTEM OVERVIEW")} <span>· 00</span>
                  </div>
                  <h2>
                    {locale === "ar" ? (
                      <>{literal("Intelligence, under control.")}</>
                    ) : (
                      <>
                        Intelligence,
                        <br />
                        <em>under control.</em>
                      </>
                    )}
                  </h2>
                  <p>{t.currentState}</p>
                </div>
                <div className="hero-orbit" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="orbit-core">Oi</div>
                  <span>OIC / CORE</span>
                </div>
                <div className="hero-index">
                  {locale === "ar" ? (
                    <>
                      {t.platformState}
                    </>
                    ) : (
                      t.platformState
                  )}
                  <b>01—09</b>
                </div>
              </div>
              <div className="metrics-grid">
                {metric("01", t.activeApplications, data.applications.length, t.noMetrics)}
                {metric("02", t.tenantCount, data.tenants.length, literal("OIC-OWNED IDENTITY"))}
                {metric(
                  "03",
                  t.principalsCount,
                  data.principals.length,
                  literal("CREDENTIAL SECRETS SHOWN ONCE")
                )}
                {metric(
                  "04",
                  t.providerConnections,
                  data.connections.length,
                  literal("OIC PROVIDER FABRIC")
                )}
                {metric(
                  "05",
                  t.catalogModels,
                  data.upstreamModels.length,
                  literal("UPSTREAM CATALOG")
                )}
                {metric(
                  "06",
                  t.oiFamilies,
                  data.modelFamilies.length,
                  literal("OI PRODUCT IDENTITIES")
                )}
              </div>
              <div className="split-panels">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-index">
                        A / {locale === "ar" ? "جاهزية النظام" : "SYSTEM READINESS"}
                      </span>
                      <h3>{t.health}</h3>
                    </div>
                    <button type="button" className="text-button" onClick={() => navigate("health")}>
                      08 ↗
                    </button>
                  </div>
                  <div className="readiness-row">
                    <span
                      className={`status-light ${health?.status === "ok" ? "online" : "offline"}`}
                    />
                    <div>
                      <b>{t.live}</b>
                      <small>{literal("OIC process status")}</small>
                    </div>
                    {badge(health?.status === "ok" ? "ONLINE" : "UNKNOWN")}
                  </div>
                  <div className="readiness-row">
                    <span
                      className={`status-light ${health?.checks && (health.checks as Row).database === "ok" ? "online" : "offline"}`}
                    />
                    <div>
                      <b>{t.ready}</b>
                      <small>{literal("Database readiness")}</small>
                    </div>
                    {badge(health?.checks ? (health.checks as Row).database : "UNKNOWN")}
                  </div>
                  <div className="panel-foot">
                    {t.checked}: {dateValue(new Date().toISOString(), locale)}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-index">B / IDENTITY FABRIC</span>
                      <h3>{t.applications}</h3>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => navigate("applications")}
                    >
                      01 ↗
                    </button>
                  </div>
                  {table(
                    [t.key, t.name, t.state],
                    data.applications.slice(0, 5).map((app) => [
                      <>
                        {mono(app.key)}
                        <small className="table-sub">{mono(app.id, true)}</small>
                      </>,
                      getString(app, "displayName"),
                      badge(app.status)
                    ])
                  )}
                </section>
              </div>
              <section className="panel audit-preview">
                <div className="panel-heading">
                  <div>
                    <span className="section-index">C / OBSERVABILITY</span>
                    <h3>{t.recentEvents}</h3>
                  </div>
                  <button type="button" className="text-button" onClick={() => navigate("audit")}>
                    09 ↗
                  </button>
                </div>
                {renderAudit(data.audit.slice(0, 5))}
              </section>
            </>
          )}


  </>;
}
