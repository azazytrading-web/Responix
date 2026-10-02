"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { Locale, Messages, View } from "../../i18n";
import { dateValue, getString, safeText } from "../../format";
import type { Row, Snapshot } from "../../types";
import { FilterBox, FormButton } from "../../components/oic-controls";
import { SecretAction } from "../providers/secret-input";
import { CatalogSyncPanel, ModelHierarchy } from "./model-fabric-controls";

type Props = {
  view: View;
  data: Snapshot;
  locale: Locale;
  t: Messages;
  literal: (value: string) => string;
  filter: string;
  setFilter: (value: string) => void;
  filtered: (rows: Row[] | undefined) => Row[];
  table: (headers: string[], rows: ReactNode[][], empty?: string) => ReactNode;
  badge: (value: unknown) => ReactNode;
  mono: (value: unknown, clipped?: boolean) => ReactNode;
  appLabel: (id: unknown) => string;
  tenantLabel: (id: unknown) => string;
  actionButton: (label: string, action: string, values: Row, className?: string) => ReactNode;
  perform: (action: string, values?: Row) => Promise<Row | null>;
};

export function ModelFabricViews({ view, data, locale, t, literal, filter, setFilter, filtered, table, badge, mono, appLabel, tenantLabel, actionButton, perform }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const visibleRows = (rows: Row[]) => filtered(showArchived ? rows : rows.filter((row) => row.status !== "ARCHIVED" && row.lifecycle !== "ARCHIVED"));
  const archiveToggle = <label className="archive-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />{t.showArchived}</label>;
  return <>          {view === "providers" && data && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="section-index">04 / PROVIDER CONTROL PLANE</span>
                  <h3>{t.providers}</h3>
                  <p>
                    {literal(
                      "Definitions and connection operation · secret material stays under OIC custody"
                    )}
                  </p>
                </div>
                <FormButton
                  title={t.createConnection}
                  fields={[
                    {
                      name: "providerKey",
                      label: t.provider,
                      options: data.providers.map((provider) => ({
                        value: safeText(provider.key),
                        label: getString(provider, "displayName")
                      }))
                    },
                    {
                      name: "scope",
                      label: t.scope,
                      options: ["PLATFORM", "APPLICATION", "TENANT"].map((value) => ({
                        value,
                        label: value
                      }))
                    },
                    {
                      name: "applicationId",
                      label: t.application,
                      required: false,
                      options: data.applications.map((app) => ({
                        value: safeText(app.id),
                        label: `${safeText(app.key)} · ${safeText(app.displayName)}`
                      }))
                    },
                    {
                      name: "tenantId",
                      label: t.tenant,
                      required: false,
                      options: data.tenants.map((tenant) => ({
                        value: safeText(tenant.id),
                        label: `${appLabel(tenant.applicationId)} · ${getString(tenant, "displayName")}`
                      }))
                    },
                    { name: "displayName", label: t.connection },
                    { name: "endpointUrl", label: t.endpoint, required: false },
                    {
                      name: "transportProfile",
                      label: t.transport,
                      options: [
                        ...new Set(
                          data.providers.flatMap(
                            (provider) => (provider.transportProfiles as string[]) ?? []
                          )
                        )
                      ].map((value) => ({ value, label: value }))
                    }
                  ]}
                  submitLabel={t.create}
                  onSubmit={(values) => perform("connection.create", values)}
                />
              </div>
              <div className="provider-definitions">
                {data.providers.map((provider) => (
                  <div className="provider-definition" key={String(provider.id)}>
                    <span className="definition-icon">◈</span>
                    <div>
                      <b>{getString(provider, "displayName")}</b>
                      <small>
                        {getString(provider, "key")} · {getString(provider, "authStrategy")}
                      </small>
                    </div>
                    {badge(provider.status)}
                    <small>{((provider.transportProfiles as string[]) ?? []).join(" · ")}</small>
                  </div>
                ))}
              </div>
              {archiveToggle}<FilterBox value={filter} onChange={setFilter} placeholder={t.search} />
              {table(
                [
                  t.provider,
                  t.connection,
                  t.scope,
                  t.application,
                  t.endpoint,
                  t.healthStatus,
                  t.credentialPresent,
                  t.modelsCount,
                  t.state,
                  ""
                ],
                visibleRows(data.connections).map((connection) => {
                  const credential = connection.credential as Row | null;
                  return [
                    getString((connection.providerDefinition as Row) ?? {}, "displayName"),
                    <>
                      {getString(connection, "displayName")}
                      <small className="table-sub">{mono(connection.id, true)}</small>
                    </>,
                    badge(connection.scope),
                    connection.applicationId
                      ? appLabel(connection.applicationId)
                      : literal("PLATFORM"),
                    <span className="mono url-cell">{getString(connection, "endpointUrl")}</span>,
                    badge(connection.healthStatus),
                    credential ? (
                      <div>
                        {badge(credential.status)}
                        <small className="table-sub">v{safeText(credential.version)} · {dateValue(credential.createdAt, locale)}</small>
                        {credential.revokedAt != null && <small className="table-sub">{t.revokedAt}: {dateValue(credential.revokedAt, locale)}</small>}
                      </div>
                    ) : t.no,
                    getString((connection._count as Row) ?? {}, "upstreamModels"),
                    <>
                      {badge(connection.status)}{" "}
                      {connection.status !== "ARCHIVED" && actionButton(t.changeStatus, "connection.status", {
                        id: connection.id,
                        status: connection.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
                      })}
                      {connection.status !== "ARCHIVED" && actionButton(t.archive, "connection.status", { id: connection.id, status: "ARCHIVED" }, "button subtle small-button danger-button")}
                    </>,
                    <div className="stacked-values">
                      {connection.status !== "ARCHIVED" && actionButton(
                        t.testConnection,
                        "connection.test",
                        { id: connection.id },
                        "button primary small-button"
                      )}
                      {connection.status !== "ARCHIVED" && (connection.providerDefinition as Row)?.authStrategy !== "NONE" && (
                        <SecretAction
                          title={t.setCredential}
                          label={t.credentialField}
                          submitLabel={t.setCredential}
                          onSubmit={(values) =>
                            perform("connection.credential", { id: connection.id, ...values })
                          }
                        />
                      )}
                      {credential?.status === "ACTIVE" && actionButton(
                        t.revokeProviderCredential,
                        "provider.credential.revoke",
                        { id: connection.id, credentialId: credential.id },
                        "button subtle small-button danger-button"
                      )}
                    </div>
                  ];
                })
              )}
            </section>
          )}

          {view === "catalog" && data && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="section-index">05 / UPSTREAM MODEL CATALOG</span>
                  <h3>{t.catalog}</h3>
                  <p>
                    {literal(
                      "Provider identifiers remain distinct from consumer-facing Oi Model identities."
                    )}
                  </p>
                </div>
                <CatalogSyncPanel connections={data.connections} t={t} perform={perform} />
              </div>
              {archiveToggle}<FilterBox value={filter} onChange={setFilter} placeholder={t.search} />
              {table(
                [
                  t.provider,
                  t.connection,
                  t.upstreamModel,
                  t.name,
                  t.contextLimit,
                  t.outputLimit,
                  t.capabilities,
                  t.pricing,
                  t.lifecycle
                ],
                visibleRows(data.upstreamModels).map((model) => {
                  const pricing = model.pricing as Row;
                  const capabilities = (model.capabilities as Row[]) ?? [];
                  return [
                    getString(model, "providerName"),
                    getString(model, "connectionName"),
                    mono(model.upstreamModelId),
                    getString(model, "displayName"),
                    model.contextLimit == null
                      ? badge("UNKNOWN")
                      : getString(model, "contextLimit"),
                    model.outputLimit == null ? badge("UNKNOWN") : getString(model, "outputLimit"),
                    <div className="capability-list">
                      {capabilities.length
                        ? capabilities.map((item) => (
                            <span key={String(item.capability)}>
                              {String(item.capability)} {badge(item.status)}
                            </span>
                          ))
                        : badge("UNKNOWN")}
                    </div>,
                    <div>
                      {badge(pricing?.status)}
                      {pricing?.status === "KNOWN" && (
                        <small className="table-sub">
                          USD / 1M · {t.inputRate} {pricing.inputRate == null ? "—" : safeText(pricing.inputRate)} · {t.outputRate} {pricing.outputRate == null ? "—" : safeText(pricing.outputRate)} · {t.cachedInputRate} {pricing.cachedInputRate == null ? "—" : safeText(pricing.cachedInputRate)}
                        </small>
                      )}
                      <small className="table-sub">{getString(pricing, "sourceRef")}</small>
                    </div>,
                    <div className="stacked-values">
                      {badge(model.lifecycle)}
                      {model.lifecycle !== "ARCHIVED" && actionButton(t.archive, "catalog.model.lifecycle", { id: model.id, lifecycle: "ARCHIVED" }, "button subtle small-button danger-button")}
                    </div>
                  ];
                })
              )}
            </section>
          )}

          {view === "models" && data && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="section-index">06 / {literal("OI MODEL IDENTITY")}</span>
                  <h3>{t.models}</h3>
                  <p>
                    {literal("Family → edition → immutable revision → variant → runtime binding")}
                  </p>
                </div>
                <FormButton
                  title={t.createFamily}
                  fields={[
                    { name: "familyKey", label: t.familyKey, maxLength: 64, pattern: "[a-z0-9][a-z0-9._-]{0,63}" },
                    { name: "displayName", label: t.displayName, maxLength: 160 }
                  ]}
                  submitLabel={t.create}
                  onSubmit={(values) => perform("model.family.create", values)}
                />
              </div>
              {archiveToggle}
              <ModelHierarchy
                families={filtered(showArchived ? data.modelFamilies : data.modelFamilies.filter((family) => family.lifecycle !== "RETIRED"))}
                applications={data.applications}
                tenants={data.tenants}
                upstreamModels={data.upstreamModels}
                connections={data.connections}
                providers={data.providers}
                appLabel={appLabel}
                tenantLabel={tenantLabel}
                literal={literal}
                t={t}
                badge={badge}
                mono={mono}
                actionButton={actionButton}
                perform={perform}
                showArchived={showArchived}
              />
            </section>
          )}


  </>;
}
