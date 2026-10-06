"use client";

import { useMemo, useState } from "react";
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover
} from "react-aria-components/ComboBox";
import { Checkbox } from "react-aria-components/Checkbox";
import { CheckboxGroup } from "react-aria-components/CheckboxGroup";
import { Button as AriaButton } from "react-aria-components/Button";
import type { Key } from "react-aria-components/ComboBox";
import type { InterfaceDirection, InterfaceLocale, PermissionState } from "../foundation/types";

export type EntityOption = {
  id: string;
  label: string;
  secondary?: string;
  type?: string;
  scope?: string;
  lifecycle?: string;
  status?: "healthy" | "warning" | "critical" | "inactive" | "unknown";
  disabledReason?: string;
  parentId?: string;
};

export type PickerProps = {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: readonly EntityOption[];
  placeholder: string;
  searchLabel: string;
  emptyLabel: string;
  errorLabel?: string;
  dir?: InterfaceDirection;
  locale?: InterfaceLocale;
  permission?: PermissionState;
  disabled?: boolean;
  stateLabel?: string;
  kind?: string;
  searchState?: "ready" | "loading" | "empty" | "error" | "stale";
  loadingLabel?: string;
  staleLabel?: string;
  resultCountLabel?: string;
  statusLabels?: Partial<Record<NonNullable<EntityOption["status"]>, string>>;
  lifecycleLabels?: Readonly<Record<string, string>>;
};

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  searchLabel,
  emptyLabel,
  errorLabel = "Search could not be completed. Your current selection is preserved.",
  dir = "ltr",
  locale = "en",
  permission = { kind: "allowed" },
  disabled = false,
  stateLabel,
  kind = "entity",
  searchState = "ready",
  loadingLabel = "Searching…",
  staleLabel = "Stale source",
  resultCountLabel = "results",
  statusLabels = {},
  lifecycleLabels = {}
}: PickerProps) {
  const [inputValue, setInputValue] = useState("");
  const filtered = useMemo(() => {
    const query = inputValue.trim().toLocaleLowerCase(locale === "ar" ? "ar" : "en");
    if (!query) return options;
    return options.filter((option) =>
      [option.label, option.secondary, option.type, option.scope, option.lifecycle]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase(locale === "ar" ? "ar" : "en")
        .includes(query)
    );
  }, [inputValue, locale, options]);
  const selected = options.find((option) => option.id === value);
  const locked = disabled || permission.kind !== "allowed";
  const selectedKey: Key | null = selected ? selected.id : null;
  const shownOptions = searchState === "ready" || searchState === "stale" ? filtered : [];
  const emptyStateLabel =
    searchState === "loading" ? loadingLabel : searchState === "error" ? errorLabel : emptyLabel;
  const resultAnnouncement =
    searchState === "loading"
      ? loadingLabel
      : searchState === "error"
        ? errorLabel
        : searchState === "empty" || filtered.length === 0
          ? emptyLabel
          : `${filtered.length} ${resultCountLabel}${searchState === "stale" ? ` · ${staleLabel}` : ""}`;

  return (
    <ComboBox
      className={`oi-entity-picker is-${kind} is-search-${searchState}`}
      selectedKey={selectedKey}
      inputValue={inputValue}
      onInputChange={setInputValue}
      onSelectionChange={(key) => {
        if (key !== null) {
          onChange(String(key));
          setInputValue("");
        }
      }}
      isDisabled={locked}
      data-permission={permission.kind}
      allowsCustomValue={false}
      menuTrigger="input"
      dir={dir}
      aria-label={label}
    >
      <Label className="oi-control-label">{label}</Label>
      <div className="oi-picker-input-row">
        <Input
          className="oi-picker-input"
          aria-label={searchLabel}
          placeholder={selected?.label ?? placeholder}
        />
        <Button className="oi-picker-trigger" aria-label={`${label} options`}>
          ⌄
        </Button>
      </div>
      {selected && <div className="oi-picker-current-meta">
        {selected.status && <span className={`oi-picker-state-beacon is-${selected.status}`} aria-hidden="true" />}
        <small>{[selected.secondary, selected.type, selected.scope, selected.lifecycle ? lifecycleLabels[selected.lifecycle] ?? selected.lifecycle : undefined].filter(Boolean).join(" · ")}</small>
        {selected.status && <small className={`oi-picker-current-state is-${selected.status}`}>{statusLabels[selected.status] ?? selected.status}</small>}
      </div>}
      <Popover className="oi-picker-popover" shouldCloseOnInteractOutside={() => true}>
        <ListBox
          className="oi-picker-list"
          items={shownOptions}
          renderEmptyState={() => (
            <p className={`oi-picker-empty is-${searchState}`} role="status">
              {emptyStateLabel}
            </p>
          )}
          aria-label={`${label} results`}
        >
          {(option) => (
            <ListBoxItem
              id={option.id}
              textValue={option.label}
              isDisabled={Boolean(option.disabledReason)}
              className="oi-picker-option"
            >
              <span className="oi-picker-option-main">
                <b>{option.label}</b>
                {option.secondary && <small>{option.secondary}</small>}
              </span>
              <span className="oi-picker-option-meta">
                {option.type && <small>{option.type}</small>}
                {option.scope && <small>{option.scope}</small>}
                {option.lifecycle && (
                  <small>{lifecycleLabels[option.lifecycle] ?? option.lifecycle}</small>
                )}
                {option.status && (
                  <small className={`oi-state-tag is-${option.status}`}>
                    {statusLabels[option.status] ?? option.status}
                  </small>
                )}
                {option.disabledReason && (
                  <small className="oi-permission-note">{option.disabledReason}</small>
                )}
              </span>
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
      {searchState === "stale" && <span className="oi-state-tag is-warning">{staleLabel}</span>}
      {stateLabel && <span className="oi-control-state">{stateLabel}</span>}
      {searchState === "error" && (
        <span className="oi-validation-message is-error" role="alert">
          {errorLabel}
        </span>
      )}
      {permission.kind !== "allowed" && (
        <span className="oi-permission-note">{permission.reason}</span>
      )}
      <span className="oi-visually-hidden" aria-live="polite">
        {resultAnnouncement}
      </span>
    </ComboBox>
  );
}

export function EntityPicker(props: PickerProps) {
  return <SearchableSelect {...props} kind="entity" />;
}
function typedPicker(kind: string) {
  return function TypedEntityPicker(props: PickerProps) {
    return <SearchableSelect {...props} kind={kind} />;
  };
}
export const ModelPicker = typedPicker("model");
export const ProviderPicker = typedPicker("provider");
export const ApplicationPicker = typedPicker("application");
export const TenantPicker = typedPicker("tenant");
export const ServicePrincipalPicker = typedPicker("service-principal");
export const ProfilePicker = typedPicker("profile");
export const RevisionPicker = typedPicker("revision");
export const RelationshipPicker = typedPicker("relationship");
export const DependencyPicker = typedPicker("dependency");
export const ScopePicker = typedPicker("scope");
export const CapabilityPicker = typedPicker("capability");
export const LifecyclePicker = typedPicker("lifecycle");

export type MultiSelectProps = {
  label: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
  options: readonly { id: string; label: string; description?: string }[];
  dir?: InterfaceDirection;
  permission?: PermissionState;
  removeLabel?: (label: string) => string;
};
export function MultiSelect({
  label,
  values,
  onChange,
  options,
  dir = "ltr",
  permission = { kind: "allowed" }
}: MultiSelectProps) {
  const disabled = permission.kind !== "allowed" && permission.kind !== "read-only";
  return (
    <CheckboxGroup
      className={`oi-multi-select ${permission.kind === "read-only" ? "is-read-only" : ""}`}
      aria-label={label}
      value={[...values]}
      onChange={onChange}
      isDisabled={disabled || permission.kind === "read-only"}
      aria-disabled={disabled || permission.kind === "read-only" || undefined}
      data-permission={permission.kind}
      dir={dir}
    >
      {options.map((option) => (
        <Checkbox key={option.id} value={option.id} className="oi-choice-check">
          <span>
            <b>{option.label}</b>
            {option.description && <small>{option.description}</small>}
          </span>
        </Checkbox>
      ))}
      {permission.kind !== "allowed" && (
        <small className="oi-permission-note">{permission.reason}</small>
      )}
    </CheckboxGroup>
  );
}

export function ChipSelector({
  label,
  values,
  onChange,
  options,
  dir = "ltr",
  permission = { kind: "allowed" },
  removeLabel = (item) => `Remove ${item}`
}: MultiSelectProps) {
  const selected = options.filter((option) => values.includes(option.id));
  return (
    <div className="oi-chip-selector" dir={dir}>
      <div className="oi-selected-chips" role="list" aria-label={label}>
        {selected.map((option) => (
          <span className="oi-selected-chip" role="listitem" key={option.id}>
            <b>{option.label}</b>
            <AriaButton
              className="oi-chip-remove"
              aria-label={removeLabel(option.label)}
              isDisabled={permission.kind !== "allowed"}
              onPress={() => onChange(values.filter((id) => id !== option.id))}
            >
              ×
            </AriaButton>
          </span>
        ))}
      </div>
      <MultiSelect
        label={label}
        values={values}
        onChange={onChange}
        options={options}
        dir={dir}
        permission={permission}
      />
    </div>
  );
}

export type PickerLevel = { id: string; label: string; options: readonly EntityOption[] };
export function HierarchicalPicker({
  levels,
  values,
  onChange,
  common,
  dir = "ltr"
}: {
  levels: readonly PickerLevel[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  common: Omit<PickerProps, "label" | "value" | "onChange" | "options" | "kind">;
  dir?: InterfaceDirection;
}) {
  return (
    <div className="oi-hierarchical-picker" dir={dir}>
      {levels.map((level, index) => (
        <EntityPicker
          key={level.id}
          {...common}
          kind={level.id}
          label={level.label}
          value={values[index] ?? ""}
          options={level.options}
          onChange={(selected) => {
            const next = [...values.slice(0, index), selected];
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}
