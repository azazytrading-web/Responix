"use client";

import { useEffect, useMemo, useState } from "react";
import { ArcMeter } from "../../components/instruments";
import {
  ActionButton,
  ActionCluster,
  ActionMenu,
  ApplyAction,
  ArmThenExecute,
  BatchActionBar,
  CancelAction,
  CommandBar,
  CommandStateCard,
  DangerAction,
  GhostAction,
  HoldToConfirm,
  IconAction,
  InlineAction,
  InspectAction,
  OpenWorkspaceAction,
  PrimaryAction,
  QuietAction,
  ResetAction,
  RetryAction,
  RevertDraftAction,
  SaveDraftAction,
  SecondaryAction,
  SplitAction,
  StickyActionBar,
  SuccessAction,
  WarningAction,
  BudgetSlider,
  IntensitySlider,
  PrecisionSlider,
  RangeSlider,
  ScalarSlider,
  SliderNumericInput,
  SteppedSlider,
  TargetRangeControl,
  ThresholdSlider,
  WeightSlider,
  NumericStepper,
  IncrementDecrementControl,
  BinarySwitch,
  DiscreteStepSelector,
  MultiStateSwitch,
  ParameterMatrix,
  SegmentedControl,
  Toggle,
  FineAdjustDial,
  PrecisionKnob,
  RotaryDial,
  ApplyVerifyPanel,
  ModelBindingSelector,
  PermissionScopeMatrix,
  ProfileTuningComposite,
  ProviderSetupComposite,
  ResourceBudgetController,
  ThresholdBandEditor,
  validateThresholdBands,
  WeightMixer,
  ApplicationPicker,
  CapabilityPicker,
  ChipSelector,
  DependencyPicker,
  EntityPicker,
  HierarchicalPicker,
  LifecyclePicker,
  ModelPicker,
  MultiSelect,
  ProfilePicker,
  ProviderPicker,
  RelationshipPicker,
  RevisionPicker,
  ScopePicker,
  SearchableSelect,
  ServicePrincipalPicker,
  TenantPicker,
  ConfigurationDiff,
  ConflictPanel,
  PermissionPanel,
  useConfigurationDraft,
  ImpactFeedback,
  CompareSurface,
  Inspector,
  RelationshipPanel,
  SidecarPanel,
  Timeline,
  ValidationPanel as SharedValidationPanel,
  WizardFrame,
  WorkspaceTabs
} from "../../components/interface";
import type {
  CommandStatus,
  InterfaceDensity,
  InterfaceDirection,
  InterfaceLocale,
  PermissionState
} from "../../components/interface";
import {
  interfaceDemoBudgets,
  interfaceDemoEntities,
  interfaceDemoPresets,
  interfaceDemoProfileRevisions,
  interfaceDemoProfileValues,
  interfaceDemoRelationshipLevels,
  interfaceDemoScopes,
  interfaceDemoThresholds,
  interfaceDemoWeights,
  interfaceDemoWeightPresets
} from "./demo-data";
import { interfaceMessages } from "./messages";
type GalleryState = "ready" | "loading" | "empty" | "error" | "stale";
type ControlState =
  | "default"
  | "hover"
  | "focus"
  | "active"
  | "dirty"
  | "validating"
  | "valid"
  | "invalid"
  | "loading"
  | "applying"
  | "success"
  | "failed"
  | "partial"
  | "denied"
  | "read-only"
  | "disabled"
  | "unavailable"
  | "not-configured"
  | "conflict"
  | "stale"
  | "armed"
  | "destructive"
  | "unknown-result";
type PickerKey =
  | "entity"
  | "application"
  | "tenant"
  | "provider"
  | "principal"
  | "model"
  | "profile"
  | "revision"
  | "scope"
  | "capability"
  | "lifecycle"
  | "relationship"
  | "dependency";

