"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Locale, View } from "../../i18n";
import { dateValue } from "../../format";
import type { Row, Snapshot } from "../../types";
import { AssemblyPipeline, CapacityRail, DNARadar, DeltaIndicator, NumericInstrument, RadialGauge, StateBeacon, StatusRing, TelemetryStrip, VerticalPressureGauge } from "../../components/instruments";
import { resolveThresholdZone } from "../../components/instruments";
import type { DnaDimension, InstrumentState } from "../../components/instruments";
import { buildFlightDeckData } from "./flight-deck-data";
import type { DeckData, DeckEntity } from "./flight-deck-data";
import { DetailDrawer, Instrument } from "./instrument-renderers";
import type { MetricDefinition, MetricInstance } from "./metric-registry";
import { metricDefinitions } from "./metric-registry";
import { flightDeckCopy } from "./flight-deck-copy";
import { Inspector, ModelPicker } from "../../components/interface";
import { coreVitalById, coreVitalRegistry, productionCoreVitalSignals } from "./core-vital-registry";
import { buildDemoCoreLoad, buildProductionCoreLoad } from "./core-load-registry";
import { FlightDeckBoard, FlightDeckSection, OperationsStrip, SensorRack, ShowcaseSignalInstrument, StableInstrumentCell } from "./flight-deck-composition";
import type { ShowcaseModelTelemetry, ShowcaseOverviewData, ShowcaseSignal } from "./flight-deck-composition";

type Props = { view: View; data: Snapshot | null; health: Row | null; executions: Row[]; locale: Locale; literal: (value: string) => string; navigate: (view: View) => void; loading: boolean; refresh: () => void; showcase?: ShowcaseOverviewData };
const rowText = (row: Row, key: string, fallback = "—") => typeof row[key] === "string" || typeof row[key] === "number" ? String(row[key]) : fallback;
const nested = (row: Row, key: string) => Array.isArray(row[key]) ? row[key] as Row[] : [];
const providerState = (provider: Row): InstrumentState => { const status = rowText(provider, "status", "UNKNOWN").toUpperCase(); if (["ACTIVE", "LIVE", "HEALTHY", "READY"].includes(status)) return "LIVE"; if (status === "DEGRADED") return "DEGRADED"; if (["UNHEALTHY", "FAULT", "ERROR"].includes(status)) return "FAULT"; if (["INACTIVE", "IDLE", "DISABLED"].includes(status)) return "IDLE"; return "UNAVAILABLE"; };
const destination = (view: string): View => ({ health: "health", applications: "applications", tenants: "tenants", principals: "principals", providers: "providers", catalog: "catalog", models: "models", traces: "traces", audit: "audit", workbench: "workbench" } as Record<string, View>)[view] ?? "overview";
const dnaScale = { polarity: "HIGH_IS_GOOD" as const, zones: [{ from: 0, to: 35, state: "CRITICAL" as const }, { from: 35, to: 60, state: "WARNING" as const }, { from: 60, to: 80, state: "ELEVATED" as const }, { from: 80, to: 100, state: "NORMAL" as const }] };
const pressureScale = { polarity: "HIGH_IS_BAD" as const, zones: [{ from: 0, to: 35, state: "NORMAL" as const }, { from: 35, to: 60, state: "ELEVATED" as const }, { from: 60, to: 80, state: "WARNING" as const }, { from: 80, to: 100, state: "CRITICAL" as const }] };
const thresholdInstrumentState = (state?: string): InstrumentState => state === "CRITICAL" ? "FAULT" : state === "NORMAL" || state === "TARGET" || !state ? "LIVE" : "DEGRADED";

