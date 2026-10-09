"use client";

import { ActionButton } from "../../components/interface";
import { ErrorState, LoadingState } from "../../components/oic-primitives";
import { StateBeacon, StatusRing } from "../../components/instruments";
import type { Locale, Messages, View } from "../../i18n";
import { dateValue } from "../../format";
import type { Row } from "../../types";

type Props = {
  view: View;
  health: Row | null;
  healthState: "loading" | "available" | "failed";
  t: Messages;
  literal: (value: string) => string;
  locale: Locale;
  loadHealth: () => Promise<void>;
};
type Observation = Record<string, unknown>;
const row = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
const scalar = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";
const observation = (value: unknown): Observation => row(value);
const available = (value: Observation) => value.sourceState === "AVAILABLE";
const returnedState = (value: Observation, success: "LIVE" | "READY") => {
  if (!available(value)) return "UNAVAILABLE" as const;
  const body = row(value.body);
  return body.status === "ok" && value.httpStatus === 200 ? success : "FAULT" as const;
};
const stateLabel = (state: string, t: Messages) => state === "LIVE" ? t.live : state === "READY" ? t.ready : state === "FAULT" ? t.healthFault : t.unavailable;

export function HealthView({ view, health, healthState, t, literal, locale, loadHealth }: Props) {
  if (view !== "health") return null;
  const live = observation(health?.live);
  const ready = observation(health?.ready);
  const liveState = returnedState(live, "LIVE");
  const readyState = returnedState(ready, "READY");
  const readyBody = row(ready.body);
  const checks = row(readyBody.checks);
  const dbState = !available(ready) ? "UNAVAILABLE" : checks.database === "ok" ? "READY" : checks.database === "unavailable" ? "FAULT" : "UNAVAILABLE";
  const anySource = available(live) || available(ready);
  const service = scalar(row(live.body).service) || scalar(readyBody.service);
  const contractVersion = scalar(row(live.body).contractVersion);
  const databaseCheck = scalar(checks.database) || "CHECK NOT RETURNED";

  return <section className="panel operations-workspace health-operations" aria-labelledby="health-operations-title">
    <header className="operations-heading"><div><span className="section-index">{literal("OPERATIONS / SOURCE OBSERVATIONS")}</span><h2 id="health-operations-title">{t.health}</h2><p>{t.operationsObservationNote}</p></div><ActionButton variant="secondary" onPress={() => { void loadHealth(); }} loading={healthState === "loading"}>{t.refresh}</ActionButton></header>
    {healthState === "loading" && health && <div className="operations-refresh-note" role="status">{t.loading}</div>}
    {healthState === "loading" && !health ? <LoadingState label={t.loading} /> : healthState === "failed" ? <ErrorState title={t.unavailable} description={t.healthLoadFailed} action={<ActionButton onPress={() => { void loadHealth(); }}>{t.retry}</ActionButton>} /> : null}
    {healthState === "available" && !anySource && <ErrorState title={t.unavailable} description={t.neitherHealthReturned} action={<ActionButton onPress={() => { void loadHealth(); }}>{t.retry}</ActionButton>} />}
    {healthState !== "failed" && (healthState !== "loading" || health !== null) && <>
      <div className="health-observation-grid">
        <article className="health-observation"><div className="health-observation-title"><span className="section-index">{literal("PROCESS / LIVE")}</span><StateBeacon state={liveState} stateLabel={stateLabel(liveState, t)} /></div><div className="health-ring-line"><StatusRing state={liveState} stateLabel={stateLabel(liveState, t)} label={t.apiProcess} size="SM"/><div><b>{t.processLiveness}</b><code>/api/v1/health/live</code><small>{available(live) ? `HTTP ${String(live.httpStatus)}` : t.unavailable}</small><time>{available(live) ? dateValue(live.observedAt, locale) : t.noHealthObservation}</time></div></div></article>
        <article className="health-observation"><div className="health-observation-title"><span className="section-index">{literal("DEPENDENCIES / READY")}</span><StateBeacon state={readyState} stateLabel={stateLabel(readyState, t)} /></div><div className="health-ring-line"><StatusRing state={readyState} stateLabel={stateLabel(readyState, t)} label={t.apiReadiness} size="SM"/><div><b>{t.dependencyReadinessEvidence}</b><code>/api/v1/health/ready</code><small>{available(ready) ? `HTTP ${String(ready.httpStatus)}` : t.unavailable}</small><time>{available(ready) ? dateValue(ready.observedAt, locale) : t.noHealthObservation}</time></div></div></article>
      </div>
      <div className="health-evidence"><header><div><span className="section-index">{literal("READINESS CHECKS")}</span><h3>{t.requiredDependencyEvidence}</h3></div><span>{service || "OIC API"}{contractVersion ? ` · ${t.healthContract} ${contractVersion}` : ""}</span></header>
        <article className="health-check-row"><StateBeacon state={dbState} stateLabel={stateLabel(dbState, t)} /><div><b>{t.databaseReadiness}</b><small>{t.reportedByReadyEndpoint}</small></div><code>{available(ready) ? databaseCheck : t.unavailable}</code></article>
        {!available(ready) && <p className="health-boundary-note">{t.databaseObservationMissing}</p>}
      </div>
      <div className="operations-source-note"><StateBeacon state={anySource ? "READY" : "UNAVAILABLE"} stateLabel={t.readOnlyObservations}/><span>{t.healthSourceBoundary}</span></div>
    </>}
  </section>;
}
