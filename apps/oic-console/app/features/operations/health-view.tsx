"use client";

import type { ReactNode } from "react";
import type { Messages, View } from "../../i18n";
import { getString } from "../../format";
import type { Row } from "../../types";

type Props = {
  view: View;
  health: Row | null;
  t: Messages;
  literal: (value: string) => string;
  badge: (value: unknown) => ReactNode;
  loadHealth: () => Promise<void>;
};

export function HealthView({ view, health, t, literal, badge, loadHealth }: Props) {
  return <>          {view === "health" && (
            <section className="health-grid">
              <div className="panel health-main">
                <div className="section-index">08 / {literal("SYSTEM STATUS")}</div>
                <h3>{t.health}</h3>
                <div className="health-hero">
                  <span
                    className={`status-light ${health?.status === "ok" ? "online" : "offline"}`}
                  />
                  <strong>{health?.status === "ok" ? t.enums.OPERATIONAL : t.enums.UNAVAILABLE}</strong>
                  <small>{getString(health ?? {}, "service")}</small>
                </div>
                <div className="health-checks">
                  {health?.checks ? (
                    Object.entries(health.checks as Row).map(([name, value]) => {
                      const check = String(value);
                      return (
                        <div className="health-check" key={name}>
                          <span>{name.toUpperCase()}</span>
                          {badge(check)}
                          <small>{check === "ok" ? t.ready : t.check}</small>
                        </div>
                      );
                    })
                  ) : (
                    <p className="empty-cell">{t.platformUnavailable}</p>
                  )}
                </div>
                <button type="button" className="button subtle" onClick={() => void loadHealth()}>
                  {t.refresh}
                </button>
              </div>
              <div className="panel contract-panel">
                <span className="section-index">{t.serviceContract}</span>
                <h3>OIC API</h3>
                <div className="contract-row">
                  <span>{literal("PROCESS LIVENESS")}</span>
                  <code>/api/v1/health/live</code>
                </div>
                <div className="contract-row">
                  <span>{t.dependencyReadiness}</span>
                  <code>/api/v1/health/ready</code>
                </div>
                <div className="contract-row">
                  <span>{literal("CONSOLE ORIGIN")}</span>
                  <code>{t.serverConfiguration.toUpperCase()}</code>
                </div>
                <p>{literal("Only health signals already exposed by OIC are shown here.")}</p>
              </div>
            </section>
          )}


  </>;
}