export function OverviewView({ view, data, health, executions, locale, literal, navigate, loading, refresh, showcase }: Props) {
  const deck = useMemo(() => buildFlightDeckData(data, health, executions), [data, health, executions]);
  const [selected, setSelected] = useState<{ definition: MetricDefinition; instance: MetricInstance; entity: string } | null>(null);
  const [inspector, setInspector] = useState<{ title: string; entity: string; rows: Array<[string, string]>; destination: View; demo: boolean } | null>(null);
  const [fleetPage, setFleetPage] = useState(0);
  const [dnaModelId, setDnaModelId] = useState("");
  const [dnaCompareId, setDnaCompareId] = useState("");
  const [range, setRange] = useState("LIVE");
  if (view !== "overview") return null;
  const copy = flightDeckCopy(locale);
  const tr = (key: string, fallback = key) => (copy as Record<string, string>)[key] ?? fallback;
  const vitalBayTitle = locale === "ar" ? "العلامات الحيوية لنواة OIC" : "CORE VITAL SIGNS";
  const openInspector = (title: string, entity: string, rows: Array<[string, string]>, target: View, demo = !!showcase) => {
    setSelected(null);
    setInspector({ title, entity, rows, destination: target, demo });
  };
  const inspectSignal = (signal: ShowcaseSignal, target: View) => {
    const label = locale === "ar" ? signal.labelAr : signal.label;
    openInspector(label, signal.id, [[tr("value", "Value"), signal.value == null ? signal.stateLabel : `${signal.value}${signal.unit ? ` ${signal.unit}` : ""}`], [tr("state", "State"), signal.state], [tr("source", "Source"), "DEVELOPMENT DEMO FIXTURE"], [tr("freshness", "Freshness"), tr("scenarioFixture", "Current scenario fixture")], [tr("semantics", "Polarity"), signal.scale?.polarity ?? "NO THRESHOLD CONTRACT"]], target, true);
  };
  const inspectVital = (signal: ShowcaseSignal) => {
    const definition = coreVitalById.get(signal.id);
    if (!definition) return;
    const demo = !!showcase;
    const sourceState = demo ? signal.state === "UNMEASURED" ? "UNMEASURED · DEMO DORMANT" : "DEMO LIVE" : definition.sourceState;
    const current = signal.value == null ? "--" : `${signal.value}${definition.unit ? ` ${definition.unit}` : ""}`;
    const maturity = demo ? "DEVELOPMENT FIXTURE" : definition.maturity;
    const sourceCapability = definition.sourceState === "PLANNED" ? "SOURCE NOT AVAILABLE YET · PLANNED TELEMETRY" : definition.futureCapability;
    openInspector(locale === "ar" ? definition.labelAr : definition.label, signal.id, [
      [locale === "ar" ? "القيمة الحالية" : tr("value", "Current value"), current], [locale === "ar" ? "حالة المصدر" : tr("state", "Source state"), sourceState],
      [locale === "ar" ? "حداثة البيانات" : tr("freshness", "Freshness"), demo ? "DEMO FIXTURE · REDUCED-MOTION AWARE" : definition.freshness],
      [locale === "ar" ? "الوحدة" : "Unit", definition.unit || "—"], [locale === "ar" ? "قطبية المقياس" : "Polarity", definition.polarity],
      [locale === "ar" ? "عقد الحدود" : "Threshold contract", definition.thresholdContract],
      [locale === "ar" ? "نضج القياس" : tr("maturity", "Data maturity"), maturity], [locale === "ar" ? "موائم المصدر" : tr("source", "Source adapter"), demo ? "ISOLATED DEVELOPMENT FIXTURE" : definition.sourceAdapter],
      [locale === "ar" ? "قدرة المصدر" : "Source capability", demo ? "ISOLATED SCENARIO SIGNAL · NOT LIVE OIC TELEMETRY" : locale === "ar" && definition.sourceState === "PLANNED" ? "المصدر غير متاح بعد · القياس مخطط" : sourceCapability]
    ], "health", demo);
  };
  const inspectBay = (title: string, entity: string, target: View, metrics: MetricInstance[] = []) => openInspector(title, entity, metrics.map((metric) => {
    const definition = metricDefinitions.find((item) => item.key === metric.metricKey);
    const value = metric.value == null ? tr(metric.maturity, metric.maturity) : typeof metric.value === "object" ? `${metric.value.sampleSize} ${tr("sample", "sample")}` : String(metric.value);
    return [definition ? tr(definition.labelKey, definition.labelKey) : metric.metricKey, `${value} · ${tr(metric.state, metric.state)} · ${metric.source.service} · ${tr(metric.freshness.state, metric.freshness.state)}`] as [string, string];
  }), target, !!showcase);
  const metricTitle = (metric: MetricInstance) => { const definition = metricDefinitions.find((entry) => entry.key === metric.metricKey); return definition ? tr(definition.labelKey, definition.labelKey) : tr(metric.metricKey, metric.metricKey); };
  const inspectMetric = (instance: MetricInstance, title: string) => {
    const definition = metricDefinitions.find((entry) => entry.key === instance.metricKey);
    if (!definition) return;
    setInspector(null);
    setSelected({ definition, instance, entity: title });
  };
  const showMetric = (instance: MetricInstance, title: string, compact = false) => {
    const definition = metricDefinitions.find((entry) => entry.key === instance.metricKey);
    if (!definition) return null;
    return <Instrument key={`${instance.metricKey}:${instance.entityId ?? "core"}`} definition={definition} instance={instance} title={title} compact={compact} t={tr} onSelect={() => inspectMetric(instance, title)} />;
  };
  const byKey = (key: string) => deck.instances.find((item) => item.metricKey === key);
  const cognitiveKeys = ["cognitive.execution.provider-calls", "cognitive.execution.retrieval-queries", "cognitive.execution.memory-lookups", "cognitive.execution.tools", "cognitive.execution.verification", "cognitive.execution.repair", "cognitive.execution.backtracking", "cognitive.execution.stage-count"];
  const cognitiveMetrics = cognitiveKeys.map((key) => {
    const existing = byKey(key);
    if (existing) return existing;
    const definition = metricDefinitions.find((item) => item.key === key);
    if (!definition) return null;
    return { metricKey: key, definitionVersion: definition.version, domain: definition.domain, entityType: definition.entityType, value: null, unit: definition.unit, state: "UNAVAILABLE" as const, maturity: definition.maturity, source: { service: definition.sourceOwnership, endpoint: "registered metric source", scope: "current bounded snapshot" }, freshness: { state: "UNKNOWN" as const, observedAt: null, agingAfterMs: null, staleAfterMs: null }, reason: "NO_INSTANCE_RETURNED", supported: true };
  }).filter((metric): metric is MetricInstance => metric !== null);
  const executionsSorted = [...deck.executions].sort((a, b) => Date.parse(rowText(b, "startedAt", "")) - Date.parse(rowText(a, "startedAt", "")));
  const fleetPageSize = 3;
  const fleetPages = Math.max(1, Math.ceil(deck.fleet.length / fleetPageSize));
  const visibleFleet = deck.fleet.slice(fleetPage * fleetPageSize, (fleetPage + 1) * fleetPageSize);
  const factoryStageKeys = ["system.model-families.count", "system.model-editions.count", "system.model-revisions.count", "system.model-variants.count", "system.runtime-bindings.count", "system.model-visibility.count"];
  const factoryStageLabels = locale === "ar" ? ["العائلات", "الإصدارات", "المراجعات", "المتغيرات", "الارتباطات", "الظهور"] : ["FAMILIES", "EDITIONS", "REVISIONS", "VARIANTS", "BINDINGS", "VISIBILITY"];
  const factoryStages = factoryStageKeys.map((key, index) => {
    const metric = deck.core.find((item) => item.metricKey === key);
    const label = factoryStageLabels[index];
    const state: InstrumentState = !metric || metric.value === null ? "UNAVAILABLE" : metric.value === 0 ? "IDLE" : "READY";
    const demoWarning = !!showcase?.factory.warningStage && !!metric?.metricKey.includes(showcase.factory.warningStage);
    const resolvedState: InstrumentState = demoWarning ? "DEGRADED" : showcase?.factory.dormant ? "UNMEASURED" : state;
    return { id: key, label, value: !showcase?.factory.dormant && typeof metric?.value === "number" ? metric.value : undefined, state: resolvedState, stateLabel: demoWarning ? tr("DEGRADED", "DEGRADED") : showcase?.factory.dormant ? tr("UNMEASURED", "UNMEASURED") : tr(state) };
  });
  const dnaDimensionsFor = (model: DeckEntity, telemetry?: ShowcaseModelTelemetry): DnaDimension[] => {
    if (telemetry) return telemetry.dna.map((dimension) => ({ ...dimension, stateLabel: dimension.state === "MEASURED" ? tr("measured", "MEASURED") : dimension.state === "INSUFFICIENT_DATA" ? tr("insufficientData", "INSUFFICIENT DATA") : tr("UNMEASURED", "UNMEASURED") }));
    return (model.dna as MetricInstance[] ?? []).map((metric) => ({ id: metric.metricKey, label: metricTitle(metric), state: "UNMEASURED", stateLabel: tr("UNMEASURED", "UNMEASURED") }));
  };

  const apiState = health?.status === "ok" ? "LIVE" : health ? "UNAVAILABLE" : "UNMEASURED";
  const databaseState = (health?.checks as Row | undefined)?.database === "ok" ? "READY" : health?.checks ? "UNAVAILABLE" : "UNMEASURED";
  const recentActivity: Row[] = [
    ...executionsSorted.map((run) => ({ ...run, eventTitle: rowText(run, "status", "UNKNOWN"), eventDetail: rowText(run, "strategy", rowText(run, "taskType", "Execution")), eventTime: rowText(run, "startedAt", "") })),
    ...deck.audit.map((event) => ({ ...event, eventTitle: "AUDIT", eventDetail: rowText(event, "action", "Event"), eventTime: rowText(event, "occurredAt", "") }))
  ].sort((a, b) => Date.parse(rowText(b, "eventTime", "")) - Date.parse(rowText(a, "eventTime", "")));
  const dnaModel = visibleFleet.find((model) => model.id === dnaModelId) ?? visibleFleet[0];
  const dnaCompareModel = visibleFleet.find((model) => model.id === dnaCompareId && model.id !== dnaModel?.id) ?? visibleFleet.find((model) => model.id !== dnaModel?.id);
  const coreLoad = showcase
    ? buildDemoCoreLoad(showcase.vitals ?? [], showcase.coreLoadEnergyDraw ?? null)
    : buildProductionCoreLoad();
  const inspectCoreLoad = () => openInspector(
    locale === "ar" ? "حمل نواة OIC" : "OIC Core Load",
    "oic-core-load",
    [
      [locale === "ar" ? "الحالة المركبة" : "Composite state", coreLoad.state === "DEMO" ? `${locale === "ar" ? "عرض توضيحي" : "DEMO"} · ${coreLoad.band ?? "--"}` : coreLoad.state],
      [locale === "ar" ? "التغطية المقاسة" : "Measurement coverage", `${coreLoad.measured} / ${coreLoad.total}`],
      [tr("freshness", "Freshness"), coreLoad.freshness],
      ...coreLoad.contributors.map((item) => [
        locale === "ar" ? item.labelAr : item.label,
        `${item.value == null ? item.state : `${item.value} ${item.unit}`} · ${item.maturity} · ${item.sourceAdapter}`
      ] as [string, string])
    ],
    "health",
    !!showcase
  );

  return <>
    <section className="fd-overview-shell">
      <section className="hero-panel" aria-label={tr("heroLabel", "OIC system overview")}>
        <div className="hero-copy"><div className="eyebrow">{tr("heroKicker", "SYSTEM OVERVIEW")} / 00</div><h2>{locale === "ar" ? literal("Intelligence, under control.") : <>Intelligence,<br /><em>under control.</em></>}</h2><p>{tr("heroCaption", "CURRENT PLATFORM STATE")}</p></div>
        <div className="hero-orbit" aria-hidden="true"><i className="orbit-one"/><i className="orbit-two"/><div className="orbit-core">Oi</div><small>OIC / CORE</small></div>
        <div className="hero-index"><span className={`hero-health ${health?.status === "ok" ? "live" : "unavailable"}`}>{health?.status === "ok" ? tr("connected", "CONNECTED") : tr("unavailable", "UNAVAILABLE")}</span><b>OIC-4.5</b><small>{tr("controlPlane", "CONTROL PLANE")} · {deck.snapshotAt ? `${tr("snapshotGenerated", "Snapshot generated")} · ${dateValue(deck.snapshotAt, locale)}` : tr("awaitingSnapshot", "Awaiting snapshot")}</small><div className="fd-ribbon-controls"><div className="fd-range" aria-label={tr("timeRange", "Time range")}>{["LIVE", "1H", "24H", "7D", "30D"].map((option) => <button key={option} type="button" className={range === option ? "selected" : ""} disabled={option !== "LIVE"} title={option === "LIVE" ? tr("latestSnapshot", "Latest source snapshot") : tr("historyUnavailable", "No retained metric history is available")} onClick={() => setRange(option)}>{option}</button>)}</div><button className="fd-refresh" type="button" onClick={refresh} disabled={loading}>{loading ? tr("refreshing", "Updating…") : tr("refresh", "Refresh snapshot")}</button></div></div>
        <CoreLoadRail vitals={showcase?.vitals ?? []} energyDraw={showcase?.coreLoadEnergyDraw ?? null} demo={!!showcase} locale={locale} onSelect={inspectCoreLoad} />
      </section>
      <section className="fd-deck" aria-label={tr("deckLabel", "Intelligence Flight Deck")}>
        <FlightDeckBoard label={tr("deckLabel", "Intelligence Flight Deck")}>
          <FlightDeckSection index="01" title={locale === "ar" ? "منظومة مراقبة نواة OIC" : "OIC CORE MONITORING RACK"} className="fd-core-rack">
          <div className="fd-core-zones">
          <FlightDeckSection index="" title={tr("serviceState", "SYSTEM HEALTH")} className="fd-core-zone fd-system-state" action={<BayActions inspect={tr("inspect", "Inspect")} onInspect={() => inspectBay(tr("serviceState", "System State"), "system-state", "health", deck.instances.filter((item) => item.domain === "system" && ["system.api.live", "system.database.ready"].includes(item.metricKey)))} open={tr("healthReadiness", "Health & Readiness")} onOpen={() => navigate("health")} />}>
            <SystemStateBay data={data} deck={deck} apiState={apiState} databaseState={databaseState} byKey={byKey} t={tr} onCount={(key, label) => { const instance = byKey(key); if (instance) inspectMetric(instance, label); else inspectBay(label, key, key.includes("tenants") ? "tenants" : key.includes("principals") ? "principals" : key.includes("provider") ? "providers" : "applications"); }} />
          </FlightDeckSection>

          <FlightDeckSection index="" title={tr("intelligenceQuality", "INTELLIGENCE CORE")} className="fd-core-zone fd-intelligence" action={<BayActions inspect={tr("inspect", "Inspect")} onInspect={() => inspectBay(tr("intelligenceQuality", "Intelligence Core"), "intelligence-core", "workbench", deck.instances.filter((item) => item.domain === "cognitive"))} open={tr("workbench", "Workbench")} onOpen={() => navigate("workbench")} />}>
            <IntelligenceBay signals={showcase?.system} locale={locale} onInspect={(signal) => inspectSignal(signal, "workbench")} />
          </FlightDeckSection>

          <FlightDeckSection index="" title={vitalBayTitle} className="fd-core-zone fd-resource" action={<BayActions inspect={tr("inspect", "Inspect")} onInspect={() => inspectBay(vitalBayTitle, "core-vitals", "health", deck.instances.filter((item) => item.domain === "operations"))} open={tr("inspectTraces", "Execution Traces")} onOpen={() => navigate("traces")} />}>
            <CoreVitalsBay signals={showcase?.vitals ?? productionCoreVitalSignals()} demo={!!showcase && !showcase.vitals?.every((signal) => signal.state === "UNMEASURED")} locale={locale} onInspect={inspectVital} />
          </FlightDeckSection>
          </div>
          </FlightDeckSection>

          <FlightDeckSection index="04" title={tr("activeFleet", "MODEL FLEET")} className="fd-fleet" action={<div className="fd-fleet-tools">{fleetPages > 1 && <div className="fd-bay-pager"><button type="button" aria-label={tr("previousPage", "Previous page")} disabled={fleetPage === 0} onClick={() => setFleetPage((page) => Math.max(0, page - 1))}>&lt;</button><span>{fleetPage + 1} / {fleetPages}</span><button type="button" aria-label={tr("nextPage", "Next page")} disabled={fleetPage + 1 >= fleetPages} onClick={() => setFleetPage((page) => Math.min(fleetPages - 1, page + 1))}>&gt;</button></div>}<BayActions inspect={tr("inspect", "Inspect")} onInspect={() => inspectBay(tr("activeFleet", "Model Fleet"), "model-fleet", "models")} open={tr("viewModels", "Model Factory")} onOpen={() => navigate("models")} /></div>}>
            <FleetRack>{visibleFleet.length ? <div className="fd-model-pod-grid">{visibleFleet.map((model, index) => <ModelPod key={model.id} model={model} telemetry={showcase?.models[model.id]} ordinal={fleetPage * fleetPageSize + index + 1} locale={locale} t={tr} onSelect={() => openInspector(model.title, model.id, [[tr("lifecycle", "Lifecycle"), String(model.lifecycle ?? "UNKNOWN")], [tr("revision", "Revision"), rowText((model.revisions as Row[])[0] ?? {}, "revision", "—")], [tr("provider", "Provider"), showcase?.models[model.id]?.provider ?? rowText(((model.variants as Row[])[0] ?? {}), "providerKey", tr("providerUnavailable", "Unassigned"))], [tr("profile", "Profile"), showcase?.models[model.id]?.profile ?? tr("profileUnavailable", "Unassigned")], [tr("bindings", "Bindings"), String(nested(((model.variants as Row[])[0] ?? {}), "bindings").length)]], "models")} />)}</div> : <FleetStandby data={data} deck={deck} page={fleetPage} setPage={setFleetPage} t={tr} navigate={() => navigate("models")} />}</FleetRack>
          </FlightDeckSection>

          <FlightDeckSection index="05" title={tr("modelDna", "FLEET DNA / COMPARE")} className="fd-fleet-dna" action={<BayActions inspect={tr("inspect", "Inspect")} onInspect={() => openInspector(tr("modelDna", "Model DNA"), "fleet-dna", [[tr("model", "Model"), dnaModel?.title ?? tr("noRuntimeModels", "No runtime model")], [tr("compare", "Compare"), dnaCompareModel?.title ?? tr("none", "None")], [tr("measured", "Measured dimensions"), `${dnaModel ? dnaDimensionsFor(dnaModel, showcase?.models[dnaModel.id]).filter((item) => item.state === "MEASURED").length : 0} / ${dnaModel ? dnaDimensionsFor(dnaModel, showcase?.models[dnaModel.id]).length : deck.dnaDefinitions.length}`]], "models")} open={tr("openFactory", "Model Factory")} onOpen={() => navigate("models")} />}>
            <FleetDnaBay models={visibleFleet} selected={dnaModel} comparison={dnaCompareModel} selectedId={dnaModel?.id ?? ""} comparisonId={dnaCompareModel?.id ?? ""} setSelected={setDnaModelId} setComparison={setDnaCompareId} dimensions={dnaModel ? dnaDimensionsFor(dnaModel, showcase?.models[dnaModel.id]) : deck.dnaDefinitions.map((definition) => ({ id: definition.key, label: tr(definition.labelKey, definition.labelKey), state: "UNMEASURED" as const, stateLabel: tr("UNMEASURED", "UNMEASURED") }))} compareDimensions={dnaCompareModel ? dnaDimensionsFor(dnaCompareModel, showcase?.models[dnaCompareModel.id]) : undefined} locale={locale} t={tr} />
          </FlightDeckSection>

          <FlightDeckSection index="06" title={tr("providerNetwork", "PROVIDER NETWORK")} className="fd-provider" action={<BayActions inspect={tr("inspect", "Inspect")} onInspect={() => inspectBay(tr("providerNetwork", "Provider Network"), "providers", "providers")} open={tr("providers", "Provider Factory")} onOpen={() => navigate("providers")} />}>
            <ProviderRack>{deck.providers.length ? deck.providers.slice(0, 3).map((provider) => <ProviderNode key={provider.id} provider={provider} telemetry={showcase?.providers[provider.id]} t={tr} onSelect={() => openInspector(provider.title, provider.id, [[tr("state", "State"), rowText(provider, "status", "UNKNOWN")], [tr("connections", "Connections"), String(provider.connections?.length ?? 0)], [tr("catalogModels", "Catalog models"), String(provider.models?.length ?? 0)], [tr("source", "Source"), showcase ? "DEVELOPMENT DEMO FIXTURE" : "OIC provider snapshot"]], "providers")} />) : <div className="fd-empty">{tr("noProviders", "No provider definitions were returned.")}</div>}</ProviderRack>
          </FlightDeckSection>

          <FlightDeckSection index="07" title={tr("modelFactory", "MODEL FACTORY")} className="fd-factory" action={<BayActions inspect={tr("inspect", "Inspect")} onInspect={() => inspectBay(tr("modelFactory", "Model Factory"), "factory", "models", deck.core.filter((item) => item.metricKey.includes("model-") || item.metricKey.includes("bindings")))} open={tr("openFactory", "Model Factory")} onOpen={() => navigate("models")} />}>
            <AssemblyPipeline size="MD" label={tr("modelFactoryProcess", "Model factory assembly pipeline")} stages={factoryStages} selectedStage={undefined} onSelect={(id) => { const metric = byKey(id); if (metric) inspectMetric(metric, metricTitle(metric)); }} />
            <FactoryReadout showcase={showcase} byKey={byKey} t={tr} />
          </FlightDeckSection>

          <FlightDeckSection index="08" title={tr("intelligenceLab", "INTELLIGENCE LAB")} className="fd-lab" action={<BayActions inspect={tr("inspect", "Inspect")} onInspect={() => inspectBay(tr("intelligenceLab", "Intelligence Lab"), "lab", "workbench", deck.instances.filter((item) => item.domain === "cognitive"))} open={tr("openRuns", "Workbench / Traces")} onOpen={() => navigate("workbench")} />}>
            <LabRack showcase={showcase} deck={deck} locale={locale} t={tr} onInspect={(title, value, state, demo = false) => openInspector(title, "intelligence-lab", [[tr("value", "Value"), String(value)], [tr("state", "State"), state], [tr("source", "Source"), demo ? "DEVELOPMENT DEMO FIXTURE" : "OIC snapshot / bounded execution sample"]], "workbench", demo)} onMetric={(metric) => inspectMetric(metric, metricTitle(metric))} />
          </FlightDeckSection>

          <FlightDeckSection index="09" title={tr("cognitiveActivity", "COGNITIVE ACTIVITY")} className="fd-cognitive" action={<BayActions inspect={tr("inspect", "Inspect")} onInspect={() => inspectBay(tr("cognitiveActivity", "Cognitive Activity"), "cognitive", "traces", deck.instances.filter((item) => item.domain === "cognitive"))} open={tr("inspectTraces", "Execution Traces")} onOpen={() => navigate("traces")} />}>
            {showcase ? <SensorRack label={tr("cognitiveActivity", "Cognitive activity")}>{showcase.cognitive.map((signal) => <ShowcaseSignalInstrument key={signal.id} signal={signal} locale={locale} size="SM" onSelect={() => inspectSignal(signal, "traces")} />)}</SensorRack> : <div className="fd-cognitive-live" role="group" aria-label={tr("cognitiveActivity", "Cognitive activity")}>{cognitiveMetrics.map((metric) => showMetric(metric, metricTitle(metric), true))}</div>}
          </FlightDeckSection>

          <FlightDeckSection index="10" title={tr("liveOperations", "LIVE OPERATIONS")} className="fd-operations" action={<span className="fd-bay-actions"><button type="button" onClick={() => inspectBay(tr("liveOperations", "Live Operations"), "operations", "health", deck.instances.filter((item) => item.domain === "operations" || item.metricKey.includes("api") || item.metricKey.includes("database")))}>{tr("inspect", "Inspect")} ↗</button><button type="button" onClick={() => navigate("health")}>{tr("healthReadiness", "Health")} →</button><button type="button" onClick={() => navigate("audit")}>{tr("audit", "Audit")} →</button></span>}>
            <OperationsStrip>{showcase ? showcase.operations.map((signal) => <ShowcaseSignalInstrument key={signal.id} signal={signal} locale={locale} size="SM" onSelect={() => inspectSignal(signal, "health")} />) : <>
              {byKey("system.api.live") && showMetric(byKey("system.api.live")!, "API", true)}
              {byKey("system.database.ready") && showMetric(byKey("system.database.ready")!, "DB", true)}
              <StableInstrumentCell label={tr("queue", "Queue")} state={tr("UNMEASURED", "UNMEASURED")}><NumericInstrument value={null} label={tr("queue", "Queue")} state="UNMEASURED" stateLabel="--" size="SM" /></StableInstrumentCell>
              {byKey("system.audit.sample-count") && showMetric(byKey("system.audit.sample-count")!, tr("audit", "Audit"), true)}
              {byKey("operations.provider-unhealthy") && showMetric(byKey("operations.provider-unhealthy")!, tr("faults", "Faults"), true)}
            </>}</OperationsStrip>
            <EventList title={tr("recentEvents", "RECENT EVENTS")} rows={recentActivity.slice(0, 3)} locale={locale} t={tr} getPrimary={(event) => rowText(event, "eventTitle", "Event")} getSecondary={(event) => rowText(event, "eventDetail", "OIC")} getTime={(event) => rowText(event, "eventTime", "")} empty={tr("noExecutionRecords", "No recent events in this sample.")} onOpen={() => navigate("traces")} />
          </FlightDeckSection>
        </FlightDeckBoard>
      </section>
    </section>
    {selected && <DetailDrawer definition={selected.definition} instance={selected.instance} entity={selected.entity} onClose={() => setSelected(null)} onDrilldown={() => { navigate(destination(selected.definition.drilldown ?? "")); setSelected(null); }} dir={locale === "ar" ? "rtl" : "ltr"} t={tr} />}
    {inspector && <FlightDeckInspector title={inspector.title} entity={inspector.entity} rows={inspector.rows} demo={inspector.demo} close={() => setInspector(null)} open={() => { navigate(inspector.destination); setInspector(null); }} dir={locale === "ar" ? "rtl" : "ltr"} t={tr} />}
  </>;
}