function Panel({
  index,
  title,
  description,
  children,
  className = "",
  id
}: {
  index: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`oi-gallery-panel ${className}`.trim()}>
      <header className="oi-gallery-panel-head">
        <span className="oi-section-index">{index}</span>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Specimen({
  title,
  children,
  className = ""
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`oi-specimen ${className}`.trim()}>
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function AnatomyOverlay({ enabled, parts }: { enabled: boolean; parts: readonly string[] }) {
  if (!enabled) return null;
  return <div className="oi-anatomy-overlay" aria-hidden="true">{parts.map((part) => <span key={part}>{part}</span>)}</div>;
}

export default function InterfaceSystemGallery() {
  const [locale, setLocale] = useState<InterfaceLocale>("en");
  const [direction, setDirection] = useState<InterfaceDirection>("ltr");
  const [preview, setPreview] = useState<"desktop" | "narrow">("desktop");
  const [density, setDensity] = useState<InterfaceDensity>("standard");
  const [showAnatomy, setShowAnatomy] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [galleryState, setGalleryState] = useState<GalleryState>("ready");
  const [controlState, setControlState] = useState<ControlState>("default");
  const [activeFamily, setActiveFamily] = useState("controls");
  const t = interfaceMessages[locale] as Record<string, string>;
  const dir = direction;

  useEffect(() => {
    const root = document.documentElement;
    const before = { lang: root.lang, dir: root.dir };
    root.lang = locale === "ar" ? "ar" : "en";
    root.dir = direction;
    return () => {
      root.lang = before.lang;
      root.dir = before.dir;
    };
  }, [locale, direction]);

  const [scalar, setScalar] = useState(52);
  const [precision, setPrecision] = useState(0.68);
  const [range, setRange] = useState<[number, number]>([28, 74]);
  const [step, setStep] = useState(3);
  const [intensity, setIntensity] = useState(72);
  const [budget, setBudget] = useState(36);
  const [weight, setWeight] = useState(42);
  const [threshold, setThreshold] = useState(74);
  const [targetRange, setTargetRange] = useState<[number, number]>([38, 68]);
  const [numeric, setNumeric] = useState(420);
  const [dial, setDial] = useState(6.4);
  const [fineDial, setFineDial] = useState(0.56);
  const [knob, setKnob] = useState(62);
  const [operatingMode, setOperatingMode] = useState("balanced");
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [lifecycle, setLifecycle] = useState("active");
  const [interval, setInterval] = useState("24h");
  const [providerSelection, setProviderSelection] = useState("");
  const [selectionMap, setSelectionMap] = useState<Record<PickerKey, string>>({
    entity: "demo-provider-openai",
    application: "demo-app-core",
    tenant: "tenant-alpha",
    provider: "demo-provider-openai",
    principal: "",
    model: "demo-model-core",
    profile: "demo-profile-balanced",
    revision: "demo-r7",
    scope: "",
    capability: "",
    lifecycle: "",
    relationship: "",
    dependency: ""
  });
  const [relationshipValues, setRelationshipValues] = useState<string[]>([]);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["models:read", "profiles:read"]);
  const [multi, setMulti] = useState(["tenant-alpha", "tenant-gamma"]);
  const [weights, setWeights] = useState([...interfaceDemoWeights]);
  const [bindingValues, setBindingValues] = useState<string[]>([
    "demo-family-core",
    "demo-edition-prod",
    "demo-revision-r4"
  ]);
  const [limits, setLimits] = useState([...interfaceDemoBudgets]);
  const [bands, setBands] = useState({ ...interfaceDemoThresholds });
  const [thresholdFlow, setThresholdFlow] = useState<"idle" | "previewed" | "applied" | "verified">(
    "idle"
  );
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardFinished, setWizardFinished] = useState(false);
  const [conflictVisible, setConflictVisible] = useState(true);
  const reactive = useConfigurationDraft(
    { reasoning: 68, retrieval: 56, verification: 82 },
    "demo-rev-7"
  );
  const [demoApplied, setDemoApplied] = useState(false);
  const localizedWeights = useMemo(
    () => weights.map((item) => ({ ...item, label: t[item.id] ?? item.label })),
    [weights, locale]
  );
  const persistedWeights = useMemo(
    () => Object.fromEntries(interfaceDemoWeights.map((item) => [item.id, item.value])),
    []
  );
  const profilePresets = useMemo(
    () =>
      interfaceDemoPresets.map((preset) => ({
        ...preset,
        label: t[preset.id] ?? preset.label,
        description: t[`${preset.id}Desc`] ?? preset.description
      })),
    [locale]
  );
  const weightPresets = useMemo(
    () =>
      interfaceDemoWeightPresets.map((preset) => ({
        ...preset,
        label: t[preset.id] ?? preset.label,
        description: t[`${preset.id}Desc`] ?? preset.description
      })),
    [locale]
  );
  const localizedBudgets = useMemo(
    () =>
      limits.map((limit) => ({
        ...limit,
        label: t[`${limit.id}Budget`] ?? limit.label,
        unit:
          limit.id === "retrieval"
            ? t.stepsUnit
            : limit.id === "search"
              ? t.nodesUnit
              : limit.id === "output"
                ? t.tokensUnit
                : t.callsUnit
      })),
    [limits, locale]
  );

  const pickerData = useMemo(() => {
    const base = interfaceDemoEntities.map((item) => ({
      ...item,
      secondary: t.demoFixture,
      disabledReason: item.disabledReason ? t.archivedFixtureDisabled : undefined
    }));
    const option = (id: string, label: string, type: string) => ({
      id,
      label,
      secondary: t.demoFixture,
      type,
      scope: "Sandbox",
      lifecycle: "Active",
      status: "healthy" as const
    });
    return {
      entity: base,
      application: [
        option("demo-app-core", "Oi Core Console", "Application"),
        option("demo-app-lab", "Oi Lab Harness", "Application")
      ],
      tenant: [
        option("tenant-alpha", "Northstar Sandbox", "Tenant"),
        option("tenant-gamma", "Signal Test Range", "Tenant")
      ],
      provider: base,
      principal: [
        option("demo-principal-a", "runtime-observer", "Principal"),
        option("demo-principal-b", "catalog-operator", "Principal")
      ],
      model: [
        option("demo-model-core", "Oi Core / 1.7", "Model"),
        option("demo-model-reason", "Oi Reasoning / 1.6", "Model")
      ],
      profile: [
        option("demo-profile-balanced", "Balanced production", "Profile"),
        option("demo-profile-lab", "Evaluation profile", "Profile")
      ],
      revision: [
        option("demo-r7", "Revision 7 · current", "Revision"),
        option("demo-r6", "Revision 6 · previous", "Revision")
      ],
      scope: [
        option("demo-scope-read", "models:read", "Scope"),
        option("demo-scope-run", "runtime:invoke", "Scope")
      ],
      capability: [
        option("demo-cap-json", "Structured response", "Capability"),
        option("demo-cap-tool", "Tool routing", "Capability")
      ],
      lifecycle: [
        option("demo-life-active", "Active", "Lifecycle"),
        option("demo-life-draft", "Draft", "Lifecycle")
      ],
      relationship: [
        option("demo-rel-binding", "Provider connection binding", "Relationship"),
        option("demo-rel-tenant", "Application tenant grant", "Relationship")
      ],
      dependency: [
        option("demo-dep-policy", "Runtime policy", "Dependency"),
        option("demo-dep-catalog", "Upstream catalog source", "Dependency")
      ]
    };
  }, [locale]);

  const pickerStatusLabels = {
    healthy: t.healthy,
    warning: t.warning,
    critical: t.critical,
    inactive: t.inactiveStatus,
    unknown: t.unknownStatus
  };
  const pickerLifecycleLabels = {
    Active: t.lifecycleActive,
    Draft: t.lifecycleDraft,
    Production: t.lifecycleProduction,
    Canary: t.lifecycleCanary,
    Preview: t.lifecyclePreview,
    Current: t.lifecycleCurrent,
    Previous: t.lifecyclePrevious,
    Inactive: t.inactiveStatus,
    Configured: t.ready
  };

  const bindingLevels = useMemo(() => {
    const labels: Record<string, string> = {
      "demo-edition-prod": `1.7 · ${t.lifecycleProduction}`,
      "demo-edition-canary": `1.6 · ${t.lifecycleCanary}`,
      "demo-edition-vision": `1.0 · ${t.lifecyclePreview}`,
      "demo-revision-r4": `${t.revision} 4 · ${t.lifecycleCurrent}`,
      "demo-revision-r3": `${t.revision} 3 · ${t.lifecyclePrevious}`,
      "demo-revision-v1": `${t.revision} 1 · ${t.lifecyclePreview}`
    };
    return interfaceDemoRelationshipLevels.map((level, index) => ({
      ...level,
      label: [t.modelFamily, t.edition, t.revision][index] ?? level.label,
      options: level.options.map((option) => ({
        ...option,
        label: labels[option.id] ?? option.label,
        type: [t.modelFamily, t.edition, t.revision][index] ?? option.type,
        scope: t.demoFixture,
        lifecycle:
          (
            {
              Active: t.lifecycleActive,
              Draft: t.lifecycleDraft,
              Production: t.lifecycleProduction,
              Canary: t.lifecycleCanary,
              Preview: t.lifecyclePreview,
              Current: t.lifecycleCurrent,
              Previous: t.lifecyclePrevious
            } as Record<string, string>
          )[option.lifecycle ?? ""] ?? option.lifecycle
      }))
    }));
  }, [locale]);

  const scopeOptions = useMemo(
    () =>
      interfaceDemoScopes.map((scope) => ({
        ...scope,
        description:
          (
            {
              "models:read": t.readModelDefinitions,
              "profiles:read": t.readProfileRevisions,
              "runtime:invoke": t.invokeDemoRuntime,
              "providers:write": t.notGrantedFixture
            } as Record<string, string>
          )[scope.id] ?? t.demoFixture
      })),
    [locale]
  );

  const stateLabels: Record<CommandStatus, string> = {
    IDLE: t.idle,
    READY: t.ready,
    ARMED: t.armed,
    EXECUTING: t.executing,
    SUCCEEDED: t.success,
    FAILED: t.failed,
    PARTIAL: t.partial,
    CANCELLED: t.cancelled,
    BLOCKED: t.blocked,
    DENIED: t.denied,
    CONFLICT: t.conflict,
    UNKNOWN_RESULT: t.unknownResult
  };

  const picker = (key: PickerKey, Component: typeof EntityPicker, label: string) => (
    <Component
      key={key}
      label={label}
      value={selectionMap[key]}
      onChange={(value) => {
        setSelectionMap((map) => ({ ...map, [key]: value }));
        if (key === "provider") setProviderSelection(value);
      }}
      options={pickerData[key]}
      placeholder={label}
      searchLabel={t.search}
      emptyLabel={t.noResults}
      errorLabel={t.searchFailed}
      loadingLabel={t.searching}
      staleLabel={t.stale}
      resultCountLabel={t.resultCount}
      statusLabels={pickerStatusLabels}
      lifecycleLabels={pickerLifecycleLabels}
      locale={locale}
      dir={dir}
      kind={key}
      searchState={galleryState}
    />
  );

  const galleryStateOptions = [
    { id: "ready", label: t.ready },
    { id: "loading", label: t.loading },
    { id: "empty", label: t.empty },
    { id: "error", label: t.error },
    { id: "stale", label: t.stale }
  ];
  const operationStates: CommandStatus[] = [
    "IDLE",
    "READY",
    "ARMED",
    "EXECUTING",
    "SUCCEEDED",
    "FAILED",
    "PARTIAL",
    "CANCELLED",
    "BLOCKED",
    "DENIED",
    "CONFLICT",
    "UNKNOWN_RESULT"
  ];
  const controlStateLabels: Record<ControlState, string> = {
    default: t.defaultState,
    hover: t.hoverState,
    focus: t.focusState,
    active: t.activeState,
    dirty: t.dirtyState,
    validating: t.validatingState,
    valid: t.validState,
    invalid: t.invalidState,
    loading: t.loadingState,
    applying: t.applyingState,
    success: t.successState,
    failed: t.failedState,
    partial: t.partialState,
    denied: t.deniedState,
    "read-only": t.readOnlyState,
    disabled: t.disabledState,
    unavailable: t.unavailableState,
    "not-configured": t.notConfiguredState,
    conflict: t.conflictState,
    stale: t.staleState,
    armed: t.armedState,
    destructive: t.destructiveState,
    "unknown-result": t.unknownResultState
  };
  const controlStateOptions = Object.entries(controlStateLabels).map(([id, label]) => ({
    id,
    label
  }));
  const familyOptions = [
    { id: "controls", label: t.controls },
    { id: "commands", label: t.commands },
    { id: "selection", label: t.selection },
    { id: "configuration", label: t.configuration },
    { id: "workspace", label: t.workspace },
    { id: "feedback", label: t.feedback },
    { id: "states", label: t.states },
    { id: "composites", label: t.composites }
  ];
  const goToFamily = (family: string) => {
    setActiveFamily(family);
    window.requestAnimationFrame(() =>
      document
        .getElementById(`oi-interface-${family}`)
        ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })
    );
  };
  const selectedPermission: PermissionState =
    controlState === "read-only"
      ? { kind: "read-only", reason: t.readOnly }
      : controlState === "denied"
        ? { kind: "denied", reason: t.denied }
        : controlState === "unavailable"
          ? { kind: "unavailable", reason: t.unavailable }
          : controlState === "not-configured"
            ? { kind: "unsupported", reason: t.unsupported }
            : { kind: "allowed" };
  const disabledControl =
    controlState === "disabled" ||
    controlState === "not-configured" ||
    controlState === "unavailable" ||
    controlState === "denied" ||
    controlState === "loading" ||
    controlState === "applying";
  const stateInputError = controlState === "invalid" ? t.boundsError : undefined;
  const thresholdValid = validateThresholdBands(bands, 0, 100).length === 0;

  return (
    <main
      className={`oi-interface-system ${reducedMotion ? "prefers-reduced-motion" : ""}`}
      lang={locale}
      dir={dir}
      data-locale={locale}
      data-density={density}
      data-anatomy={showAnatomy ? "true" : undefined}
    >
      <div className="oi-interface-shell">
        <header className="oi-interface-header">
          <div className="oi-brand-lockup">
            <span className="oi-brand-mark">Oi</span>
            <div>
              <span>{t.eyebrow}</span>
              <h1>{t.title}</h1>
              <p>{t.subtitle}</p>
            </div>
          </div>
          <span className="oi-dev-stamp">X1.3B · DEV ONLY</span>
        </header>
        <div className="oi-demo-banner" role="note">
          <i aria-hidden="true" />
          {t.demoOnly}
        </div>

        <section className="oi-gallery-control-deck" aria-label={t.sectionIndex}>
          <div className="oi-gallery-control-group">
            <b>{t.language}</b>
            <div>
              <button
                type="button"
                className={locale === "en" ? "is-selected" : ""}
                aria-pressed={locale === "en"}
                onClick={() => setLocale("en")}
              >
                {t.english}
              </button>
              <button
                type="button"
                className={locale === "ar" ? "is-selected" : ""}
                aria-pressed={locale === "ar"}
                onClick={() => setLocale("ar")}
              >
                {t.arabic}
              </button>
            </div>
          </div>
          <div className="oi-gallery-control-group">
            <b>{t.direction}</b>
            <div>
              <button
                type="button"
                className={dir === "ltr" ? "is-selected" : ""}
                aria-pressed={dir === "ltr"}
                onClick={() => setDirection("ltr")}
              >
                {t.ltr}
              </button>
              <button
                type="button"
                className={dir === "rtl" ? "is-selected" : ""}
                aria-pressed={dir === "rtl"}
                onClick={() => setDirection("rtl")}
              >
                {t.rtl}
              </button>
            </div>
          </div>
          <div className="oi-gallery-control-group">
            <b>{t.viewport}</b>
            <div>
              <button
                type="button"
                className={preview === "desktop" ? "is-selected" : ""}
                aria-pressed={preview === "desktop"}
                onClick={() => setPreview("desktop")}
              >
                {t.desktop}
              </button>
              <button
                type="button"
                className={preview === "narrow" ? "is-selected" : ""}
                aria-pressed={preview === "narrow"}
                onClick={() => setPreview("narrow")}
              >
                {t.narrow}
              </button>
            </div>
          </div>
          <div className="oi-gallery-control-group">
            <b>{t.density}</b>
            <div>
              <button
                type="button"
                className={density === "compact" ? "is-selected" : ""}
                aria-pressed={density === "compact"}
                onClick={() => setDensity("compact")}
              >
                {t.compact}
              </button>
              <button
                type="button"
                className={density === "standard" ? "is-selected" : ""}
                aria-pressed={density === "standard"}
                onClick={() => setDensity("standard")}
              >
                {t.standard}
              </button>
              <button
                type="button"
                className={density === "precision" ? "is-selected" : ""}
                aria-pressed={density === "precision"}
                onClick={() => setDensity("precision")}
              >
                {t.precisionDensity}
              </button>
            </div>
          </div>
          <DiscreteStepSelector
            label={t.family}
            value={activeFamily}
            onChange={goToFamily}
            options={familyOptions}
            placeholder={t.controls}
            dir={dir}
            locale={locale}
          />
          <Toggle label={t.reduced} value={reducedMotion} onChange={setReducedMotion} dir={dir} />
          <button type="button" className={`oi-anatomy-toggle ${showAnatomy ? "is-selected" : ""}`} aria-pressed={showAnatomy} onClick={() => setShowAnatomy((visible) => !visible)}>{showAnatomy ? t.hideAnatomy : t.showAnatomy}</button>
          <DiscreteStepSelector
            label={t.scenario}
            value={galleryState}
            onChange={(value) => setGalleryState(value as GalleryState)}
            options={galleryStateOptions}
            placeholder={t.ready}
            dir={dir}
            locale={locale}
          />
          <DiscreteStepSelector
            label={t.stateMatrix}
            value={controlState}
            onChange={(value) => setControlState(value as ControlState)}
            options={controlStateOptions}
            placeholder={t.defaultState}
            dir={dir}
            locale={locale}
          />
        </section>

        <div className={`oi-interface-preview is-${preview}`}>
          <div className="oi-preview-caption">
            <span>INTERFACE SYSTEM SPECIMENS</span>
            <span>{t.localOnly}</span>
          </div>

          <Panel
            id="oi-interface-controls"
            index="01"
            title={t.controls}
            description={t.controlsDesc}
            className="oi-panel-controls"
          >
            <div className="oi-specimen-grid">
              <Specimen title={t.slider}>
                <ScalarSlider
                  label={t.slider}
                  value={scalar}
                  onChange={setScalar}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  locale={locale}
                  dir={dir}
                  density={density}
                  markers={[{ value: 40, label: t.savedMarker, kind: "persisted" }]}
                  ticks={[
                    { value: 0, label: "0", major: true },
                    { value: 25, label: "25" },
                    { value: 50, label: "50", major: true },
                    { value: 75, label: "75" },
                    { value: 100, label: "100", major: true }
                  ]}
                />
                <AnatomyOverlay enabled={showAnatomy} parts={locale === "ar" ? ["الهيكل", "المسار النشط", "العقدة", "المعايرة", "القراءة", "الحالة"] : ["Housing", "Active rail", "Node", "Calibration", "Readout", "State"]} />
              </Specimen>
              <Specimen title={t.precision}>
                <PrecisionSlider
                  label={t.precision}
                  value={precision}
                  onChange={setPrecision}
                  min={0}
                  max={1}
                  step={0.01}
                  unit="×"
                  locale={locale}
                  dir={dir}
                  density={density}
                />
                <NumericStepper
                  label={`${t.precision} · ${t.exact}`}
                  value={precision}
                  onChange={setPrecision}
                  min={0}
                  max={1}
                  step={0.01}
                  unit="×"
                  locale={locale}
                  dir={dir}
                  density={density}
                />
              </Specimen>
              <Specimen title={t.range}>
                <RangeSlider
                  label={t.range}
                  value={range}
                  onChange={setRange}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  locale={locale}
                  dir={dir}
                  density={density}
                  lowerLabel={t.rangeMin}
                  upperLabel={t.rangeMax}
                />
              </Specimen>
              <Specimen title={t.stepped}>
                <SteppedSlider
                  label={t.stepped}
                  value={step}
                  onChange={setStep}
                  min={1}
                  max={5}
                  step={1}
                  locale={locale}
                  dir={dir}
                  density={density}
                  ticks={[
                    { value: 1, label: "1", major: true },
                    { value: 2, label: "2" },
                    { value: 3, label: "3", major: true },
                    { value: 4, label: "4" },
                    { value: 5, label: "5", major: true }
                  ]}
                />
              </Specimen>
              <Specimen title={t.intensity}>
                <IntensitySlider
                  label={t.intensity}
                  value={intensity}
                  onChange={setIntensity}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  help={t.capabilityHelp}
                  locale={locale}
                  dir={dir}
                  density={density}
                />
              </Specimen>
              <Specimen title={t.budget}>
                <BudgetSlider
                  label={t.budget}
                  value={budget}
                  onChange={setBudget}
                  min={0}
                  max={120}
                  step={5}
                  unit="calls"
                  locale={locale}
                  dir={dir}
                  density={density}
                />
              </Specimen>
              <Specimen title={t.weight}>
                <WeightSlider
                  label={t.weight}
                  value={weight}
                  onChange={setWeight}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  locale={locale}
                  dir={dir}
                  density={density}
                />
              </Specimen>
              <Specimen title={t.threshold}>
                <ThresholdSlider
                  label={t.threshold}
                  value={threshold}
                  onChange={(value) => {
                    setThreshold(value);
                    setThresholdFlow("idle");
                  }}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  locale={locale}
                  dir={dir}
                  density={density}
                  markers={[
                    { value: 55, label: t.elevated, kind: "warning" },
                    { value: 82, label: t.critical, kind: "critical" }
                  ]}
                />
              </Specimen>
              <Specimen title={t.target}>
                <TargetRangeControl
                  label={t.target}
                  value={targetRange}
                  target={[48, 62]}
                  targetLabel={t.target}
                  onChange={setTargetRange}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  locale={locale}
                  dir={dir}
                  density={density}
                />
              </Specimen>
              <Specimen title={t.numeric}>
                <NumericStepper
                  label={t.numeric}
                  value={numeric}
                  onChange={setNumeric}
                  min={0}
                  max={5000}
                  step={25}
                  unit={t.numberUnit}
                  locale={locale}
                  dir={dir}
                  density={density}
                />
              </Specimen>
              <Specimen title={t.hybrid}>
                <SliderNumericInput
                  label={t.hybrid}
                  value={numeric}
                  onChange={setNumeric}
                  min={0}
                  max={5000}
                  step={25}
                  unit={t.numberUnit}
                  locale={locale}
                  dir={dir}
                  density={density}
                />
              </Specimen>
              <Specimen title={t.dial}>
                <RotaryDial
                  label={t.dial}
                  value={dial}
                  onChange={setDial}
                  min={0}
                  max={12}
                  step={0.5}
                  fineStep={0.1}
                  unit={t.unitsUnit}
                  locale={locale}
                  dir={dir}
                  density={density}
                />
              </Specimen>
              <Specimen title={t.precisionDial}>
                <FineAdjustDial
                  label={t.precisionDial}
                  value={fineDial}
                  onChange={setFineDial}
                  min={0}
                  max={1}
                  step={0.05}
                  fineStep={0.01}
                  unit="×"
                  locale={locale}
                  dir={dir}
                  density={density}
                />
              </Specimen>
              <Specimen title={t.precisionKnob}>
                <PrecisionKnob
                  label={t.precisionKnob}
                  value={knob}
                  onChange={setKnob}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  locale={locale}
                  dir={dir}
                  density={density}
                />
              </Specimen>
              <Specimen title={t.segmented}>
                <SegmentedControl
                  label={t.segmented}
                  value={operatingMode}
                  onChange={setOperatingMode}
                  options={[
                    { id: "fast", label: t.fast },
                    { id: "balanced", label: t.balanced },
                    { id: "deep", label: t.deep }
                  ]}
                  dir={dir}
                />
              </Specimen>
              <Specimen title={t.toggle}>
                <Toggle
                  label={t.toggle}
                  value={featureEnabled}
                  onChange={setFeatureEnabled}
                  help={t.localOnly}
                  dir={dir}
                />
                <AnatomyOverlay enabled={showAnatomy} parts={locale === "ar" ? ["الهيكل", "مسار الطاقة", "المقبض", "مؤشر الحالة"] : ["Housing", "Energy rail", "Knob", "State marker"]} />
              </Specimen>
              <Specimen title={t.binarySwitch}>
                <BinarySwitch
                  label={t.binarySwitch}
                  value={featureEnabled}
                  onChange={setFeatureEnabled}
                  dir={dir}
                />
              </Specimen>
              <Specimen title={t.multiState}>
                <MultiStateSwitch
                  label={t.multiState}
                  value={lifecycle}
                  onChange={setLifecycle}
                  options={[
                    { id: "active", label: locale === "ar" ? "نشط" : "Active" },
                    { id: "draft", label: locale === "ar" ? "مسودة" : "Draft" },
                    { id: "retired", label: locale === "ar" ? "متقاعد" : "Retired" }
                  ]}
                  dir={dir}
                />
              </Specimen>
              <Specimen title={t.discrete}>
                <DiscreteStepSelector
                  label={t.discrete}
                  value={interval}
                  onChange={setInterval}
                  options={[
                    { id: "1h", label: "1h" },
                    { id: "6h", label: "6h" },
                    { id: "24h", label: "24h" },
                    { id: "7d", label: "7d" }
                  ]}
                  placeholder="24h"
                  dir={dir}
                  locale={locale}
                />
              </Specimen>
              <Specimen title={t.increment}>
                <IncrementDecrementControl
                  label={t.increment}
                  value={numeric}
                  onChange={setNumeric}
                  min={0}
                  max={5000}
                  step={25}
                  unit={t.numberUnit}
                  locale={locale}
                  dir={dir}
                  density={density}
                />
              </Specimen>
              <Specimen title={t.matrix}>
                <ParameterMatrix label={t.matrix}>
                  <div className="oi-matrix-head" role="row">
                    <b role="columnheader">{t.currentValue}</b>
                    <b role="columnheader">{t.draftValue}</b>
                  </div>
                  <div role="row">
                    <span role="cell">{t.reasoning}</span>
                    <span role="cell">{intensity}%</span>
                  </div>
                  <div role="row">
                    <span role="cell">{t.retrieval}</span>
                    <span role="cell">
                      {budget} {t.callsUnit}
                    </span>
                  </div>
                </ParameterMatrix>
              </Specimen>
            </div>
          </Panel>

          <Panel
            id="oi-interface-commands"
            index="02"
            title={t.commands}
            className="oi-panel-commands"
          >
            <div className="oi-command-layout">
              <Specimen title={t.commandLabels} className="oi-specimen-wide">
                <CommandBar title={t.commandLabels}>
                  <ActionCluster label={t.commandLabels}>
                    <PrimaryAction onPress={() => setDemoApplied(true)}>
                      {t.applyDemo}
                    </PrimaryAction>
                    <SecondaryAction onPress={() => setDemoApplied(true)}>
                      {t.saveDraft}
                    </SecondaryAction>
                    <QuietAction onPress={() => setDemoApplied(false)}>{t.reset}</QuietAction>
                    <DangerAction onPress={() => setDemoApplied(false)}>{t.cancel}</DangerAction>
                    <WarningAction onPress={() => setGalleryState("stale")}>
                      {t.warning}
                    </WarningAction>
                    <IconAction label={t.close} onPress={() => setInspectorOpen((open) => !open)}>
                      ×
                    </IconAction>
                  </ActionCluster>
                  <SplitAction
                    label={t.next}
                    onPress={() => setWizardStep((value) => Math.min(2, value + 1))}
                    menuLabel={t.actionMenu}
                    items={[
                      { id: "inspect", label: t.inspector },
                      { id: "reset", label: t.reset },
                      { id: "blocked", label: t.unsupported, disabled: true }
                    ]}
                    onAction={(id) => {
                      if (id === "inspect") setInspectorOpen(true);
                      if (id === "reset") setDemoApplied(false);
                    }}
                  />
                </CommandBar>
                <StickyActionBar label={t.pendingChanges}>
                  <span>{demoApplied ? t.success : t.draft}</span>
                  <ApplyAction onPress={() => setDemoApplied(true)}>{t.applyDemo}</ApplyAction>
                  <BatchActionBar count={2} label={t.commandLabels} selectedLabel={t.selectedCount}>
                    <QuietAction onPress={() => setDemoApplied(false)}>{t.cancel}</QuietAction>
                  </BatchActionBar>
                </StickyActionBar>
                <AnatomyOverlay enabled={showAnatomy} parts={locale === "ar" ? ["السطح", "حافة الأمر", "التسمية", "قناة التغذية", "علامة الأمر"] : ["Surface", "Command edge", "Label", "Feedback", "Command notch"]} />
              </Specimen>
              <Specimen title={t.stateCard}>
                <div className="oi-command-state-grid">
                  {operationStates.map((state) => (
                    <CommandStateCard key={state} state={state} labels={stateLabels} />
                  ))}
                </div>
              </Specimen>
              <Specimen title={t.additionalCommands}>
                <ActionCluster label={t.additionalCommands}>
                  <GhostAction onPress={() => setDemoApplied(false)}>{t.cancel}</GhostAction>
                  <InlineAction onPress={() => setInspectorOpen(true)}>
                    {t.inspectAction}
                  </InlineAction>
                  <SuccessAction onPress={() => setDemoApplied(true)}>{t.success}</SuccessAction>
                  <RetryAction onPress={() => setDemoApplied(false)}>{t.retry}</RetryAction>
                  <CancelAction onPress={() => setDemoApplied(false)}>{t.cancel}</CancelAction>
                  <SaveDraftAction onPress={() => setDemoApplied(true)}>
                    {t.saveDraft}
                  </SaveDraftAction>
                  <ResetAction onPress={() => setDemoApplied(false)}>{t.reset}</ResetAction>
                  <RevertDraftAction onPress={() => setDemoApplied(false)}>
                    {t.revertDraft}
                  </RevertDraftAction>
                  <InspectAction onPress={() => setInspectorOpen(true)}>
                    {t.inspector}
                  </InspectAction>
                  <OpenWorkspaceAction onPress={() => goToFamily("workspace")}>
                    {t.openWorkspace}
                  </OpenWorkspaceAction>
                  <ActionMenu
                    label={t.actionMenu}
                    items={[
                      { id: "inspect", label: t.inspector },
                      { id: "workspace", label: t.openWorkspace },
                      { id: "blocked", label: t.unsupported, disabled: true }
                    ]}
                    onAction={(id) => {
                      if (id === "inspect") setInspectorOpen(true);
                      if (id === "workspace") goToFamily("workspace");
                    }}
                  />
                </ActionCluster>
              </Specimen>
              <Specimen title={t.highConsequence}>
                <ArmThenExecute
                  title={t.highConsequence}
                  target={t.targetEntity}
                  consequence={t.consequenceCopy}
                  labels={{ arm: t.arm, execute: t.execute, cancel: t.cancel, status: stateLabels }}
                  onExecute={() => Promise.resolve("SUCCEEDED")}
                />
                <HoldToConfirm
                  label={t.hold}
                  holdLabel={t.hold}
                  completedLabel={t.holdComplete}
                  instruction={t.holdInstruction}
                  onConfirm={() => setDemoApplied(true)}
                />
              </Specimen>
            </div>
          </Panel>

          <Panel
            id="oi-interface-selection"
            index="03"
            title={t.selection}
            description={t.selectionTypes}
          >
            <div className="oi-specimen-grid oi-picker-grid">
              <Specimen title={t.searchableSelect}>
                {picker("entity", SearchableSelect, t.demoEntity)}
              </Specimen>
              <Specimen title={t.entityPicker}>
                {picker("entity", EntityPicker, t.demoEntity)}
              </Specimen>
              <Specimen title={t.applicationPicker}>
                {picker("application", ApplicationPicker, t.application)}
              </Specimen>
              <Specimen title={t.tenantPicker}>{picker("tenant", TenantPicker, t.tenant)}</Specimen>
              <Specimen title={t.providerPicker}>
                {picker("provider", ProviderPicker, t.provider)}
              </Specimen>
              <Specimen title={t.principalPicker}>
                {picker("principal", ServicePrincipalPicker, t.principalPicker)}
              </Specimen>
              <Specimen title={t.modelPicker}>
                {picker("model", ModelPicker, t.modelPicker)}
              </Specimen>
              <Specimen title={t.profilePicker}>
                {picker("profile", ProfilePicker, t.profilePicker)}
              </Specimen>
              <Specimen title={t.revisionPicker}>
                {picker("revision", RevisionPicker, t.revisionPicker)}
              </Specimen>
              <Specimen title={t.scopeSelector}>
                {picker("scope", ScopePicker, t.scopeSelector)}
              </Specimen>
              <Specimen title={t.capabilitySelector}>
                {picker("capability", CapabilityPicker, t.capabilitySelector)}
              </Specimen>
              <Specimen title={t.lifecyclePicker}>
                {picker("lifecycle", LifecyclePicker, t.lifecyclePicker)}
              </Specimen>
              <Specimen title={t.relationshipPicker}>
                {picker("relationship", RelationshipPicker, t.relationshipPicker)}
              </Specimen>
              <Specimen title={t.dependencyPicker}>
                {picker("dependency", DependencyPicker, t.dependencyPicker)}
              </Specimen>
              <Specimen title={t.multiSelect}>
                <MultiSelect
                  label={t.multiSelect}
                  values={multi}
                  onChange={setMulti}
                  options={pickerData.tenant.map((option) => ({
                    id: option.id,
                    label: option.label,
                    description: option.secondary
                  }))}
                  dir={dir}
                />
              </Specimen>
              <Specimen title={t.chipSelector}>
                <ChipSelector
                  label={t.chipSelector}
                  values={multi}
                  onChange={setMulti}
                  options={pickerData.tenant.map((option) => ({
                    id: option.id,
                    label: option.label,
                    description: option.secondary
                  }))}
                  removeLabel={(name) => t.removeEntity.replace("{name}", name)}
                  dir={dir}
                />
              </Specimen>
              <Specimen title={t.hierarchical}>
                <HierarchicalPicker
                  levels={bindingLevels}
                  values={relationshipValues}
                  onChange={setRelationshipValues}
                  common={{
                    placeholder: t.noResults,
                    searchLabel: t.search,
                    emptyLabel: t.noResults,
                    errorLabel: t.searchFailed,
                    loadingLabel: t.searching,
                    staleLabel: t.stale,
                    resultCountLabel: t.resultCount,
                    statusLabels: pickerStatusLabels,
                    lifecycleLabels: pickerLifecycleLabels,
                    locale,
                    dir,
                    permission: { kind: "allowed" },
                    searchState: galleryState
                  }}
                />
              </Specimen>
            </div>
          </Panel>

          <Panel
            id="oi-interface-configuration"
            index="04"
            title={t.configuration}
            description={t.noNetwork}
          >
            <div className="oi-reactive-grid">
              <Specimen title={t.currentProposed}>
                <ScalarSlider
                  label={t.reasoning}
                  value={reactive.state.proposed.reasoning}
                  onChange={(value) =>
                    reactive.edit({ ...reactive.state.proposed, reasoning: value })
                  }
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  locale={locale}
                  dir={dir}
                  density={density}
                  markers={[
                    {
                      value: reactive.state.current.reasoning,
                      label: t.persisted,
                      kind: "persisted"
                    }
                  ]}
                />
                <ConfigurationDiff
                  current={reactive.state.current}
                  proposed={reactive.state.proposed}
                  labels={{
                    reasoning: t.reasoning,
                    retrieval: t.retrieval,
                    verification: t.verification
                  }}
                  locale={locale}
                />
                <div className="oi-inline-actions">
                  <button
                    type="button"
                    className="oi-action is-quiet"
                    onClick={() => reactive.preview(t.localPreview)}
                  >
                    {t.preview}
                  </button>
                  <button
                    type="button"
                    className="oi-action is-primary"
                    onClick={() => {
                      reactive.beginApply();
                      reactive.applyResult("SUCCEEDED", t.localApplied);
                    }}
                  >
                    {t.applyDemo}
                  </button>
                  <button
                    type="button"
                    className="oi-action is-secondary"
                    onClick={() =>
                      reactive.verify(reactive.state.proposed, "demo-rev-8", t.localVerified)
                    }
                  >
                    {t.verifyDemo}
                  </button>
                  <span>{reactive.state.phase}</span>
                </div>
                <ImpactFeedback
                  kind="unknown"
                  label={t.impactNotMeasured}
                  title={t.effectUnknown}
                  detail={t.noQualityClaim}
                />
              </Specimen>
              <Specimen title={t.conflict}>
                <ConflictPanel
                  title={t.conflictTitle}
                  detail={t.conflictDetail}
                  keepLabel={t.keepDraft}
                  remoteLabel={t.useRemote}
                  stateLabel={t.conflictState}
                  onKeepDraft={() => setConflictVisible(false)}
                  onUseRemote={() => {
                    reactive.refresh(
                      { reasoning: 60, retrieval: 50, verification: 75 },
                      "demo-rev-8"
                    );
                    setConflictVisible(false);
                  }}
                />
                {conflictVisible && (
                  <button
                    className="oi-action is-quiet"
                    type="button"
                    onClick={() =>
                      reactive.markConflict(
                        { reasoning: 60, retrieval: 50, verification: 75 },
                        "demo-rev-8"
                      )
                    }
                  >
                    {t.conflict}
                  </button>
                )}
              </Specimen>
              <Specimen title={t.permissions}>
                <PermissionPanel state="allowed" label={t.selected} stateLabel={t.allowedState} />
                <PermissionPanel
                  state="read-only"
                  label={t.readOnly}
                  stateLabel={t.readOnlyState}
                />
                <PermissionPanel state="denied" label={t.denied} stateLabel={t.deniedState} />
                <PermissionPanel
                  state="unsupported"
                  label={t.unsupported}
                  stateLabel={t.unsupportedState}
                />
                <PermissionPanel
                  state="unavailable"
                  label={t.unavailable}
                  stateLabel={t.unavailableState}
                />
                <p className="oi-demo-note">{t.permissions}</p>
              </Specimen>
              <Specimen title={t.states}>
                <div className="oi-source-state-grid">
                  {(["idle", "loading", "empty", "error", "stale", "unmeasured"] as const).map(
                    (state) => (
                      <div key={state} className={`oi-source-state is-${state}`}>
                        <span>{t[state]}</span>
                        <small>
                          {state === "stale"
                            ? t.staleMessage
                            : state === "unmeasured"
                              ? t.effectUnknown
                              : t.localOnly}
                        </small>
                      </div>
                    )
                  )}
                </div>
              </Specimen>
            </div>
          </Panel>

          <Panel id="oi-interface-workspace" index="05" title={t.workspace}>
            <div className="oi-workspace-gallery">
              <div className="oi-workspace-main">
                <div className="oi-inline-actions">
                  <PrimaryAction onPress={() => setInspectorOpen(true)}>
                    {t.inspector}
                  </PrimaryAction>
                  <span>{t.inspectorBody}</span>
                </div>
                <WorkspaceTabs
                  label={t.tabs}
                  selected={activeTab}
                  onSelectionChange={setActiveTab}
                  dir={dir}
                  items={[
                    { id: "overview", label: t.overview, content: <p>{t.inspectorBody}</p> },
                    {
                      id: "history",
                      label: t.history,
                      content: (
                        <Timeline
                          label={t.timeline}
                          events={[
                            { id: "e1", title: t.localApplied, time: "10:42", tone: "good" },
                            {
                              id: "e2",
                              title: t.stale,
                              detail: t.staleMessage,
                              time: "10:38",
                              tone: "warning"
                            }
                          ]}
                        />
                      )
                    },
                    {
                      id: "details",
                      label: t.details,
                      content: (
                        <RelationshipPanel
                          label={t.relationship}
                          relationships={[
                            {
                              id: "r1",
                              type: t.application,
                              name: "Oi Core Console",
                              status: t.live
                            },
                            {
                              id: "r2",
                              type: t.tenant,
                              name: "Northstar Sandbox",
                              status: t.selected
                            }
                          ]}
                        />
                      )
                    }
                  ]}
                />
                <SidecarPanel title={t.relationship} summary={t.demoFixture}>
                  <p>Oi Core Console</p>
                  <p>Northstar Sandbox</p>
                </SidecarPanel>
              </div>
              <div className="oi-workspace-side">
                <Specimen title={t.compare}>
                  <CompareSurface
                    title={t.compare}
                    leftLabel={t.revisionA}
                    rightLabel={t.revisionB}
                    left={
                      <p>
                        {t.revision} 7 · {t.persisted}
                      </p>
                    }
                    right={
                      <p>
                        {t.revision} 8 · {t.draft}
                      </p>
                    }
                  />
                </Specimen>
                <Specimen title={t.wizard}>
                  <WizardFrame
                    title={t.wizard}
                    active={wizardStep}
                    onActiveChange={setWizardStep}
                    onCancel={() => {
                      setWizardStep(0);
                      setWizardFinished(false);
                    }}
                    onFinish={() => setWizardFinished(true)}
                    finishLabel={wizardFinished ? t.success : t.finish}
                    backLabel={t.back}
                    nextLabel={t.next}
                    cancelLabel={t.cancel}
                    requiredLabel={t.requiredFields}
                    dir={dir}
                    steps={[
                      {
                        id: "definition",
                        label: t.stepOne,
                        content: <p>{t.chooseProvider}</p>,
                        validate: () => Boolean(providerSelection)
                      },
                      {
                        id: "connection",
                        label: t.stepTwo,
                        content: <p>{t.credentialsNeverShown}</p>
                      },
                      { id: "review", label: t.stepThree, content: <p>{t.noProviderWrite}</p> }
                    ]}
                  />
                </Specimen>
                <Specimen title={t.validationTitle}>
                  <SharedValidationPanel
                    title={t.validationTitle}
                    issues={[
                      { code: "SCOPE", field: t.tenant, message: t.noResults, severity: "warning" }
                    ]}
                    labels={{
                      allPassed: t.allChecksPassed,
                      errors: t.errorsLabel,
                      warnings: t.warningsLabel
                    }}
                  />
                </Specimen>
              </div>
            </div>
            <Inspector
              open={inspectorOpen}
              onClose={() => setInspectorOpen(false)}
              title={t.inspector}
              description={t.demoFixture}
              closeLabel={t.close}
              dir={dir}
            >
              <PermissionPanel state="read-only" label={t.readOnly} stateLabel={t.readOnlyState} />
              <RelationshipPanel
                label={t.relationship}
                relationships={[
                  { id: "app", type: t.application, name: "Oi Core Console", status: t.live },
                  { id: "tenant", type: t.tenant, name: "Northstar Sandbox", status: t.selected }
                ]}
              />
              <p className="oi-demo-note">{t.permissions}</p>
            </Inspector>
          </Panel>

          <Panel
            id="oi-interface-feedback"
            index="06"
            title={t.feedback}
            className="oi-panel-appendix"
          >
            <Specimen title={t.timeline}>
              <Timeline
                label={t.timeline}
                events={[
                  { id: "t1", title: t.localApplied, time: "10:42", tone: "good" },
                  { id: "t2", title: t.conflictTitle, time: "10:40", tone: "warning" },
                  { id: "t3", title: t.localVerified, time: "10:39", tone: "neutral" }
                ]}
              />
            </Specimen>
            <Specimen title={t.thresholdPreview}>
              <ArcMeter
                value={threshold}
                min={0}
                max={100}
                label={t.thresholdPreview}
                state="LIVE"
                stateLabel={t.previewLabel}
                unit="%"
              />
            </Specimen>
          </Panel>

          <Panel id="oi-interface-states" index="07" title={t.states}>
            <div className="oi-state-specimens">
              <Specimen title={t.stateMatrix}>
                <div
                  className={`oi-state-control-sample is-${controlState}`}
                  data-state={controlState}
                >
                  <div className="oi-state-sample-head">
                    <b>{controlStateLabels[controlState]}</b>
                    <small>
                      {t.localOnly} · {t.profilePreset}
                    </small>
                  </div>
                  <ScalarSlider
                    label={t.slider}
                    value={scalar}
                    onChange={setScalar}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    locale={locale}
                    dir={dir}
                    density={density}
                    permission={selectedPermission}
                    disabled={disabledControl}
                    readOnly={controlState === "read-only"}
                    stateLabel={controlStateLabels[controlState]}
                    markers={[{ value: 40, label: t.persisted, kind: "persisted" }]}
                  />
                  <NumericStepper
                    label={t.numeric}
                    value={numeric}
                    onChange={setNumeric}
                    min={0}
                    max={5000}
                    step={25}
                    unit={t.numberUnit}
                    locale={locale}
                    dir={dir}
                    density={density}
                    permission={selectedPermission}
                    disabled={disabledControl}
                    stateLabel={controlStateLabels[controlState]}
                    error={stateInputError}
                  />
                  <div className="oi-inline-actions">
                    <ActionButton
                      variant="primary"
                      loading={controlState === "loading" || controlState === "applying"}
                      disabled={disabledControl}
                      permission={selectedPermission}
                    >
                      {controlStateLabels[controlState]}
                    </ActionButton>
                    <EntityPicker
                      label={t.demoEntity}
                      value={selectionMap.entity}
                      onChange={(value) => setSelectionMap((map) => ({ ...map, entity: value }))}
                      options={pickerData.entity}
                      placeholder={t.demoEntity}
                      searchLabel={t.search}
                      emptyLabel={t.noResults}
                      errorLabel={t.searchFailed}
                      loadingLabel={t.searching}
                      staleLabel={t.stale}
                      resultCountLabel={t.resultCount}
                      statusLabels={pickerStatusLabels}
                      lifecycleLabels={pickerLifecycleLabels}
                      locale={locale}
                      dir={dir}
                      searchState={galleryState}
                      stateLabel={controlStateLabels[controlState]}
                      disabled={disabledControl}
                      permission={selectedPermission}
                    />
                  </div>
                </div>
              </Specimen>
              <div className="oi-state-banner-row">
                {["allowed", "read-only", "denied", "unsupported", "unavailable"].map((state) => {
                  const permission = state as
                    "allowed" | "read-only" | "denied" | "unsupported" | "unavailable";
                  const stateLabels = {
                    allowed: t.allowedState,
                    "read-only": t.readOnlyState,
                    denied: t.deniedState,
                    unsupported: t.unsupportedState,
                    unavailable: t.unavailableState
                  };
                  return (
                    <PermissionPanel
                      key={state}
                      state={permission}
                      label={
                        t[
                          state === "allowed"
                            ? "selected"
                            : state === "read-only"
                              ? "readOnly"
                              : state
                        ]
                      }
                      stateLabel={stateLabels[permission]}
                    />
                  );
                })}
              </div>
              <div className="oi-state-banner-row">
                <ImpactFeedback
                  kind="known"
                  label={t.knownEffect}
                  title={t.currentValue}
                  detail={t.demoFixture}
                />
                <ImpactFeedback
                  kind="local-preview"
                  label={t.previewLabel}
                  title={t.preview}
                  detail={t.localPreview}
                />
                <ImpactFeedback
                  kind="predicted"
                  label={t.predictedEffect}
                  title={t.scenario}
                  detail={t.localOnly}
                />
                <ImpactFeedback
                  kind="unknown"
                  label={t.impactNotMeasured}
                  title={t.effectUnknown}
                  detail={t.noQualityClaim}
                />
              </div>
              <SharedValidationPanel
                title={t.validationTitle}
                issues={
                  galleryState === "ready"
                    ? []
                    : [
                        {
                          code: galleryState.toUpperCase(),
                          field: t.scenario,
                          message: galleryState === "stale" ? t.staleMessage : t[galleryState],
                          severity: galleryState === "error" ? "error" : "warning"
                        }
                      ]
                }
                labels={{
                  allPassed: t.allChecksPassed,
                  errors: t.errorsLabel,
                  warnings: t.warningsLabel
                }}
              />
              <div className="oi-source-state-grid">
                {Object.entries(controlStateLabels).map(([state, label]) => (
                  <div
                    key={state}
                    className={`oi-source-state is-${state}`}
                    aria-current={controlState === state ? "true" : undefined}
                  >
                    <span>{label}</span>
                    <small>{state === "stale" ? t.staleMessage : t.localOnly}</small>
                  </div>
                ))}
              </div>
              <p className="oi-demo-note">
                {t.paletteHint} {t.noNetwork}
              </p>
            </div>
          </Panel>

          <Panel
            id="oi-interface-composites"
            index="08"
            title={t.composites}
            description={t.readMore}
          >
            <div className="oi-composite-gallery">
              <ProfileTuningComposite
                locale={locale}
                dir={dir}
                strings={t}
                initialValues={interfaceDemoProfileValues}
                presets={profilePresets}
                initialRevision={interfaceDemoProfileRevisions.current}
                verifiedRevision={interfaceDemoProfileRevisions.verified}
              />
              <ProviderSetupComposite
                locale={locale}
                dir={dir}
                strings={t}
                options={pickerData.provider}
              />
              <ModelBindingSelector
                label={t.modelBinding}
                levels={bindingLevels}
                values={bindingValues}
                onChange={setBindingValues}
                common={{
                  placeholder: t.noResults,
                  searchLabel: t.search,
                  emptyLabel: t.noResults,
                  errorLabel: t.searchFailed,
                  loadingLabel: t.searching,
                  staleLabel: t.stale,
                  resultCountLabel: t.resultCount,
                  statusLabels: pickerStatusLabels,
                  lifecycleLabels: pickerLifecycleLabels,
                  locale,
                  dir,
                  permission: { kind: "allowed" },
                  searchState: galleryState
                }}
                demoLabel={t.localDemoConfiguration}
              />
              <PermissionScopeMatrix
                label={t.scopeMatrix}
                options={scopeOptions}
                values={selectedScopes}
                onChange={setSelectedScopes}
                dir={dir}
                demoLabel={t.localOnly}
                notice={t.scopeMatrixNotice}
              />
              <WeightMixer
                label={t.weights}
                dimensions={localizedWeights}
                onChange={setWeights}
                locale={locale}
                dir={dir}
                demoLabel={t.localDemoConfiguration}
                persistedValues={persistedWeights}
                presets={weightPresets}
                presetLabel={t.presets}
                presetLabels={{
                  match: t.presetState,
                  custom: t.presetCustom,
                  modified: t.presetModified
                }}
                labels={{
                  total: t.total,
                  valid: t.valid,
                  invalid: t.invalid,
                  locked: t.locked,
                  persisted: t.persisted,
                  dirty: t.dirtyState,
                  clean: t.current,
                  redistribute: t.redistribute,
                  reset: t.reset,
                  exact: t.exact
                }}
              />
              <div className="oi-threshold-lab">
                <ThresholdBandEditor
                  label={t.thresholds}
                  bands={bands}
                  onChange={(next) => {
                    setBands(next);
                    setThresholdFlow("idle");
                  }}
                  min={0}
                  max={100}
                  value={threshold}
                  locale={locale}
                  dir={dir}
                  labels={{
                    healthy: t.healthy,
                    elevated: t.elevated,
                    warning: t.warning,
                    severe: t.severe,
                    critical: t.critical,
                    normal: t.normal,
                    polarity: t.polarity,
                    highBad: t.highBad,
                    highGood: t.highGood,
                    preview: t.thresholdPreview,
                    invalid: t.invalid,
                    valid: t.valid,
                    localDemo: t.localDemoConfiguration,
                    boundsError: t.boundsError,
                    orderError: t.orderError
                  }}
                />
                <ApplyVerifyPanel
                  phase={
                    thresholdFlow === "idle"
                      ? t.awaitingPreview
                      : thresholdFlow === "previewed"
                        ? t.localPreview
                        : thresholdFlow === "applied"
                          ? t.localApplied
                          : t.localVerified
                  }
                  canApply={thresholdFlow === "previewed" && thresholdValid}
                  canVerify={thresholdFlow === "applied"}
                  onPreview={() => setThresholdFlow("previewed")}
                  onApply={() => {
                    if (thresholdFlow === "previewed" && thresholdValid)
                      setThresholdFlow("applied");
                  }}
                  onVerify={() => {
                    if (thresholdFlow === "applied") setThresholdFlow("verified");
                  }}
                  labels={{
                    preview: t.preview,
                    apply: t.applyDemo,
                    verify: t.verifyDemo,
                    localDemo: t.localOnly
                  }}
                />
              </div>
              <ResourceBudgetController
                label={t.resource}
                limits={localizedBudgets}
                onChange={setLimits}
                locale={locale}
                dir={dir}
                description={t.intensityCeiling}
                notice={t.noCostEstimate}
              />
            </div>
            <CompareSurface
              title={t.currentProposed}
              leftLabel={t.currentValue}
              rightLabel={t.draftValue}
              left={<span>{t.persisted} · demo-rev-7</span>}
              right={<span>{t.draft} · demo-rev-8</span>}
            />
          </Panel>

          <footer className="oi-interface-footer">
            <span>{t.footer}</span>
            <span>{t.readMore}</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
