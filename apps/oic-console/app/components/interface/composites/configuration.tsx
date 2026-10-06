"use client";

import { useMemo, useState } from "react";
import { RadialGauge } from "../../instruments";
import { clampValue, formatNumber } from "../foundation/format";
import type { InterfaceDirection, InterfaceLocale, ValidationIssue } from "../foundation/types";
import { BudgetSlider, IntensitySlider, ScalarSlider } from "../controls/sliders";
import { NumericStepper } from "../controls/numeric";
import { EntityPicker, type EntityOption } from "../selection/pickers";
import { ActionButton, ApplyAction, ResetAction } from "../commands/actions";
import {
  ConfigurationDiff,
  useConfigurationDraft
} from "../state/configuration";
import { ImpactFeedback } from "../feedback/feedback";
import { ValidationPanel } from "../workspace/surfaces";
import { CompareSurface } from "../workspace/surfaces";
import { SegmentedControl } from "../controls/choices";
import {
  Input as AriaInput,
  Label as AriaLabel,
  TextField as AriaTextField
} from "react-aria-components/TextField";
import {
  HierarchicalPicker,
  MultiSelect,
  type PickerLevel,
  type PickerProps
} from "../selection/pickers";

export type Preset = {
  id: string;
  label: string;
  values: Readonly<Record<string, number>>;
  description?: string;
};
export type PresetMatch = { kind: "exact" | "modified" | "custom"; label: string };

export function getPresetMatch(
  values: Readonly<Record<string, number>>,
  presets: readonly Preset[],
  customLabel: string,
  activePresetId?: string,
  modifiedLabel?: string
): PresetMatch {
  const exact = presets.find(
    (preset) =>
      Object.keys(preset.values).length === Object.keys(values).length &&
      Object.entries(preset.values).every(([key, value]) => values[key] === value)
  );
  if (exact) return { kind: "exact", label: exact.label };
  const activePreset = presets.find((preset) => preset.id === activePresetId);
  if (activePreset)
    return {
      kind: "modified",
      label: modifiedLabel ? `${activePreset.label} · ${modifiedLabel}` : activePreset.label
    };
  return { kind: "custom", label: customLabel };
}