const unavailableSignal = (id: string, label: string, labelAr: string, kind: ShowcaseSignal["kind"]): ShowcaseSignal => ({ id, label, labelAr, kind, state: "UNMEASURED", stateLabel: "UNMEASURED", stateLabelAr: "غير مقاس", value: null });
const selectedSignal = (signals: ShowcaseOverviewData["system"] | undefined, fallback: ShowcaseSignal) => signals?.find((signal) => signal.id === fallback.id) ?? fallback;

function BayActions({ inspect, onInspect, open, onOpen }: { inspect: string; onInspect: () => void; open: string; onOpen: () => void }) {
  return <span className="fd-bay-actions"><button type="button" onClick={onInspect}>{inspect} ↗</button><button type="button" onClick={onOpen}>{open} →</button></span>;
}

function InstrumentControl({ label, state, onSelect, children }: { label: string; state?: string; onSelect: () => void; children: ReactNode }) {
  return <div className="fd-visual-control"><StableInstrumentCell label={label} state={state}>{children}</StableInstrumentCell><button type="button" className="fd-entity-hit" aria-label={`Inspect ${label}`} onClick={onSelect}>{label}</button></div>;
}

function FlightDeckInspector({ title, entity, rows, demo, close, open, dir, t }: { title: string; entity: string; rows: Array<[string, string]>; demo: boolean; close: () => void; open: () => void; dir: "ltr" | "rtl"; t: (key: string, fallback?: string) => string }) {
  return <Inspector open onClose={close} title={title} description={<>{demo ? "DEMO VALUE · DEVELOPMENT ONLY" : t("subsystemDetails", "SUBSYSTEM INSPECTOR")} / <bdi>{entity}</bdi></>} closeLabel={t("close", "Close")} dir={dir} footer={<button type="button" className="button primary" onClick={open}>{t("openWorkspace", "Open workspace")} →</button>}>
    <dl>{rows.length ? rows.map(([label, value]) => <Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>) : <><dt>{t("state", "State")}</dt><dd>{t("noMeasurements", "No measurements are available in this source snapshot.")}</dd></>}</dl>
    {demo && <p className="fd-demo-inspector-note">DEMO VALUES ONLY · NOT LIVE OIC TELEMETRY</p>}
  </Inspector>;
}

