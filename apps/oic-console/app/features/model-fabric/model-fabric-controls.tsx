"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { Messages } from "../../i18n";
import { getString, safeText } from "../../format";
import type { Row } from "../../types";
import { FormButton } from "../../components/oic-controls";

export function CatalogSyncPanel({
  connections,
  t,
  perform
}: {
  connections: Row[];
  t: Messages;
  perform: (action: string, values?: Row) => Promise<Row | null>;
}) {
  const readyConnections = connections.filter((connection) => connection.status !== "ARCHIVED");
  const [connectionId, setConnectionId] = useState("");
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<Row | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState("");
  const [syncResult, setSyncResult] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = readyConnections.find((connection) => connection.id === connectionId);
    const usesProviderCatalog = (selected?.providerDefinition as Row | undefined)?.key === "oic-local-fixture";
  const enumLabel = (value: unknown) => (t.enums as Record<string, string>)[safeText(value)] ?? safeText(value);
  const fingerprint = `${connectionId}\u0000${input}`;
  const previewIsCurrent = !!preview && previewFingerprint === fingerprint;
  const parseInput = (): Row[] | null => {
    try {
      const value: unknown = JSON.parse(input);
      return Array.isArray(value) && value.length <= 500 && value.every((item) => !!item && typeof item === "object" && !Array.isArray(item))
        ? (value as Row[])
        : null;
    } catch {
      return null;
    }
  };
  const inspect = async () => {
    const models = parseInput();
      if ((!usesProviderCatalog && !models) || !connectionId) {
      setError(t.invalidCatalogJson);
      setPreview(null);
      return;
    }
    setBusy(true);
    setError("");
    setSyncResult(null);
      const result = await perform("catalog.preview", usesProviderCatalog ? { id: connectionId, source: "provider" } : { id: connectionId, models: models! });
    setBusy(false);
    if (result) {
      setPreview(result);
      setPreviewFingerprint(fingerprint);
    }
  };
  const synchronize = async () => {
    const models = parseInput();
      if (!previewIsCurrent || (!usesProviderCatalog && !models) || !selected) {
      setError(t.previewStale);
      return;
    }
    if (!window.confirm(t.confirmCatalogSync)) return;
    setBusy(true);
    setError("");
      const result = await perform("catalog.sync", usesProviderCatalog ? { id: connectionId, source: "provider" } : { id: connectionId, models: models! });
    setBusy(false);
    if (result) {
      setSyncResult(result);
      setPreview(null);
      setPreviewFingerprint("");
    }
  };
  const summary = preview?.models as Row[] | undefined;
  return (
    <section className="catalog-sync-panel" aria-label={t.syncCatalog}>
      <div className="catalog-sync-head">
        <span className="section-index">{t.catalogPreview}</span>
        <span>{readyConnections.length.toString().padStart(2, "0")} / CONNECTIONS</span>
      </div>
      <label className="catalog-sync-select">
        {t.connectionRecord}
        <select value={connectionId} onChange={(event) => { setConnectionId(event.target.value); setPreview(null); setSyncResult(null); }}>
          <option value="">—</option>
          {readyConnections.map((connection) => (
            <option key={String(connection.id)} value={String(connection.id)}>
              {`${safeText(connection.displayName)} · ${safeText((connection.providerDefinition as Row)?.displayName)} · ${safeText(connection.status)}`}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <div className="catalog-readiness">
          <b>{t.connectionReadiness}</b>
          {badgeText(selected.status)} / {badgeText(selected.healthStatus)} / {selected.credential && (selected.credential as Row).status === "ACTIVE" ? t.yes : t.no}
        </div>
      )}
        {!usesProviderCatalog && <label className="catalog-sync-input">
        {t.catalogJson}
        <textarea dir="ltr" spellCheck={false} placeholder={t.catalogJsonExample} value={input} onChange={(event) => { setInput(event.target.value); setPreview(null); setSyncResult(null); }} />
        </label>}
        <p className="catalog-sync-hint">{usesProviderCatalog ? t.localFixtureCatalogHint : t.catalogInputHint}</p>
      {error && <p role="alert" className="notice error-notice">{error}</p>}
      <div className="catalog-sync-actions">
        <button type="button" className="button subtle" disabled={busy || !connectionId} onClick={() => void inspect()}>
          {busy ? t.running : t.previewCatalog}
        </button>
        <button type="button" className="button primary" disabled={busy || !previewIsCurrent} onClick={() => void synchronize()}>
          {t.syncCatalog}
        </button>
      </div>
      {preview && (
        <div className="catalog-preview-result" aria-live="polite">
          <div className="catalog-preview-metrics">
            <span>{t.modelCount}<b>{safeText(preview.total)}</b></span>
            <span>{t.created}<b>{safeText(preview.createdCount)}</b></span>
            <span>{t.updated}<b>{safeText(preview.updatedCount)}</b></span>
            <span>{t.knownZeroPricing}<b>{safeText(preview.knownZeroPricingCount)}</b></span>
            <span>{t.unknownPricing}<b>{safeText(preview.unknownPricingCount)}</b></span>
          </div>
          <div className="catalog-preview-rows">
            {(summary ?? []).map((model) => (
              <article key={safeText(model.upstreamModelId)}>
                <b>{safeText(model.displayName)}</b>
                <span className="mono">{safeText(model.upstreamModelId)}</span>
                <span>{t.catalogOperation}: {enumLabel(model.operation)}</span>
                <span>{t.capabilityEvidence}: {((model.capabilities as Row[]) ?? []).map((item) => `${safeText(item.capability)} · ${enumLabel(item.status)}`).join(" / ") || enumLabel("UNKNOWN")}</span>
                <span>{t.pricingEvidence}: {model.pricing ? `${enumLabel((model.pricing as Row).status)} · IN ${safeText((model.pricing as Row).inputRate)} · OUT ${safeText((model.pricing as Row).outputRate)} · CACHED ${safeText((model.pricing as Row).cachedInputRate)} USD` : enumLabel("UNCHANGED")}</span>
              </article>
            ))}
          </div>
          {!summary?.length && <p>{t.noCatalogChanges}</p>}
          <p className="catalog-preview-footer">{t.previewRequired}</p>
        </div>
      )}
      {syncResult && <p role="status" className="notice success-notice">{t.syncCompleted} {t.created}: {safeText(syncResult.createdCount)} · {t.updated}: {safeText(syncResult.updatedCount)}</p>}
    </section>
  );
}
function badgeText(value: unknown) {
  return typeof value === "string" ? value : "UNKNOWN";
}

export function ModelHierarchy({
  families,
  applications,
  tenants,
  upstreamModels,
  connections,
  providers,
  appLabel,
  tenantLabel,
  literal,
  t,
  badge,
  mono,
  actionButton,
  perform,
  showArchived
}: {
  families: Row[];
  applications: Row[];
  tenants: Row[];
  upstreamModels: Row[];
  connections: Row[];
  providers: Row[];
  appLabel: (id: unknown) => string;
  tenantLabel: (id: unknown) => string;
  literal: (value: string) => string;
  t: Messages;
  badge: (value: unknown) => ReactNode;
  mono: (value: unknown, clipped?: boolean) => ReactNode;
  actionButton: (label: string, action: string, values: Row, className?: string) => ReactNode;
  perform: (action: string, values?: Row) => Promise<Row | null>;
  showArchived: boolean;
}) {
  const submit = (action: string, base: Row = {}) => (values: Row) => perform(action, { ...base, ...values });
  const nextEditionLifecycle: Record<string, string> = { DRAFT: "EXPERIMENTAL", EXPERIMENTAL: "CANDIDATE", CANDIDATE: "CANARY", CANARY: "MAINTENANCE", PRODUCTION: "MAINTENANCE", MAINTENANCE: "DEPRECATED" };
  const applicationOptions = applications.map((app) => ({ value: safeText(app.id), label: `${safeText(app.key)} · ${safeText(app.displayName)}` }));
  const tenantOptions = tenants.map((tenant) => ({ value: safeText(tenant.id), label: `${appLabel(tenant.applicationId)} · ${safeText(tenant.displayName)}` }));
  const upstreamOptions = upstreamModels.filter((model) => model.lifecycle === "ACTIVE").map((model) => ({
    value: safeText(model.id),
    label: `${safeText(model.providerName)} · ${safeText(model.displayName)} · ${safeText(model.upstreamModelId)}`
  }));
  return (
    <div className="model-hierarchy">
      {families.map((family) => (
        <article className="family-block" key={String(family.id)}>
          <div className="family-head">
            <span className="tree-marker">01</span>
            <div>
              <span className="section-index">{t.family}</span>
              <h4>{getString(family, "displayName")}</h4>
              <small>
                {mono(family.familyKey)} · {mono(family.id, true)}
              </small>
            </div>
            {badge(family.lifecycle)}
            {family.lifecycle !== "RETIRED" && actionButton(t.retireFamily, "model.family.retire", { id: family.id }, "button subtle small-button danger-button")}
            {family.lifecycle !== "RETIRED" && <FormButton
              title={t.createEdition}
              fields={[
                { name: "publicId", label: t.publicId, maxLength: 64, pattern: "oi-[a-z0-9]+([._-][a-z0-9]+)*" },
                { name: "editionKey", label: t.editionKey, maxLength: 64, pattern: "[a-z0-9][a-z0-9._-]{0,63}" },
                { name: "displayName", label: t.displayName, maxLength: 160 },
                { name: "domain", label: t.domain, maxLength: 128, required: false }
              ]}
              submitLabel={t.create}
              onSubmit={submit("model.edition.create", { familyId: family.id })}
            />}
          </div>
          {((family.editions as Row[]) ?? []).filter((edition) => showArchived || edition.lifecycle !== "RETIRED").map((edition) => (
            <div className="edition-block" key={String(edition.id)}>
              <div className="edition-head">
                <span className="tree-marker">02</span>
                <div>
                  <span className="section-index">{t.edition}</span>
                  <h4>
                    {getString(edition, "displayName")} <small>{mono(edition.publicId)}</small>
                  </h4>
                  <small>
                    {getString(edition, "domain")} · {getString(edition, "editionKey")}
                  </small>
                </div>
                {badge(edition.lifecycle)}{" "}
                {edition.lifecycle !== "RETIRED" && <FormButton
                  title={t.createRevision}
                  fields={[
                    { name: "instructions", label: t.instructions, type: "textarea", maxLength: 100_000, required: false },
                    { name: "specification", label: t.specification, type: "textarea", maxLength: 100_000, required: false }
                  ]}
                  submitLabel={t.create}
                  onSubmit={submit("model.revision.create", { editionId: edition.id })}
                />}
                {edition.lifecycle !== "RETIRED" && actionButton(t.retireEdition, "edition.lifecycle", { id: edition.id, lifecycle: "RETIRED" }, "button subtle small-button danger-button")}
                {edition.lifecycle !== "RETIRED" && nextEditionLifecycle[String(edition.lifecycle)] && actionButton(t.changeStatus, "edition.lifecycle", {
                  id: edition.id,
                  lifecycle: nextEditionLifecycle[String(edition.lifecycle)]
                })}
              </div>
              <div className="revision-list">
                {((edition.revisions as Row[]) ?? []).map((revision) => (
                  <div className="revision-block" key={String(revision.id)}>
                    <div className="revision-title">
                      <span className="tree-marker">03</span>
                      <span>
                        {t.revision} <b>r{getString(revision, "revision")}</b>
                      </span>
                      <small>{mono(revision.id, true)}</small>
                    </div>
                    {((revision.variants as Row[]) ?? []).map((variant) => (
                      <div className="variant-row" key={String(variant.id)}>
                        <span className="tree-marker">04</span>
                        <div>
                          <span className="section-index">{t.variant}</span>
                          <b>{getString(variant, "variantKey")}</b>
                          <small>
                            {getString(variant, "transportProfile")} · {getString(variant, "kind")}
                          </small>
                        </div>
                        <div className="upstream-link">
                          {safeText((variant.upstreamModel as Row)?.displayName) === "—"
                            ? literal("Oi-native implementation")
                            : safeText((variant.upstreamModel as Row)?.displayName)}
                          <small>
                            {safeText((variant.upstreamModel as Row)?.upstreamModelId) === "—"
                              ? literal("No upstream model")
                              : safeText((variant.upstreamModel as Row)?.upstreamModelId)}
                          </small>
                        </div>
                        {edition.lifecycle !== "RETIRED" && <FormButton
                          title={t.createBinding}
                          fields={[
                            {
                              name: "connectionId",
                              label: t.connectionRecord,
                              options: connections
                                .filter((connection) => connection.status !== "ARCHIVED" && getString((connection.providerDefinition as Row) ?? {}, "key") === getString((variant.providerDefinition as Row) ?? {}, "key"))
                                .map((connection) => ({ value: safeText(connection.id), label: `${safeText(connection.displayName)} · ${safeText(connection.scope)}` }))
                            },
                            { name: "scope", label: t.scope, options: ["PLATFORM", "APPLICATION", "TENANT"].map((value) => ({ value, label: value })) },
                            { name: "applicationId", label: t.application, options: applicationOptions, required: false },
                            { name: "tenantId", label: t.tenant, options: tenantOptions, required: false },
                            { name: "environment", label: t.bindingEnvironment, maxLength: 64, pattern: "[a-z0-9][a-z0-9-]{0,63}", required: false }
                          ]}
                          submitLabel={t.create}
                          onSubmit={submit("model.binding.create", { editionId: edition.id, variantId: variant.id })}
                        />}
                        <div className="binding-list">
                          {((variant.bindings as Row[]) ?? []).map((binding) => (
                            <div className="binding-row" key={String(binding.id)}>
                              <span className="tree-marker">05</span>
                              <div>
                                <span className="section-index">{t.binding}</span>
                                <b>
                                  {getString(binding, "scope")} /{" "}
                                  {getString(binding, "environment")}
                                </b>
                                <small>
                                  {binding.applicationId
                                    ? appLabel(binding.applicationId)
                                    : literal("PLATFORM")}
                                  {binding.tenantId ? ` · ${tenantLabel(binding.tenantId)}` : ""}
                                </small>
                              </div>
                              {badge(binding.status)}{" "}
                              {(edition.lifecycle !== "RETIRED" || binding.status === "ACTIVE") && actionButton(t.changeStatus, "binding.status", {
                                id: binding.id,
                                status: binding.status === "ACTIVE" ? "DISABLED" : "ACTIVE"
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {edition.lifecycle !== "RETIRED" && <FormButton
                      title={t.createVariant}
                      fields={[
                        { name: "variantKey", label: t.variantKey, maxLength: 64, pattern: "[a-z0-9][a-z0-9._-]{0,63}" },
                        { name: "upstreamModelId", label: t.upstreamRecord, options: upstreamOptions },
                        {
                          name: "transportProfile",
                          label: t.transport,
                          options: [...new Set(providers.flatMap((provider) => (provider.transportProfiles as string[]) ?? []))].map((profile) => ({ value: profile, label: profile }))
                        }
                      ]}
                      submitLabel={t.create}
                      onSubmit={submit("model.variant.create", { revisionId: revision.id })}
                    />}
                  </div>
                ))}
                {edition.lifecycle !== "RETIRED" && !(edition.revisions as Row[] ?? []).length && (
                  <FormButton
                    title={t.createRevision}
                    fields={[
                      { name: "instructions", label: t.instructions, type: "textarea", maxLength: 100_000, required: false },
                      { name: "specification", label: t.specification, type: "textarea", maxLength: 100_000, required: false }
                    ]}
                    submitLabel={t.create}
                    onSubmit={submit("model.revision.create", { editionId: edition.id })}
                  />
                )}
              </div>
              <div className="visibility-line">
                <span>{t.visibility}:</span>
                {applications.map((app) => {
                  const visible = ((edition.visibility as Row[]) ?? []).some((item) => item.applicationId === app.id);
                  return (
                    <span className="visibility-entry" key={String(app.id)}>
                      <span>{safeText(app.displayName)} {badge(visible ? t.visible : t.hidden)}</span>
                      {actionButton(visible ? t.removeVisibility : t.publish, visible ? "model.visibility.revoke" : "model.visibility.grant", {
                        applicationId: app.id,
                        editionId: edition.id,
                        visible: !visible
                      }, "button subtle small-button")}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