export function PresetSelector({
  label,
  presets,
  value,
  onChange,
  matchLabel,
  activePresetId,
  customLabel,
  modifiedLabel,
  locale = "en",
  dir = "ltr"
}: {
  label: string;
  presets: readonly Preset[];
  value: Readonly<Record<string, number>>;
  onChange: (preset: Preset) => void;
  matchLabel: string;
  activePresetId?: string;
  customLabel?: string;
  modifiedLabel?: string;
  locale?: InterfaceLocale;
  dir?: InterfaceDirection;
}) {
  const match = getPresetMatch(
    value,
    presets,
    customLabel ?? (locale === "ar" ? "مخصص" : "Custom"),
    activePresetId,
    modifiedLabel
  );
  return (
    <fieldset className="oi-preset-selector" dir={dir}>
      <legend>{label}</legend>
      <span className={`oi-preset-match is-${match.kind}`}>
        {matchLabel}: <b>{match.label}</b>
      </span>
      <div className="oi-preset-options">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`oi-preset-option ${match.kind !== "custom" && preset.id === (match.kind === "exact" ? presets.find((item) => item.label === match.label)?.id : activePresetId) ? "is-selected" : ""}`}
            onClick={() => onChange(preset)}
          >
            <b>{preset.label}</b>
            {preset.description && <small>{preset.description}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SimpleControlView({
  title,
  modeLabel,
  description,
  children
}: {
  title: string;
  modeLabel: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="oi-presentation-view oi-simple-view">
      <header>
        <span>{modeLabel}</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}
export function AdvancedControlView({
  title,
  modeLabel,
  children
}: {
  title: string;
  modeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="oi-presentation-view oi-advanced-view">
      <header>
        <span>{modeLabel}</span>
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

export type WeightDimension = { id: string; label: string; value: number; locked?: boolean };
export function redistributeWeightDimensions(
  dimensions: readonly WeightDimension[],
  target: number,
  changedId?: string
): WeightDimension[] {
  const rows = dimensions.map((item) => ({ ...item }));
  let eligible = rows.filter((item) => !item.locked && item.id !== changedId);
  let remaining = target - rows.reduce((sum, item) => sum + item.value, 0);
  for (
    let pass = 0;
    eligible.length > 0 && Math.abs(remaining) >= 0.05 && pass < rows.length + 1;
    pass += 1
  ) {
    const share = remaining / eligible.length;
    let allocated = 0;
    for (const item of eligible) {
      const next = clampValue(item.value + share, 0, 100, 0.1);
      allocated += next - item.value;
      item.value = next;
    }
    remaining = Number((remaining - allocated).toFixed(8));
    if (Math.abs(allocated) < 0.0001) break;
    eligible = eligible.filter((item) => (remaining > 0 ? item.value < 100 : item.value > 0));
  }
  return rows;
}
export function WeightMixer({
  label,
  dimensions,
  onChange,
  target = 100,
  locale = "en",
  dir = "ltr",
  demoLabel,
  persistedValues,
  presets = [],
  presetLabel,
  presetLabels,
  labels
}: {
  label: string;
  dimensions: readonly WeightDimension[];
  onChange: (dimensions: WeightDimension[]) => void;
  target?: number;
  locale?: InterfaceLocale;
  dir?: InterfaceDirection;
  demoLabel: string;
  persistedValues?: Readonly<Record<string, number>>;
  presets?: readonly Preset[];
  presetLabel?: string;
  presetLabels?: { match: string; custom: string; modified: string };
  labels: {
    total: string;
    valid: string;
    invalid: string;
    locked: string;
    persisted: string;
    dirty: string;
    clean: string;
    redistribute: string;
    reset: string;
    exact: string;
  };
}) {
  const [activePresetId, setActivePresetId] = useState<string | undefined>();
  const total = dimensions.reduce((sum, item) => sum + item.value, 0);
  const currentValues = Object.fromEntries(dimensions.map((item) => [item.id, item.value]));
  const valid = Math.abs(total - target) < 0.001;
  const dirty = Boolean(
    persistedValues && dimensions.some((item) => persistedValues[item.id] !== item.value)
  );
  const update = (id: string, value: number) => {
    const rounded = clampValue(value, 0, 100, 0.1);
    const rows = dimensions.map((item) =>
      item.id === id ? { ...item, value: rounded } : { ...item }
    );
    const changed = rows.find((item) => item.id === id);
    onChange(changed ? redistributeWeightDimensions(rows, target, id) : rows);
  };
  return (
    <section className="oi-weight-mixer" dir={dir}>
      <header>
        <div>
          <small>{demoLabel}</small>
          <h3>{label}</h3>
        </div>
        <span className={`oi-state-tag ${dirty ? "is-amber" : "is-neutral"}`}>
          {dirty ? labels.dirty : labels.clean}
        </span>
        <div className={`oi-weight-total ${valid ? "is-valid" : "is-invalid"}`}>
          <span>{labels.total}</span>
          <b>{formatNumber(total, { locale, maximumFractionDigits: 1 })}%</b>
          <small>{valid ? labels.valid : labels.invalid}</small>
        </div>
      </header>
      {presets.length > 0 && presetLabel && presetLabels && (
        <PresetSelector
          label={presetLabel}
          presets={presets}
          value={currentValues}
          onChange={(preset) => {
            setActivePresetId(preset.id);
            onChange(
              dimensions.map((item) =>
                item.locked ? { ...item } : { ...item, value: preset.values[item.id] ?? item.value }
              )
            );
          }}
          activePresetId={activePresetId}
          customLabel={presetLabels.custom}
          modifiedLabel={presetLabels.modified}
          matchLabel={presetLabels.match}
          locale={locale}
          dir={dir}
        />
      )}
      <div className="oi-weight-rows">
        {dimensions.map((item) => (
          <article className={`oi-weight-row ${item.locked ? "is-locked" : ""}`} key={item.id}>
            <div className="oi-weight-label">
              <b>{item.label}</b>
              {item.locked && <small>{labels.locked}</small>}
              {persistedValues?.[item.id] !== undefined && (
                <small className="is-persisted">
                  {labels.persisted}:{" "}
                  {formatNumber(persistedValues[item.id], { locale, unit: "%" })}
                </small>
              )}
            </div>
            <div className="oi-weight-control">
              <ScalarSlider
                label={`${item.label} weight`}
                value={item.value}
                onChange={(value) => update(item.id, value)}
                min={0}
                max={100}
                step={0.1}
                unit="%"
                locale={locale}
                dir={dir}
                density="compact"
                readOnly={item.locked}
                markers={
                  persistedValues?.[item.id] !== undefined
                    ? [
                        {
                          value: persistedValues[item.id],
                          label: labels.persisted,
                          kind: "persisted"
                        }
                      ]
                    : undefined
                }
                permission={
                  item.locked ? { kind: "read-only", reason: labels.locked } : { kind: "allowed" }
                }
              />
              <NumericStepper
                label={`${item.label} ${labels.exact}`}
                value={item.value}
                onChange={(value) => update(item.id, value)}
                min={0}
                max={100}
                step={0.1}
                unit="%"
                locale={locale}
                dir={dir}
                density="compact"
                permission={
                  item.locked ? { kind: "read-only", reason: labels.locked } : { kind: "allowed" }
                }
              />
            </div>
          </article>
        ))}
      </div>
      <footer>
        <span>{labels.redistribute}</span>
        <ResetAction
          onPress={() => {
            setActivePresetId(undefined);
            const free = dimensions.filter((item) => !item.locked);
            const lockedTotal = dimensions
              .filter((item) => item.locked)
              .reduce((sum, item) => sum + item.value, 0);
            const each = free.length
              ? Math.floor(((target - lockedTotal) / free.length) * 10) / 10
              : 0;
            const rows = dimensions.map((item) =>
              item.locked ? { ...item } : { ...item, value: each }
            );
            const lastUnlocked = [...rows].reverse().find((item) => !item.locked);
            if (lastUnlocked)
              lastUnlocked.value =
                Math.round(
                  (lastUnlocked.value + target - rows.reduce((sum, item) => sum + item.value, 0)) *
                    10
                ) / 10;
            onChange(rows);
          }}
        >
          {labels.reset}
        </ResetAction>
      </footer>
      <div className={`oi-weight-budget ${valid ? "is-valid" : "is-invalid"}`} role="status">
        <span>
          {labels.total}: {formatNumber(total, { locale, unit: "%" })} / {target}%
        </span>
        <div>
          <i
            style={
              {
                "--weight-total": `${Math.min(100, (total / target) * 100)}%`
              } as React.CSSProperties
            }
          />
        </div>
      </div>
    </section>
  );
}

export type ThresholdBands = {
  healthy: number;
  elevated: number;
  warning: number;
  critical: number;
};
export function validateThresholdBands(
  value: ThresholdBands,
  min: number,
  max: number,
  messages?: { bounds: string; order: string }
): ValidationIssue[] {
  const entries = [value.healthy, value.elevated, value.warning, value.critical];
  const issues: ValidationIssue[] = [];
  if (entries.some((entry) => !Number.isFinite(entry) || entry < min || entry > max))
    issues.push({
      code: "THRESHOLD_BOUNDS",
      field: "boundaries",
      severity: "error",
      message: messages?.bounds ?? `All boundaries must stay between ${min} and ${max}.`
    });
  if (entries.some((entry, index) => index > 0 && entry <= entries[index - 1]))
    issues.push({
      code: "THRESHOLD_ORDER",
      field: "boundaries",
      severity: "error",
      message: messages?.order ?? "Threshold boundaries must increase without overlap."
    });
  return issues;
}

export function ThresholdBandEditor({
  label,
  bands,
  onChange,
  min,
  max,
  value,
  locale = "en",
  dir = "ltr",
  labels
}: {
  label: string;
  bands: ThresholdBands;
  onChange: (bands: ThresholdBands) => void;
  min: number;
  max: number;
  value: number;
  locale?: InterfaceLocale;
  dir?: InterfaceDirection;
  labels: {
    healthy: string;
    elevated: string;
    warning: string;
    severe: string;
    critical: string;
    normal: string;
    polarity: string;
    highBad: string;
    highGood: string;
    preview: string;
    invalid: string;
    valid: string;
    localDemo: string;
    boundsError: string;
    orderError: string;
  };
}) {
  const [polarity, setPolarity] = useState<"HIGH_IS_BAD" | "HIGH_IS_GOOD">("HIGH_IS_BAD");
  const issues = validateThresholdBands(bands, min, max, {
    bounds: labels.boundsError,
    order: labels.orderError
  });
  const zones = useMemo(() => {
    const states =
      polarity === "HIGH_IS_BAD"
        ? (["NORMAL", "ELEVATED", "WARNING", "SEVERE", "CRITICAL"] as const)
        : (["CRITICAL", "SEVERE", "WARNING", "ELEVATED", "NORMAL"] as const);
    const edges = [min, bands.healthy, bands.elevated, bands.warning, bands.critical, max];
    const captions = {
      NORMAL: labels.normal,
      ELEVATED: labels.elevated,
      WARNING: labels.warning,
      SEVERE: labels.severe,
      CRITICAL: labels.critical
    };
    const tones = {
      NORMAL: "good",
      ELEVATED: "lime",
      WARNING: "amber",
      SEVERE: "warn",
      CRITICAL: "fault"
    } as const;
    return states.map((state, index) => ({
      from: edges[index],
      to: edges[index + 1],
      state,
      label: captions[state],
      tone: tones[state]
    }));
  }, [bands, labels, max, min, polarity]);
  return (
    <section className="oi-threshold-editor" dir={dir}>
      <header>
        <div>
          <small>{labels.localDemo}</small>
          <h3>{label}</h3>
        </div>
        <span className={`oi-state-tag ${issues.length ? "is-warning" : "is-good"}`}>
          {issues.length ? labels.invalid : labels.valid}
        </span>
      </header>
      <div className="oi-threshold-controls">
        <div className="oi-threshold-fields">
          {(["healthy", "elevated", "warning", "critical"] as const).map((key) => (
            <NumericStepper
              key={key}
              label={labels[key]}
              value={bands[key]}
              onChange={(next) => onChange({ ...bands, [key]: next })}
              min={min}
              max={max}
              step={1}
              locale={locale}
              dir={dir}
              error={issues.find((issue) => issue.severity === "error")?.message}
              density="compact"
            />
          ))}
          <SegmentedControl
            label={labels.polarity}
            value={polarity}
            onChange={(next) => setPolarity(next as typeof polarity)}
            options={[
              { id: "HIGH_IS_BAD", label: labels.highBad },
              { id: "HIGH_IS_GOOD", label: labels.highGood }
            ]}
            dir={dir}
          />
        </div>
        <div className="oi-threshold-preview">
          <span>
            {labels.preview} · {locale === "ar" ? "معاينة" : "PREVIEW"}
          </span>
          <RadialGauge
            label={labels.preview}
            value={Math.min(max, Math.max(min, value))}
            min={min}
            max={max}
            state="LIVE"
            stateLabel={locale === "ar" ? "معاينة" : "PREVIEW"}
            semanticScale={{ polarity, zones }}
            size="MD"
          />
        </div>
      </div>
      <div className="oi-threshold-band" aria-label={`${labels.preview} threshold regions`}>
        {zones.map((zone, index) => (
          <span
            key={`${zone.state}-${index}`}
            className={`is-${zone.tone}`}
            style={{ flexGrow: Math.max(0, zone.to - zone.from) }}
          >
            <b>{zone.label}</b>
            <small>
              {formatNumber(zone.from, { locale })}–{formatNumber(zone.to, { locale })}
            </small>
          </span>
        ))}
      </div>
      {issues.length > 0 && (
        <p className="oi-validation-message is-error" role="alert">
          {issues[0]?.message}
        </p>
      )}
    </section>
  );
}

export type ResourceLimit = { id: string; label: string; value: number; max: number; unit: string };
export function ResourceBudgetController({
  label,
  limits,
  onChange,
  locale = "en",
  dir = "ltr",
  description,
  notice
}: {
  label: string;
  limits: readonly ResourceLimit[];
  onChange: (limits: ResourceLimit[]) => void;
  locale?: InterfaceLocale;
  dir?: InterfaceDirection;
  description: string;
  notice: string;
}) {
  return (
    <section className="oi-resource-budget" dir={dir}>
      <header>
        <small>{notice}</small>
        <h3>{label}</h3>
        <p>{description}</p>
      </header>
      {limits.map((limit) => (
        <BudgetSlider
          key={limit.id}
          label={limit.label}
          value={limit.value}
          onChange={(value) =>
            onChange(limits.map((row) => (row.id === limit.id ? { ...row, value } : row)))
          }
          min={0}
          max={limit.max}
          step={1}
          unit={limit.unit}
          locale={locale}
          dir={dir}
          density="compact"
        />
      ))}
    </section>
  );
}

export function ApplyVerifyPanel({
  phase,
  onPreview,
  onApply,
  onVerify,
  canApply = true,
  canVerify = true,
  labels
}: {
  phase: string;
  onPreview: () => void;
  onApply: () => void;
  onVerify: () => void;
  canApply?: boolean;
  canVerify?: boolean;
  labels: { preview: string; apply: string; verify: string; localDemo: string };
}) {
  return (
    <section className="oi-apply-verify">
      <span className="oi-state-tag is-amber">{labels.localDemo}</span>
      <div>
        <button type="button" className="oi-action is-quiet" onClick={onPreview}>
          {labels.preview}
        </button>
        <ApplyAction onPress={onApply} disabled={!canApply}>
          {labels.apply}
        </ApplyAction>
        <button
          type="button"
          className="oi-action is-secondary"
          onClick={onVerify}
          disabled={!canVerify}
        >
          {labels.verify}
        </button>
      </div>
      <small role="status">{phase}</small>
    </section>
  );
}

export type ProfileTuningValues = {
  reasoning: number;
  retrieval: number;
  memory: number;
  verification: number;
};

export function ProfileTuningComposite({
  locale = "en",
  dir = "ltr",
  strings,
  initialValues,
  presets,
  initialRevision,
  verifiedRevision
}: {
  locale?: InterfaceLocale;
  dir?: InterfaceDirection;
  strings: Record<string, string>;
  initialValues: ProfileTuningValues;
  presets: readonly Preset[];
  initialRevision: string;
  verifiedRevision: string;
}) {
  const draft = useConfigurationDraft(initialValues, initialRevision);
  const [view, setView] = useState<"simple" | "advanced">("simple");
  const [activePresetId, setActivePresetId] = useState<string | undefined>("balanced");
  const fields: { key: keyof ProfileTuningValues; label: string }[] = [
    { key: "reasoning", label: strings.reasoning },
    { key: "retrieval", label: strings.retrieval },
    { key: "memory", label: strings.memory },
    { key: "verification", label: strings.verification }
  ];
  const issues = draft.state.phase === "invalid" ? draft.state.issues : [];
  return (
    <section className="oi-composite oi-profile-tuning" dir={dir}>
      <header>
        <div>
          <small>{strings.demoOnly}</small>
          <h3>{strings.profileTuning}</h3>
          <p>{strings.intensityCeiling}</p>
        </div>
        <span className="oi-state-tag is-amber">
          {draft.isDirty ? strings.draft : strings.current}
        </span>
      </header>
      <SegmentedControl
        label={strings.profileView}
        value={view}
        onChange={(value) => setView(value as typeof view)}
        options={[
          { id: "simple", label: strings.simpleMode },
          { id: "advanced", label: strings.advancedMode }
        ]}
        dir={dir}
      />
      {view === "simple" && (
        <SimpleControlView
          title={strings.profileTuning}
          modeLabel={strings.simpleMode}
          description={strings.intensityCeiling}
        >
          <PresetSelector
            label={strings.presets}
            presets={presets}
            value={draft.state.proposed}
            onChange={(preset) => {
              setActivePresetId(preset.id);
              draft.edit(preset.values as ProfileTuningValues);
            }}
            activePresetId={activePresetId}
            customLabel={strings.presetCustom}
            modifiedLabel={strings.presetModified}
            matchLabel={strings.presetState}
            locale={locale}
            dir={dir}
          />
          <div className="oi-profile-controls">
            {fields.map(({ key, label }) => (
              <IntensitySlider
                key={key}
                label={label}
                value={draft.state.proposed[key]}
                onChange={(value) => draft.edit({ ...draft.state.proposed, [key]: value })}
                min={0}
                max={100}
                step={1}
                unit="%"
                locale={locale}
                dir={dir}
                help={strings.capabilityHelp}
                density="compact"
                markers={[
                  { value: draft.state.current[key], label: strings.persisted, kind: "persisted" }
                ]}
              />
            ))}
          </div>
        </SimpleControlView>
      )}
      {view === "advanced" && (
        <AdvancedControlView title={strings.profileTuning} modeLabel={strings.advancedMode}>
          <CompareSurface
            title={strings.currentProposed}
            leftLabel={strings.persisted}
            rightLabel={strings.draft}
            left={
              <ul>
                {fields.map((field) => (
                  <li key={field.key}>
                    {field.label}:{" "}
                    {formatNumber(draft.state.current[field.key], { locale, unit: "%" })}
                  </li>
                ))}
              </ul>
            }
            right={
              <ul>
                {fields.map((field) => (
                  <li key={field.key}>
                    {field.label}:{" "}
                    {formatNumber(draft.state.proposed[field.key], { locale, unit: "%" })}
                  </li>
                ))}
              </ul>
            }
          />
          <ConfigurationDiff
            current={draft.state.current}
            proposed={draft.state.proposed}
            labels={{
              reasoning: strings.reasoning,
              retrieval: strings.retrieval,
              memory: strings.memory,
              verification: strings.verification
            }}
            locale={locale}
          />
          <ValidationPanel
            title={strings.validation}
            issues={issues}
            labels={{
              allPassed: strings.allChecksPassed,
              errors: strings.errorsLabel,
              warnings: strings.warningsLabel
            }}
          />
          <ImpactFeedback
            kind="unknown"
            label={strings.impactNotMeasured}
            title={strings.effectUnknown}
            detail={strings.noQualityClaim}
          />
          <ApplyVerifyPanel
            phase={strings[draft.state.phase] ?? draft.state.phase}
            labels={{
              preview: strings.preview,
              apply: strings.applyDemo,
              verify: strings.verifyDemo,
              localDemo: strings.localOnly
            }}
            onPreview={() => draft.preview(strings.localPreview)}
            onApply={() => {
              draft.beginApply();
              draft.applyResult("SUCCEEDED", strings.demoApplied);
            }}
            onVerify={() =>
              draft.verify(draft.state.proposed, verifiedRevision, strings.demoVerified)
            }
          />
        </AdvancedControlView>
      )}
    </section>
  );
}

export function ProviderSetupComposite({
  locale = "en",
  dir = "ltr",
  strings,
  options
}: {
  locale?: InterfaceLocale;
  dir?: InterfaceDirection;
  strings: Record<string, string>;
  options: readonly EntityOption[];
}) {
  const [provider, setProvider] = useState("");
  const [connectionName, setConnectionName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [stage, setStage] = useState(0);
  const [demoStatus, setDemoStatus] = useState("READY");
  const steps = [strings.provider, strings.connection, strings.review];
  return (
    <section className="oi-composite oi-provider-setup" dir={dir}>
      <header>
        <div>
          <small>{strings.demoOnly}</small>
          <h3>{strings.providerSetup}</h3>
          <p>{strings.noProviderWrite}</p>
        </div>
        <span className="oi-state-tag is-neutral">{strings.localOnly}</span>
      </header>
      <ol className="oi-provider-steps">
        {steps.map((item, index) => (
          <li
            key={item}
            className={stage === index ? "is-current" : stage > index ? "is-complete" : ""}
          >
            <i>{index + 1}</i>
            <span>{item}</span>
          </li>
        ))}
      </ol>
      {stage === 0 && (
        <EntityPicker
          label={strings.chooseProvider}
          value={provider}
          onChange={setProvider}
          options={options}
          placeholder={strings.chooseProvider}
          searchLabel={strings.search}
          emptyLabel={strings.noResults}
          statusLabels={{
            healthy: strings.healthy,
            warning: strings.warning,
            critical: strings.critical,
            inactive: strings.inactiveStatus,
            unknown: strings.unknownStatus
          }}
          lifecycleLabels={{
            Active: strings.lifecycleActive,
            Draft: strings.lifecycleDraft,
            Production: strings.lifecycleProduction,
            Canary: strings.lifecycleCanary,
            Preview: strings.lifecyclePreview,
            Current: strings.lifecycleCurrent,
            Previous: strings.lifecyclePrevious,
            Inactive: strings.inactiveStatus,
            Configured: strings.ready
          }}
          locale={locale}
          dir={dir}
          kind="provider"
        />
      )}
      {stage === 1 && (
        <div className="oi-provider-fields">
          <AriaTextField
            className="oi-native-field"
            value={connectionName}
            onChange={setConnectionName}
          >
            <AriaLabel>{strings.connectionName}</AriaLabel>
            <AriaInput className="oi-native-input" placeholder={strings.demoConnection} />
          </AriaTextField>
          <AriaTextField className="oi-native-field" value={endpoint} onChange={setEndpoint}>
            <AriaLabel>{strings.endpointLabel}</AriaLabel>
            <AriaInput
              className="oi-native-input"
              placeholder="https://example.invalid"
              inputMode="url"
            />
          </AriaTextField>
          <ImpactFeedback
            kind="unknown"
            label={strings.impactNotMeasured}
            title={strings.credentialCustody}
            detail={strings.credentialsNeverShown}
          />
        </div>
      )}
      {stage === 2 && (
        <div className="oi-provider-review">
          <h4>{strings.reviewConfiguration}</h4>
          <p>
            {provider
              ? options.find((option) => option.id === provider)?.label
              : strings.noProviderSelected}
          </p>
          <span className={`oi-state-tag is-${demoStatus.toLowerCase()}`}>
            {strings[demoStatus.toLowerCase()] ?? demoStatus}
          </span>
        </div>
      )}
      <footer className="oi-provider-actions">
        <ActionButton
          variant="quiet"
          disabled={stage === 0}
          onPress={() => setStage((current) => Math.max(0, current - 1))}
        >
          {strings.back}
        </ActionButton>
        <span />
        {stage < 2 ? (
          <ActionButton
            variant="primary"
            disabled={
              (stage === 0 && !provider) ||
              (stage === 1 && (!connectionName.trim() || !endpoint.trim()))
            }
            onPress={() => setStage((current) => current + 1)}
          >
            {strings.next}
          </ActionButton>
        ) : (
          <ActionButton
            variant="warning"
            onPress={() => {
              setDemoStatus("CHECK_COMPLETE");
            }}
          >
            {strings.runDemoCheck}
          </ActionButton>
        )}
      </footer>
    </section>
  );
}

export function ModelBindingSelector({
  label,
  levels,
  values,
  onChange,
  common,
  demoLabel
}: {
  label: string;
  levels: readonly PickerLevel[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  common: Omit<
    PickerProps,
    "label" | "value" | "onChange" | "options" | "kind"
  >;
  demoLabel: string;
}) {
  const scopedLevels = levels.map((level, index) => {
    const parent = values[index - 1];
    const options = parent
      ? level.options.filter((option) => option.parentId === parent)
      : level.options;
    return { ...level, options };
  });
  return (
    <section className="oi-composite oi-model-binding-selector">
      <header>
        <div>
          <small>{demoLabel}</small>
          <h3>{label}</h3>
        </div>
      </header>
      <HierarchicalPicker
        levels={scopedLevels}
        values={values}
        onChange={onChange}
        common={common}
      />
    </section>
  );
}

export function PermissionScopeMatrix({
  label,
  options,
  values,
  onChange,
  dir = "ltr",
  demoLabel,
  notice
}: {
  label: string;
  options: readonly { id: string; label: string; description?: string }[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  dir?: InterfaceDirection;
  demoLabel: string;
  notice: string;
}) {
  return (
    <section className="oi-composite oi-permission-scope-matrix" dir={dir}>
      <header>
        <div>
          <small>{demoLabel}</small>
          <h3>{label}</h3>
        </div>
      </header>
      <p>{notice}</p>
      <MultiSelect label={label} values={values} onChange={onChange} options={options} dir={dir} />
    </section>
  );
}