function SystemStateBay({ data, deck, apiState, databaseState, byKey, t, onCount }: { data: Snapshot | null; deck: DeckData; apiState: InstrumentState; databaseState: InstrumentState; byKey: (key: string) => MetricInstance | undefined; t: (key: string, fallback?: string) => string; onCount: (key: string, label: string) => void }) {
  const count = (key: string) => { const value = byKey(key)?.value; return typeof value === "number" ? value : null; };
  const scale = [
    { label: "APP", value: count("system.applications.count") }, { label: "TEN", value: count("system.tenants.count") },
    { label: "SP", value: count("system.principals.count") }, { label: "PRV", value: data ? deck.providers.length : null },
    { label: "MOD", value: count("system.upstream-models.count") }, { label: "BND", value: count("system.runtime-bindings.count") }
  ];
  return <div className="fd-state-bay">
    <div className="fd-state-rings">
      <InstrumentControl label="API readiness" onSelect={() => onCount("system.api.live", "API readiness")}><StatusRing state={apiState} stateLabel={apiState === "LIVE" ? t("LIVE", "LIVE") : t(apiState, apiState)} label="API" size="MD" /></InstrumentControl>
      <InstrumentControl label="Database readiness" onSelect={() => onCount("system.database.ready", "Database readiness")}><StatusRing state={databaseState} stateLabel={databaseState === "READY" ? t("READY", "READY") : t(databaseState, databaseState)} label="DB" size="MD" /></InstrumentControl>
    </div>
    <div className="fd-scale-matrix" aria-label={t("platformScale", "Platform scale")}>
      {scale.map((item) => { const key = ({ APP: "system.applications.count", TEN: "system.tenants.count", SP: "system.principals.count", PRV: "system.provider-connections.count", MOD: "system.upstream-models.count", BND: "system.runtime-bindings.count" } as Record<string, string>)[item.label]; const full = ({ APP: "Applications", TEN: "Tenants", SP: "Service principals", PRV: "Providers", MOD: "Upstream models", BND: "Bindings" } as Record<string, string>)[item.label]; return <InstrumentControl key={item.label} label={full} onSelect={() => onCount(key, full)}><NumericInstrument className="fd-scale-value" value={item.value} label={item.label} state={item.value === null ? "UNMEASURED" : "LIVE"} stateLabel={item.value === null ? "--" : ""} size="SM" /></InstrumentControl>; })}
    </div>
  </div>;
}

