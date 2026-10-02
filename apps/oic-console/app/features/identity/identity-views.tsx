"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { Locale, Messages, View } from "../../i18n";
import { dateValue, getString, safeText } from "../../format";
import type { Row, Snapshot } from "../../types";
import { FilterBox, FormButton } from "../../components/oic-controls";

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
  issueCredential: (applicationId: unknown, principalId: unknown) => Promise<void>;
};

export function IdentityViews({ view, data, locale, t, literal, filter, setFilter, filtered, table, badge, mono, appLabel, tenantLabel, actionButton, perform, issueCredential }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const visibleRows = (rows: Row[]) => filtered(showArchived ? rows : rows.filter((row) => row.status !== "ARCHIVED"));
  const archiveToggle = <label className="archive-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />{t.showArchived}</label>;
  return <>          {view === "applications" && data && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="section-index">01 / IDENTITY</span>
                  <h3>{t.applications}</h3>
                  <p>{t.applicationOwned}</p>
                </div>
                <FormButton
                  title={t.createApplication}
                  fields={[
                    { name: "key", label: t.appKey },
                    { name: "displayName", label: t.displayName }
                  ]}
                  submitLabel={t.create}
                  onSubmit={(values) => perform("application.create", values)}
                />
              </div>
              {archiveToggle}<FilterBox value={filter} onChange={setFilter} placeholder={t.search} />
              {table(
                [t.key, t.name, t.id, t.tenantCount, t.principalsCount, t.state],
                visibleRows(data.applications).map((app) => [
                  mono(app.key),
                  getString(app, "displayName"),
                  mono(app.id, true),
                  getString((app._count as Row) ?? {}, "tenants"),
                  getString((app._count as Row) ?? {}, "principals"),
                  <>
                    {badge(app.status)}{" "}
                    {app.status !== "ARCHIVED" && actionButton(t.changeStatus, "identity.status", {
                      kind: "application",
                      applicationId: app.id,
                      id: app.id,
                      status: app.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
                    })}
                    {app.status !== "ARCHIVED" && actionButton(t.archive, "identity.status", { kind: "application", applicationId: app.id, id: app.id, status: "ARCHIVED" }, "button subtle small-button danger-button")}
                  </>
                ])
              )}
            </section>
          )}

          {view === "tenants" && data && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="section-index">02 / IDENTITY</span>
                  <h3>{t.tenants}</h3>
                  <p>{t.referenceNote}</p>
                </div>
                <FormButton
                  title={t.createTenant}
                  fields={[
                    {
                      name: "applicationId",
                      label: t.application,
                      options: data.applications.map((app) => ({
                        value: safeText(app.id),
                        label: `${safeText(app.key)} · ${safeText(app.displayName)}`
                      }))
                    },
                    { name: "displayName", label: t.displayName },
                    { name: "key", label: t.tenantKey, required: false }
                  ]}
                  submitLabel={t.create}
                  onSubmit={(values) => perform("tenant.create", values)}
                />
              </div>
              {archiveToggle}<FilterBox value={filter} onChange={setFilter} placeholder={t.search} />
              {table(
                [t.key, t.name, t.application, t.externalReferences, t.id, t.state, ""],
                visibleRows(data.tenants).map((tenant) => {
                  const refs = (tenant.references as Row[]) ?? [];
                  return [
                    mono(tenant.key ?? tenant.id),
                    getString(tenant, "displayName"),
                    appLabel(tenant.applicationId),
                    <div className="stacked-values">
                      {refs.length
                        ? refs.map((ref) => (
                            <span key={safeText(ref.id)}>
                              {badge(ref.sourceType)} {mono(ref.externalId, true)}
                              {actionButton(
                                t.revoke,
                                "externalReference.revoke",
                                { applicationId: tenant.applicationId, id: ref.id },
                                "button subtle small-button"
                              )}
                              <FormButton
                                title={t.changeStatus}
                                fields={[
                                  {
                                    name: "tenantId",
                                    label: t.tenant,
                                    options: data.tenants
                                      .filter(
                                        (candidate) =>
                                          candidate.applicationId === tenant.applicationId
                                      )
                                      .map((candidate) => ({
                                        value: safeText(candidate.id),
                                        label: getString(candidate, "displayName")
                                      }))
                                  }
                                ]}
                                submitLabel={t.create}
                                onSubmit={(values) =>
                                  perform("externalReference.remap", {
                                    applicationId: tenant.applicationId,
                                    id: ref.id,
                                    ...values
                                  })
                                }
                              />
                            </span>
                          ))
                        : "—"}
                      <FormButton
                        title={t.createReference}
                        fields={[
                          { name: "sourceType", label: t.sourceTypeField },
                          { name: "externalId", label: t.externalIdField }
                        ]}
                        submitLabel={t.create}
                        onSubmit={(values) =>
                          perform("externalReference.create", {
                            ...values,
                            applicationId: tenant.applicationId,
                            tenantId: tenant.id
                          })
                        }
                      />
                    </div>,
                    mono(tenant.id, true),
                    badge(tenant.status),
                    <div className="stacked-values">
                      {tenant.status !== "ARCHIVED" && actionButton(t.changeStatus, "identity.status", {
                        kind: "tenant",
                        applicationId: tenant.applicationId,
                        id: tenant.id,
                        status: tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
                      })}
                      {tenant.status !== "ARCHIVED" && actionButton(t.archive, "identity.status", { kind: "tenant", applicationId: tenant.applicationId, id: tenant.id, status: "ARCHIVED" }, "button subtle small-button danger-button")}
                    </div>
                  ];
                })
              )}
            </section>
          )}

          {view === "principals" && data && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="section-index">03 / {literal("MACHINE IDENTITY")}</span>
                  <h3>{t.principals}</h3>
                  <p>{literal("Scoped identities · opaque credentials · lifecycle evidence")}</p>
                </div>
                <FormButton
                  title={t.createPrincipal}
                  fields={[
                    {
                      name: "applicationId",
                      label: t.application,
                      options: data.applications.map((app) => ({
                        value: safeText(app.id),
                        label: `${safeText(app.key)} · ${safeText(app.displayName)}`
                      }))
                    },
                    { name: "key", label: t.principalKey },
                    { name: "displayName", label: t.displayName }
                  ]}
                  submitLabel={t.create}
                  onSubmit={(values) => perform("principal.create", values)}
                />
              </div>
              {archiveToggle}<FilterBox value={filter} onChange={setFilter} placeholder={t.search} />
              {table(
                [
                  t.key,
                  t.name,
                  t.application,
                  t.scopes,
                  t.tenantGrants,
                  t.credentialState,
                  t.lastUsed,
                  t.state,
                  t.details
                ],
                visibleRows(data.principals).map((principal) => {
                  const creds = (principal.credentials as Row[]) ?? [];
                  const scopes = (principal.scopes as Row[]) ?? [];
                  const grants = (principal.tenantGrants as Row[]) ?? [];
                  return [
                    mono(principal.key),
                    getString(principal, "displayName"),
                    appLabel(principal.applicationId),
                    <div className="stacked-values">
                      {scopes.length
                        ? scopes.map((scope) => (
                            <span className="scope-chip" key={safeText(scope.scope)}>
                              {safeText(scope.scope)}
                              {actionButton(
                                t.revoke,
                                "principal.scope.revoke",
                                {
                                  applicationId: principal.applicationId,
                                  id: principal.id,
                                  scope: scope.scope
                                },
                                "button subtle small-button"
                              )}
                            </span>
                          ))
                        : "—"}
                      <FormButton
                        title={t.grantScope}
                        fields={[
                          {
                            name: "scope",
                            label: t.scopes,
                            options: [
                              "oic:applications:read",
                              "oic:applications:manage",
                              "oic:tenants:read",
                              "oic:tenants:manage",
                              "oic:principals:read",
                              "oic:principals:manage",
                              "oic:credentials:rotate",
                              "oic:credentials:revoke",
                              "oic:audit:read",
                              "oic:providers:read",
                              "oic:providers:manage",
                              "oic:connections:manage",
                              "oic:catalog:read",
                              "oic:catalog:manage",
                              "oic:models:read",
                              "oic:models:manage",
                              "oic:runtime:invoke",
                              "oic:runtime:models:read"
                            ]
                              .filter((value) => !scopes.some((grant) => grant.scope === value))
                              .map((value) => ({ value, label: value }))
                          }
                        ]}
                        submitLabel={t.create}
                        onSubmit={(values) =>
                          perform("principal.scope.grant", {
                            ...values,
                            applicationId: principal.applicationId,
                            id: principal.id
                          })
                        }
                      />
                    </div>,
                    <div className="stacked-values">
                      {grants.length
                        ? grants.map((grant) => (
                            <span key={safeText(grant.tenantId)}>
                              {tenantLabel(grant.tenantId)}
                              {actionButton(
                                t.revoke,
                                "principal.tenant.revoke",
                                {
                                  applicationId: principal.applicationId,
                                  id: principal.id,
                                  tenantId: grant.tenantId
                                },
                                "button subtle small-button"
                              )}
                            </span>
                          ))
                        : "—"}
                      <FormButton
                        title={t.grantTenant}
                        fields={[
                          {
                            name: "tenantId",
                            label: t.tenant,
                            options: data.tenants
                              .filter(
                                (tenant) =>
                                  tenant.applicationId === principal.applicationId &&
                                  !grants.some((grant) => grant.tenantId === tenant.id)
                              )
                              .map((tenant) => ({
                                value: safeText(tenant.id),
                                label: getString(tenant, "displayName")
                              }))
                          }
                        ]}
                        submitLabel={t.create}
                        onSubmit={(values) =>
                          perform("principal.tenant.grant", {
                            ...values,
                            applicationId: principal.applicationId,
                            id: principal.id
                          })
                        }
                      />
                    </div>,
                    <div className="stacked-values">
                      {creds.length
                        ? creds.slice(0, 3).map((credential) => (
                            <span key={safeText(credential.id)}>
                              {badge(credential.status)}{" "}
                              <small>{dateValue(credential.expiresAt, locale)}</small>
                              {credential.status === "ACTIVE" &&
                                actionButton(
                                  t.revoke,
                                  "credential.revoke",
                                  { applicationId: principal.applicationId, id: credential.id },
                                  "button subtle small-button"
                                )}
                            </span>
                          ))
                        : "—"}
                      <button
                        className="button subtle small-button"
                        type="button"
                        onClick={() => void issueCredential(principal.applicationId, principal.id)}
                      >
                        {t.issueCredential}
                      </button>
                    </div>,
                    dateValue(creds[0]?.lastUsedAt, locale),
                    <>
                      {badge(principal.status)}{" "}
                      {principal.status !== "ARCHIVED" && actionButton(t.changeStatus, "identity.status", {
                        kind: "principal",
                        applicationId: principal.applicationId,
                        id: principal.id,
                        status: principal.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
                      })}
                      {principal.status !== "ARCHIVED" && actionButton(t.archive, "identity.status", { kind: "principal", applicationId: principal.applicationId, id: principal.id, status: "ARCHIVED" }, "button subtle small-button danger-button")}
                    </>,
                    mono(principal.id, true)
                  ];
                })
              )}
              <div className="panel-foot">
                {literal(
                  "IDENTIFIERS AND LIFECYCLE ONLY. SECRET MATERIAL IS SHOWN ONLY DURING ONE-TIME ISSUANCE."
                )}
              </div>
            </section>
          )}


  </>;
}