function IntelligenceBay({ signals, locale, onInspect }: { signals?: ShowcaseOverviewData["system"]; locale: Locale; onInspect: (signal: ShowcaseSignal) => void }) {
  const definitions = [
    ["reasoning", "Reasoning", "الاستدلال", "radial"], ["retrieval", "Retrieval", "الاسترجاع", "radial"], ["memory", "Memory utility", "منفعة الذاكرة", "radial"],
    ["verification", "Verification", "التحقق", "radial"], ["reliability", "Reliability", "الموثوقية", "radial"], ["context-band", "Context efficiency", "كفاءة السياق", "arc"]
  ] as const;
  return <div className="fd-intelligence-matrix">{definitions.map(([id, label, labelAr, kind]) => { const signal = selectedSignal(signals, unavailableSignal(id, label, labelAr, kind)); return <ShowcaseSignalInstrument key={id} signal={signal} locale={locale} size="MD" onSelect={() => onInspect(signal)} />; })}</div>;
}

function CoreVitalsBay({ signals, demo, locale, onInspect }: { signals: readonly ShowcaseSignal[]; demo: boolean; locale: Locale; onInspect: (signal: ShowcaseSignal) => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!demo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [demo]);
  const signalFor = (definition: (typeof coreVitalRegistry)[number]): ShowcaseSignal => {
    const source = signals.find((signal) => signal.id === definition.id);
    const base = source ?? productionCoreVitalSignals().find((signal) => signal.id === definition.id)!;
    if (!demo || typeof base.value !== "number") return base;
    const phase = (coreVitalRegistry.indexOf(definition) % 7) * 0.77;
    const amplitude = definition.phase === "PRIMARY" ? 3 : 5;
    const minimum = definition.bounds?.[0] ?? 0;
    const maximum = definition.bounds?.[1] ?? (base.value + amplitude);
    const sampleAt = (time: number) => Math.max(minimum, Math.min(maximum, base.value as number + Math.sin(time / 2.7 + phase) * amplitude));
    return { ...base, value: Math.round(sampleAt(tick)), samples: Array.from({ length: 12 }, (_, index) => sampleAt(tick - 11 + index)) };
  };
  const groups = {
    PRIMARY: coreVitalRegistry.filter((item) => item.phase === "PRIMARY"),
    SECONDARY: coreVitalRegistry.filter((item) => item.phase === "SECONDARY"),
    THROUGHPUT: coreVitalRegistry.filter((item) => item.phase === "THROUGHPUT")
  };
  const renderInstrument = (definition: (typeof coreVitalRegistry)[number], size: "XS" | "SM" | "MD") => {
    const signal = signalFor(definition);
    return <ShowcaseSignalInstrument key={definition.id} signal={signal} locale={locale} size={size} onSelect={() => onInspect(signal)} />;
  };
  return <div className="fd-vitals-rack" role="group" aria-label={locale === "ar" ? "العلامات الحيوية لنواة OIC" : "OIC core vital signs"} data-source={demo ? "development-demo" : "production-snapshot-only"}>
    <div className="fd-vitals-primary" aria-label={locale === "ar" ? "الضغوط الأساسية" : "Primary pressures"}>{groups.PRIMARY.map((item) => renderInstrument(item, "MD"))}</div>
    <div className="fd-vitals-secondary" aria-label={locale === "ar" ? "ضغوط الأنظمة الفرعية" : "Subsystem pressures"}>{groups.SECONDARY.map((item) => renderInstrument(item, "XS"))}</div>
    <div className="fd-vitals-throughput" aria-label={locale === "ar" ? "معدل التشغيل" : "Throughput"}>{groups.THROUGHPUT.map((definition) => {
      const signal = signalFor(definition);
      const label = locale === "ar" ? definition.shortLabelAr : definition.shortLabel;
      const state = signal.state;
      return <button key={definition.id} type="button" className={`fd-vital-throughput-slot fd-signal-${state.toLowerCase()}`} onClick={() => onInspect(signal)} aria-label={`${label}: ${signal.value ?? signal.stateLabel} ${definition.unit}`}>
        <StableInstrumentCell label={label} state={state === "UNMEASURED" || state === "UNAVAILABLE" ? state : signal.stateLabel}>
          <div className="fd-vital-throughput-readout"><NumericInstrument value={typeof signal.value === "number" ? signal.value : null} label={label} unit={definition.unit} state={state} stateLabel={state === "UNMEASURED" || state === "UNAVAILABLE" ? "--" : signal.stateLabel} size="XS" /><TelemetryStrip label={`${label} trend`} samples={signal.samples ?? []} min={0} max={Math.max(100, ...(signal.samples ?? [100]))} mode="LINE" size="XS" /></div>
        </StableInstrumentCell>
      </button>;
    })}</div>
  </div>;
}

function CoreLoadRail({ vitals, energyDraw, demo, locale, onSelect }: { vitals: readonly ShowcaseSignal[]; energyDraw: number | null; demo: boolean; locale: Locale; onSelect: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!demo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [demo]);
  const animated = demo ? vitals.map((signal, index) => {
    if (typeof signal.value !== "number") return signal;
    const phase = index * 0.53;
    const drift = Math.sin(tick / 3.4 + phase) * 2.4;
    const min = signal.min ?? 0;
    const max = signal.max ?? Number.POSITIVE_INFINITY;
    return { ...signal, value: Math.round(Math.max(min, Math.min(max, signal.value + drift))) };
  }) : [];
  const movingEnergy = energyDraw == null ? null : Math.round(Math.max(0, Math.min(120, energyDraw + Math.sin(tick / 4.1 + 0.6) * 1.5)));
  const summary = demo ? buildDemoCoreLoad(animated, movingEnergy) : buildProductionCoreLoad();
  const stateLabel = summary.state === "DEMO"
    ? `${locale === "ar" ? "عرض توضيحي" : "DEMO"} · ${locale === "ar" ? ({ LOW: "منخفض", NOMINAL: "طبيعي", ELEVATED: "مرتفع", HIGH: "عالٍ", CRITICAL: "حرج" } as const)[summary.band ?? "LOW"] : summary.band}`
    : locale === "ar" ? "غير مقاس" : "UNMEASURED";
  const scale = demo ? { polarity: "HIGH_IS_BAD" as const, zones: [
    { from: 0, to: 20, state: "NORMAL" as const, label: "LOW" },
    { from: 20, to: 55, state: "TARGET" as const, label: "NOMINAL" },
    { from: 55, to: 70, state: "ELEVATED" as const, label: "ELEVATED" },
    { from: 70, to: 85, state: "WARNING" as const, label: "HIGH" },
    { from: 85, to: 100, state: "CRITICAL" as const, label: "CRITICAL" }
  ] } : undefined;
  const label = locale === "ar" ? "حمل نواة OIC" : "OIC CORE LOAD";
  return <button type="button" className="hero-core-load" onClick={onSelect} aria-label={`${label}: ${stateLabel}; ${locale === "ar" ? "التغطية" : "coverage"} ${summary.measured} of ${summary.total}`} data-band={summary.band?.toLowerCase() ?? "unmeasured"}>
    <span className="hero-core-load-label">{label}<small>{stateLabel}</small></span>
    <span className="hero-core-load-meter"><CapacityRail label={label} value={summary.value ?? undefined} min={0} max={100} unit="%" state={summary.value === null ? "UNMEASURED" : "LIVE"} stateLabel={stateLabel} semanticScale={scale} size="MD" variant="WIDE" segments={28} /><span className="hero-core-load-markers" aria-hidden="true">{summary.contributors.map((item) => <i key={item.id} className={item.value == null ? "" : "measured"}/>)}</span></span>
    <span className="hero-core-load-coverage"><b>{summary.measured}/{summary.total}</b><small>{locale === "ar" ? "مصادر مقاسة" : "SIGNALS MEASURED"}</small></span>
  </button>;
}

function FleetDnaBay({ models, selected, comparison, selectedId, comparisonId, setSelected, setComparison, dimensions, compareDimensions, locale, t }: { models: DeckEntity[]; selected?: DeckEntity; comparison?: DeckEntity; selectedId: string; comparisonId: string; setSelected: (id: string) => void; setComparison: (id: string) => void; dimensions: DnaDimension[]; compareDimensions?: DnaDimension[]; locale: Locale; t: (key: string, fallback?: string) => string }) {
  const measured = dimensions.filter((dimension) => dimension.state === "MEASURED").length;
  return <div className="fd-dna-bay">
    <div className="fd-dna-selectors" dir={locale === "ar" ? "rtl" : "ltr"}>
      <ModelPicker density="compact" label={t("model", "Model")} value={selectedId} onChange={setSelected} options={models.map((model) => ({ id: model.id, label: model.title }))} placeholder={t("noRuntimeModels", "No runtime model")} searchLabel={t("search", "Search models")} emptyLabel={t("noRuntimeModels", "No runtime model")} disabled={!models.length} locale={locale} />
      <ModelPicker density="compact" label={t("compare", "Compare")} value={comparisonId} onChange={setComparison} options={models.filter((model) => model.id !== selected?.id).map((model) => ({ id: model.id, label: model.title }))} placeholder={t("none", "None")} searchLabel={t("search", "Search models")} emptyLabel={t("noRuntimeModels", "No runtime model")} disabled={models.length < 2} locale={locale} />
    </div>
    <div className="fd-dna-visual"><DNARadar size="LG" label={selected?.title ?? t("modelDna", "Fleet model DNA")} dimensions={dimensions} comparison={compareDimensions} dimensionsLabel={t("dimensionsLabel", "dimensions")} measuredLabel={t("measuredLabel", "measured")} confidenceLabel={t("confidenceLabel", "confidence")} /></div>
    <div className="fd-dna-legend"><span><i className="fd-dna-current" />{selected?.title ?? t("noRuntimeModels", "No runtime model")}</span><span><i className="fd-dna-compare" />{comparison?.title ?? `${measured} / ${dimensions.length} ${t("measured", "measured")}`}</span></div>
  </div>;
}

function FactoryReadout({ showcase, byKey, t }: { showcase?: ShowcaseOverviewData; byKey: (key: string) => MetricInstance | undefined; t: (key: string, fallback?: string) => string }) {
  const revisions = showcase?.factory.dormant ? null : byKey("system.model-revisions.count")?.value;
  const bindings = showcase?.factory.dormant ? null : byKey("system.runtime-bindings.count")?.value;
  return <div className="fd-factory-readout">
    {showcase && <StableInstrumentCell label={t("assemblyThroughput", "Assembly throughput")} state={showcase.factory.dormant ? t("UNMEASURED", "UNMEASURED") : showcase.factory.warningStage ? t("DEGRADED", "DEGRADED") : t("LIVE", "LIVE")}><CapacityRail value={showcase.factory.dormant ? undefined : showcase.factory.throughput} max={100} unit="%" label={t("assemblyThroughput", "Assembly throughput")} state={showcase.factory.dormant ? "UNMEASURED" : showcase.factory.warningStage ? "DEGRADED" : "LIVE"} stateLabel={showcase.factory.dormant ? "--" : showcase.factory.warningStage ? "DEGRADED" : "LIVE"} size="SM" variant="WIDE" /></StableInstrumentCell>}
    <StableInstrumentCell label={t("revisionCount", "Revisions")} state={typeof revisions === "number" ? t("LIVE", "LIVE") : t("UNMEASURED", "UNMEASURED")}><NumericInstrument value={typeof revisions === "number" ? revisions : null} label={t("revisionCount", "Revisions")} state={typeof revisions === "number" ? "LIVE" : "UNMEASURED"} stateLabel={typeof revisions === "number" ? "" : "--"} size="SM" /></StableInstrumentCell>
    <StableInstrumentCell label={t("bindings", "Bindings")} state={typeof bindings === "number" ? t("LIVE", "LIVE") : t("UNMEASURED", "UNMEASURED")}><NumericInstrument value={typeof bindings === "number" ? bindings : null} label={t("bindings", "Bindings")} state={typeof bindings === "number" ? "LIVE" : "UNMEASURED"} stateLabel={typeof bindings === "number" ? "" : "--"} size="SM" /></StableInstrumentCell>
  </div>;
}
function FleetRack({ children }: { children: ReactNode }) { return <div className="fd-fleet-rack">{children}</div>; }

function ModelPod({ model, telemetry, ordinal, locale, t, onSelect }: { model: DeckEntity; telemetry?: ShowcaseModelTelemetry; ordinal: number; locale: Locale; t: (key: string, fallback?: string) => string; onSelect: () => void }) {
  const variant = (model.variants as Row[])[0];
  const bindings = variant ? nested(variant, "bindings") : [];
  const provider = telemetry?.provider ?? rowText(variant ?? {}, "providerKey", t("providerUnavailable", "Unassigned"));
  const profile = telemetry?.profile ?? rowText(bindings[0] ?? {}, "profileKey", t("profileUnavailable", "Unassigned"));
  const revision = rowText((model.revisions as Row[])[0] ?? {}, "revision", "-");
  const state = telemetry?.state ?? "UNMEASURED";
  const stateLabel = telemetry ? (locale === "ar" ? telemetry.stateLabelAr : telemetry.stateLabel) : t("UNMEASURED", "UNMEASURED");
  const quality = telemetry?.intelligence;
  const reliability = telemetry?.reliability;
  const utilization = telemetry?.utilization;
  const context = telemetry?.context;
  const pressureZone = telemetry ? resolveThresholdZone(telemetry.latency, pressureScale) : null;
  const pressureState: InstrumentState = telemetry ? thresholdInstrumentState(pressureZone?.state) : "UNMEASURED";
  const pressureStateLabel = telemetry ? t(pressureZone?.label ?? pressureZone?.state ?? "UNAVAILABLE", pressureZone?.label ?? pressureZone?.state ?? "UNAVAILABLE") : "--";
  return <article className={`fd-model-pod fd-model-pod-${state.toLowerCase()}`}>
    <header className="fd-model-pod-head"><span className="fd-pod-index">{String(ordinal).padStart(2, "0")}</span><h4>{model.title}</h4><span className={`fd-state-chip ${model.lifecycle === "CANARY" ? "warn" : "good"}`}>{model.lifecycle}</span><StateBeacon state={state} stateLabel={stateLabel} size="XS" /></header>
    <div className="fd-model-pod-machine">
      <div className="fd-model-pod-primary"><RadialGauge value={quality} min={0} max={100} unit="%" label={t("intelligence", "Intelligence")} state={state} stateLabel={stateLabel} semanticScale={dnaScale} size="LG" /></div>
      <div className="fd-model-pod-pressure"><span className="fd-model-pod-zone-label">{t("latency", "LATENCY")}</span><div className="fd-model-pod-pressure-body"><VerticalPressureGauge value={telemetry?.latency} min={0} max={100} unit="%" label={t("latency", "Latency")} state={pressureState} stateLabel={pressureStateLabel} semanticScale={pressureScale} size="XS" /><div className="fd-model-pod-pressure-readout" aria-label={`${t("latency", "Latency")}: ${telemetry?.latency ?? "--"}%, ${pressureStateLabel}`}><b>{telemetry?.latency ?? "--"}<small>%</small></b><small>{telemetry ? pressureStateLabel : t("UNMEASURED", "UNMEASURED")}</small></div></div></div>
      <div className="fd-model-pod-rails">
        <CapacityRail value={reliability} max={100} unit="%" label={t("reliability", "Reliability")} state={telemetry ? "LIVE" : "UNMEASURED"} stateLabel={telemetry ? "LIVE" : "--"} semanticScale={dnaScale} size="SM" variant="WIDE" />
        <CapacityRail value={utilization} max={100} unit="%" label={t("resources", "Resources")} state={telemetry ? "LIVE" : "UNMEASURED"} stateLabel={telemetry ? "LIVE" : "--"} semanticScale={pressureScale} size="SM" variant="WIDE" />
        <CapacityRail value={context} max={100} unit="%" label={t("context", "Context")} state={telemetry ? "LIVE" : "UNMEASURED"} stateLabel={telemetry ? "LIVE" : "--"} size="SM" variant="WIDE" />
      </div>
    </div>
    <footer className="fd-model-pod-footer"><span><small>{t("provider", "PROVIDER")}</small><b>{provider}</b></span><span><small>{t("profile", "PROFILE")}</small><b>{profile}</b></span><span><small>{t("revisionCount", "REV")}</small><b>{revision}</b></span></footer>
    <button type="button" className="fd-entity-hit" aria-label={`${model.title}, ${model.lifecycle ?? "UNKNOWN"}, ${stateLabel}. Inspect model details`} onClick={onSelect}>{model.title}</button>
  </article>;
}
function ProviderRack({ children }: { children: ReactNode }) { return <div className="fd-provider-rack">{children}</div>; }

function ProviderNode({ provider, telemetry, t, onSelect }: { provider: DeckEntity; telemetry?: ShowcaseOverviewData["providers"][string]; t: (key: string, fallback?: string) => string; onSelect: () => void }) {
  const connections = provider.connections ?? [];
  const models = provider.models ?? [];
  const state: InstrumentState = connections.length === 0 && models.length === 0 ? "NOT_CONFIGURED" : providerState(provider);
  const stateLabel = state === "NOT_CONFIGURED" ? t("notConfigured", "NOT CONFIGURED") : rowText(provider, "status", "UNKNOWN").toUpperCase();
  return <article className={`fd-provider-node fd-provider-${state.toLowerCase()}`}>
    <header><span className="fd-provider-glyph">{rowText(provider, "key", provider.title).slice(0, 2).toUpperCase()}</span><h4>{provider.title}</h4><StateBeacon state={state} stateLabel={t(stateLabel, stateLabel)} size="XS" /></header>
    <div className="fd-provider-counts"><span><small>{t("connections", "CONN")}</small><b>{connections.length}</b></span><span><small>{t("catalogModels", "CATALOG")}</small><b>{models.length}</b></span><span><small>{t("models", "MODELS")}</small><b>{models.length}</b></span></div>
    {telemetry ? <div className="fd-provider-load"><CapacityRail value={telemetry.load} max={100} label={t("providerLoad", "Load")} unit="%" state={telemetry.load >= 85 ? "DEGRADED" : "LIVE"} semanticScale={pressureScale} size="SM" variant="WIDE" /></div> : <span className="fd-provider-load-empty">{connections.length ? t("UNMEASURED", "UNMEASURED") : t("notConfigured", "NOT CONFIGURED")}</span>}
    <button type="button" className="fd-entity-hit" aria-label={`${provider.title}, ${stateLabel}; ${connections.length} connections; ${models.length} catalog models. Inspect provider`} onClick={onSelect}>{provider.title}</button>
  </article>;
}
function LabRack({ showcase, deck, locale, t, onInspect, onMetric }: { showcase?: ShowcaseOverviewData; deck: DeckData; locale: Locale; t: (key: string, fallback?: string) => string; onInspect: (title: string, value: number | string, state: string, demo?: boolean) => void; onMetric: (metric: MetricInstance) => void }) {
  const sampleMetric = deck.instances.find((metric) => metric.metricKey === "system.execution-sample-count");
  const distributionMetric = deck.instances.find((metric) => metric.metricKey === "lab.execution.status-distribution");
  if (!showcase) return <div className="fd-lab-live">
    <div className="fd-lab-live-grid">
      {sampleMetric ? <Instrument key={sampleMetric.metricKey} definition={metricDefinitions.find((item) => item.key === sampleMetric.metricKey)!} instance={sampleMetric} title={t("executionSample", "Execution sample")} compact t={t} onSelect={() => onMetric(sampleMetric)} /> : <StableInstrumentCell label={t("executionSample", "Execution sample")} state={t("UNMEASURED", "UNMEASURED")}><NumericInstrument value={null} label={t("executionSample", "Execution sample")} state="UNMEASURED" stateLabel="--" size="SM" /></StableInstrumentCell>}
      <InstrumentControl label={t("evaluation", "Evaluation")} onSelect={() => onInspect(t("evaluation", "Evaluation"), "--", "UNMEASURED")}><StableInstrumentCell label={t("evaluation", "Evaluation")} state={t("UNMEASURED", "UNMEASURED")}><RadialGauge value={undefined} min={0} max={100} unit="%" label={t("evaluation", "Evaluation")} state="UNMEASURED" stateLabel="--" size="SM" /></StableInstrumentCell></InstrumentControl>
      <InstrumentControl label={t("verification", "Verification")} onSelect={() => onInspect(t("verification", "Verification"), "--", "UNMEASURED")}><StableInstrumentCell label={t("verification", "Verification")} state={t("UNMEASURED", "UNMEASURED")}><RadialGauge value={undefined} min={0} max={100} unit="%" label={t("verification", "Verification")} state="UNMEASURED" stateLabel="--" size="SM" /></StableInstrumentCell></InstrumentControl>
      {distributionMetric && <Instrument key={distributionMetric.metricKey} definition={metricDefinitions.find((item) => item.key === distributionMetric.metricKey)!} instance={distributionMetric} title={t("executionOutcomes", "Execution outcomes")} compact t={t} onSelect={() => onMetric(distributionMetric)} />}
      <TelemetryStrip label={t("historyUnavailable", "Retained telemetry")} source={t("historyUnavailable", "No retained history")} />
    </div>
  </div>;
  const active = showcase.lab.runs > 0;
  const signalState: InstrumentState = showcase.lab.verification < 40 ? "FAULT" : "LIVE";
  const evaluationState = active ? resolveThresholdZone(showcase.lab.evaluation, dnaScale)?.label ?? "NORMAL" : "UNMEASURED";
  const verificationState = active ? resolveThresholdZone(showcase.lab.verification, dnaScale)?.label ?? "NORMAL" : "UNMEASURED";
  return <div className="fd-lab-showcase">
    <div className="fd-lab-grid">
      <InstrumentControl label="Runs" onSelect={() => onInspect("Runs", showcase.lab.runs, active ? "LIVE" : "DORMANT", true)}><NumericInstrument value={showcase.lab.runs} label={locale === "ar" ? "التشغيلات" : "Runs"} unit="runs" state={active ? "LIVE" : "UNMEASURED"} size="SM" /></InstrumentControl>
      <InstrumentControl label="Evaluation" state={evaluationState} onSelect={() => onInspect("Evaluation", showcase.lab.evaluation, active ? "LIVE" : "DORMANT", true)}><RadialGauge value={active ? showcase.lab.evaluation : undefined} min={0} max={100} unit="%" label={locale === "ar" ? "التقييم" : "Evaluation"} state={active ? "LIVE" : "UNMEASURED"} semanticScale={dnaScale} size="SM" /></InstrumentControl>
      <InstrumentControl label="Verification" state={verificationState} onSelect={() => onInspect("Verification", showcase.lab.verification, active ? signalState : "DORMANT", true)}><RadialGauge value={active ? showcase.lab.verification : undefined} min={0} max={100} unit="%" label={locale === "ar" ? "التحقق" : "Verification"} state={active ? signalState : "UNMEASURED"} semanticScale={dnaScale} size="SM" /></InstrumentControl>
      <InstrumentControl label="Run activity" onSelect={() => onInspect("Run activity", showcase.lab.samples.length, "DEMO WINDOW", true)}><div className="fd-lab-telemetry"><TelemetryStrip label={locale === "ar" ? "النشاط الزمني" : "Run activity"} samples={showcase.lab.samples} min={0} max={100} mode="HYBRID" size="SM" /><div><span>BASE</span><DeltaIndicator current={showcase.lab.evaluation} previous={Math.max(0, showcase.lab.evaluation - 6)} unit="pt" /><span>CAND</span><DeltaIndicator current={showcase.lab.verification} previous={Math.max(0, showcase.lab.verification - 3)} unit="pt" /></div></div></InstrumentControl>
    </div>
  </div>;
}
function EventList({ title, rows, locale, t, getPrimary, getSecondary, getTime, empty, onOpen }: { title: string; rows: Row[]; locale: Locale; t: (key: string, fallback?: string) => string; getPrimary: (row: Row) => string; getSecondary: (row: Row) => string; getTime: (row: Row) => string; empty: string; onOpen: () => void }) {
  const formatTime = (value: string) => { const date = new Date(value); return Number.isNaN(date.valueOf()) ? t("timeUnavailable", "Time unavailable") : new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(date); };
  return <section className="fd-event-list"><h4>{title}</h4>{rows.length ? <ul>{rows.map((row) => <li key={rowText(row, "traceId", rowText(row, "id"))}><button type="button" onClick={onOpen} title={getTime(row)}><b>{getPrimary(row)}</b><span>{getSecondary(row)}</span><time dateTime={getTime(row)}>{formatTime(getTime(row))}</time></button></li>)}</ul> : <p>{empty}</p>}</section>;
}

function FleetStandby({ data, deck, page, setPage, t, navigate }: {
  data: Snapshot | null;
  deck: DeckData;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  t: (key: string, fallback?: string) => string;
  navigate: () => void;
}) {
  const inventory = (data?.modelFamilies ?? []).flatMap((family, familyIndex) => {
    const familyName = rowText(family, "displayName", rowText(family, "familyKey", `Family ${familyIndex + 1}`));
    return nested(family, "editions").map((edition, editionIndex) => ({ id: rowText(edition, "id", `${familyName}-${editionIndex}`), title: rowText(edition, "displayName", rowText(edition, "editionKey", familyName)), lifecycle: rowText(edition, "lifecycle", "UNCLASSIFIED").toUpperCase() }));
  });
  const pageSize = 3;
  const pageCount = Math.max(1, Math.ceil(inventory.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = inventory.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const inventoryCounts = [
    ["modelFamilies", "Families", "system.model-families.count"],
    ["editions", "Editions", "system.model-editions.count"],
    ["revisions", "Revisions", "system.model-revisions.count"],
    ["bindings", "Bindings", "system.runtime-bindings.count"]
  ] as const;
  return <div className="fd-fleet-standby">
    <div className="fd-standby-summary"><StateBeacon state="IDLE" stateLabel={t("fleetStandby", "STANDBY / NO ACTIVE RUNTIME MODEL")} size="SM" /><b className="fd-standby-active-count">{deck.fleet.length}<small>{t("activeRuntimeModels", "ACTIVE RUNTIME MODELS")}</small></b><span>{t("noActiveModels", "No production or canary model currently qualifies for runtime.")}</span></div>
    <div className="fd-standby-counts" aria-label={t("modelInventory", "Known model inventory")}>{inventoryCounts.map(([key, fallback, metricKey]) => { const value = deck.core.find((metric) => metric.metricKey === metricKey)?.value; return <span key={key}><small>{t(key, fallback)}</small><b>{typeof value === "number" || typeof value === "string" ? value : "--"}</b></span>; })}</div>
    {visible.length > 0 && <div className="fd-standby-inventory">{visible.map((model) => <span key={model.id}>{model.title}<small>{model.lifecycle}</small></span>)}</div>}
    <footer><button type="button" onClick={navigate}>{t("openFactory", "Model Fabric")} &gt;</button>{pageCount > 1 && <div className="fd-bay-pager"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>&lt;</button><span>{currentPage + 1} / {pageCount}</span><button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>&gt;</button></div>}</footer>
  </div>;
}
