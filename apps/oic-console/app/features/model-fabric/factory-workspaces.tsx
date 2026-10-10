"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Locale, Messages, View } from "../../i18n";
import type { Row, Snapshot } from "../../types";
import { safeText, dateValue } from "../../format";
import { ActionButton, ActionMenu, ToggleControl, EntityPicker, Inspector, RelationshipPanel, SidecarPanel, WizardFrame, TextInput } from "../../components/interface";
import { EmptyState } from "../../components/oic-primitives";
import { SecretAction } from "../providers/secret-input";

type Props = {
  view: View;
  data: Snapshot;
  locale: Locale;
  t: Messages;
  filter: string;
  setFilter: (value: string) => void;
  perform: (action: string, values?: Row) => Promise<Row | null>;
  navigate?: (destination: View, entityId?: string) => void;
  badge: (value: unknown) => ReactNode;
  appLabel: (id: unknown) => string;
  tenantLabel: (id: unknown) => string;
  profileRevisions?: Row[];
};
const words = (locale: Locale, en: string, ar: string) => (locale === "ar" ? ar : en);
const rows = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter((item): item is Row => !!item && typeof item === "object")
    : [];
const isRetiredRecord = (item: Row) =>
  [item.lifecycle, item.status].some((value) => value === "RETIRED" || value === "ARCHIVED");
const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const uniqueId = (value: unknown) => (typeof value === "string" ? value : "");
const pickerCopy = (locale: Locale) => ({
  placeholder: words(locale, "Search records", "ابحث في السجلات"),
  searchLabel: words(locale, "Search", "بحث"),
  emptyLabel: words(locale, "No matching records", "لا توجد سجلات مطابقة"),
  resultCountLabel: words(locale, "results", "نتائج")
});
const statusTone = (
  value: unknown
): "healthy" | "warning" | "critical" | "inactive" | "unknown" => {
  const state = (typeof value === "string" ? value : "").toUpperCase();
  if (["HEALTHY", "ACTIVE", "SUCCEEDED", "READY"].includes(state)) return "healthy";
  if (["DEGRADED", "SUSPENDED", "WARNING", "RUNNING", "PARTIAL"].includes(state)) return "warning";
  if (["UNHEALTHY", "FAILED", "FAULT", "CRITICAL"].includes(state)) return "critical";
  if (["ARCHIVED", "RETIRED", "DISABLED"].includes(state)) return "inactive";
  return "unknown";
};
const EDITION_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  DRAFT: ["EXPERIMENTAL", "CANDIDATE", "RETIRED"],
  EXPERIMENTAL: ["CANDIDATE", "RETIRED"],
  CANDIDATE: ["CANARY", "PRODUCTION", "RETIRED"],
  CANARY: ["PRODUCTION", "CANDIDATE", "MAINTENANCE", "RETIRED"],
  PRODUCTION: ["CANARY", "MAINTENANCE", "DEPRECATED"],
  MAINTENANCE: ["PRODUCTION", "DEPRECATED", "RETIRED"],
  DEPRECATED: ["RETIRED"],
  RETIRED: []
};

function Metric({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="factory-metric">
      <small>{label}</small>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </div>
  );
}
function FactoryHeader({
  number,
  eyebrow,
  title: heading,
  description,
  children
}: {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="factory-header">
      <div>
        <span className="section-index">
          {number} / {eyebrow}
        </span>
        <h2>{heading}</h2>
        <p>{description}</p>
      </div>
      {children && <div className="factory-header-actions">{children}</div>}
    </header>
  );
}
function Action({
  children,
  onPress,
  tone = "secondary",
  confirm,
  disabled = false
}: {
  children: ReactNode;
  onPress: () => void;
  tone?: "primary" | "secondary" | "quiet" | "danger";
  confirm?: string;
  disabled?: boolean;
}) {
  return (
    <ActionButton
      variant={tone}
      size="compact"
      disabled={disabled}
      onPress={() => {
        if (confirm && !window.confirm(confirm)) return;
        onPress();
      }}
    >
      {children}
    </ActionButton>
  );
}

type WizardField = {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options?: readonly {
    id: string;
    label: string;
    secondary?: string;
    type?: string;
    status?: "healthy" | "warning" | "critical" | "inactive" | "unknown";
  }[];
  placeholder?: string;
  required?: boolean;
  description?: string;
  type?: "text" | "url";
};
function FactoryWizard({
  title: heading,
  locale,
  fields,
  steps,
  finish,
  finishLabel,
  cancel,
  supplement
}: {
  title: string;
  locale: Locale;
  fields: readonly WizardField[][];
  steps: readonly string[];
  finish: () => void;
  finishLabel: string;
  cancel: () => void;
  supplement?: ReactNode;
}) {
  const [active, setActive] = useState(0);
  const copy = pickerCopy(locale);
  const valid =
    fields[active]?.every((field) => !field.required || field.value.trim().length > 0) ?? false;
  const content = (
    <div className="factory-wizard-fields">
      <div className="factory-form-grid">
        {(fields[active] ?? []).map((field) =>
          field.options ? (
            <EntityPicker
              key={field.key}
              label={field.label}
              value={field.value}
              onChange={field.onChange}
              options={field.options}
              dir={locale === "ar" ? "rtl" : "ltr"}
              locale={locale}
              {...copy}
            />
          ) : (
            <TextInput
              key={field.key}
              label={field.label}
              value={field.value}
              onChange={field.onChange}
              placeholder={field.placeholder}
              required={field.required}
              description={field.description}
              type={field.type === "url" ? "text" : "text"}
              maxLength={field.type === "url" ? 2048 : 256}
              dir={locale === "ar" ? "rtl" : "ltr"}
            />
          )
        )}
      </div>
      {supplement}
    </div>
  );
  return (
    <div className="factory-wizard-wrap">
      <WizardFrame
        title={heading}
        steps={steps.map((label, index) => ({
          id: `step-${index}`,
          label,
          content: index === active ? content : <p>{label}</p>,
          validate: () => index !== active || valid
        }))}
        active={active}
        onActiveChange={setActive}
        onFinish={finish}
        finishLabel={finishLabel}
        backLabel={words(locale, "Back", "رجوع")}
        nextLabel={words(locale, "Continue", "متابعة")}
        cancelLabel={words(locale, "Cancel", "إلغاء")}
        requiredLabel={words(
          locale,
          "Complete the required fields before continuing.",
          "أكمل الحقول المطلوبة للمتابعة."
        )}
        onCancel={cancel}
        dir={locale === "ar" ? "rtl" : "ltr"}
      />
    </div>
  );
}

function ProviderWorkspace({
  data,
  locale,
  t,
  filter,
  setFilter,
  perform,
  navigate,
  appLabel,
  tenantLabel
}: Props) {
  const providers = data.providers;
  const connections = data.connections;
  const recentSyncRuns: Row[] = data.connections.flatMap((item) =>
    rows(item.syncRuns).map((run) => ({
      ...run,
      connectionName: item.displayName,
      providerName: (item.providerDefinition as Row | undefined)?.displayName
    }))
  );
  const [providerId, setProviderId] = useState(uniqueId(providers[0]?.id));
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [inspect, setInspect] = useState<Row | null>(null);
  const [create, setCreate] = useState(false);
  const [providerKey, setProviderKey] = useState(uniqueId(providers[0]?.key));
  const [scope, setScope] = useState("PLATFORM");
  const [applicationId, setApplicationId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [transportProfile, setTransportProfile] = useState("");
  const provider =
    providers.find((item) => item.id === providerId) ??
    providers.find((item) => item.key === providerKey) ??
    providers[0];
  const providerConnections = connections.filter(
    (item) =>
      item.providerDefinitionId === provider?.id ||
      (item.providerDefinition as Row | undefined)?.key === provider?.key
  );
  const selectedConnection =
    providerConnections.find((item) => item.id === selectedConnectionId) ?? providerConnections[0];
  const totalHealthy = connections.filter((item) => item.healthStatus === "HEALTHY").length;
  const open = (row: Row) => setInspect(row);
  const filteredProviders = providers.filter((item) =>
    `${safeText(item.key)} ${safeText(item.displayName)}`
      .toLocaleLowerCase(locale)
      .includes(filter.toLocaleLowerCase(locale))
  );
  const providerOptions = filteredProviders.map((item) => {
    const count = connections.filter(
      (connection) =>
        connection.providerDefinitionId === item.id ||
        (connection.providerDefinition as Row | undefined)?.key === item.key
    ).length;
    return {
      id: uniqueId(item.key),
      label: safeText(item.displayName),
      secondary: `${safeText(item.key)} · ${safeText(item.authStrategy)} · ${list(item.transportProfiles).join(" · ") || words(locale, "no transport declared", "لا توجد وسيلة نقل معلنة")} · ${count} ${words(locale, "connections", "اتصالات")}`,
      type: words(locale, "code-owned definition", "تعريف مملوك للشيفرة")
    };
  });
  const profileOptions = list(provider?.transportProfiles).map((item) => ({
    id: item,
    label: item,
    type: words(locale, "transport profile", "ملف نقل")
  }));
  const scopeOptions = ["PLATFORM", "APPLICATION", "TENANT"].map((item) => ({
    id: item,
    label: item
  }));
  const appOptions = data.applications.map((item) => ({
    id: uniqueId(item.id),
    label: `${safeText(item.key)} · ${safeText(item.displayName)}`
  }));
  const tenantOptions = data.tenants.map((item) => ({
    id: uniqueId(item.id),
    label: `${appLabel(item.applicationId)} · ${safeText(item.displayName)}`
  }));
  const createFields: WizardField[][] = [
    [
      {
        key: "provider",
        label: words(locale, "Code-owned provider definition", "تعريف المزوّد المملوك للشفرة"),
        value: providerKey,
        required: true,
        onChange: (value) => {
          setProviderKey(value);
          setProviderId(uniqueId(providers.find((item) => item.key === value)?.id));
          setTransportProfile("");
        },
        options: providers.map((item) => ({
          id: safeText(item.key),
          label: safeText(item.displayName),
          secondary: safeText(item.key),
          status: statusTone(item.status)
        }))
      }
    ],
    [
      {
        key: "scope",
        label: words(locale, "Connection scope", "نطاق الاتصال"),
        value: scope,
        onChange: (value) => {
          setScope(value);
          if (value !== "TENANT") setTenantId("");
          if (value === "PLATFORM") setApplicationId("");
        },
        options: scopeOptions
      },
      ...(scope !== "PLATFORM"
        ? [
            {
              key: "application",
              label: words(locale, "Application owner", "التطبيق المالك"),
              value: applicationId,
              onChange: setApplicationId,
              options: appOptions,
              required: true
            }
          ]
        : []),
      ...(scope === "TENANT"
        ? [
            {
              key: "tenant",
              label: words(locale, "Tenant owner", "المستأجر المالك"),
              value: tenantId,
              onChange: setTenantId,
              options: tenantOptions,
              required: true
            }
          ]
        : []),
      {
        key: "name",
        label: words(locale, "Connection name", "اسم الاتصال"),
        value: displayName,
        onChange: setDisplayName,
        required: true
      },
      {
        key: "endpoint",
        label: words(
          locale,
          "Endpoint URL (optional override)",
          "عنوان نقطة النهاية (تجاوز اختياري)"
        ),
        value: endpointUrl,
        onChange: setEndpointUrl,
        type: "url" as const
      },
      {
        key: "transport",
        label: words(locale, "Registered transport", "وسيلة النقل المسجلة"),
        value: transportProfile,
        onChange: setTransportProfile,
        required: true,
        options: profileOptions
      }
    ]
  ];
  return (
    <div className="factory-workspace" dir={locale === "ar" ? "rtl" : "ltr"}>
      <FactoryHeader
        number="04"
        eyebrow={words(locale, "PROVIDER FACTORY", "مصنع المزوّدين")}
        title={t.providers}
        description={words(
          locale,
          "Code-owned provider definitions, scoped connections, credential custody and observed readiness.",
          "تعريفات مزوّدين مملوكة للشفرة، واتصالات محددة النطاق، وحماية بيانات الاعتماد، وجاهزية مرصودة."
        )}
      >
        {
          <Action
            onPress={() => setCreate((value) => !value)}
            tone="primary"
            disabled={!provider || list(provider.transportProfiles).length === 0}
          >
            {create
              ? words(locale, "Close connection setup", "إغلاق إعداد الاتصال")
              : t.createConnection}
          </Action>
        }
      </FactoryHeader>
      <div className="factory-metrics">
        <Metric
          label={words(locale, "Known providers", "المزوّدون المعروفون")}
          value={providers.length}
          detail={words(locale, "Definitions are read-only", "التعريفات للقراءة فقط")}
        />
        <Metric label={words(locale, "Connections", "الاتصالات")} value={connections.length} />
        <Metric label={words(locale, "Healthy", "سليم")} value={totalHealthy} />
        <Metric
          label={words(locale, "Catalog records", "سجلات الفهرس")}
          value={data.upstreamModels.length}
        />
      </div>
      {create && (
        <FactoryWizard
          title={words(locale, "Register provider connection", "تسجيل اتصال مزوّد")}
          locale={locale}
          fields={createFields}
          steps={[
            words(locale, "Provider", "المزوّد"),
            words(locale, "Scope & configuration", "النطاق والإعداد")
          ]}
          finishLabel={t.create}
          cancel={() => setCreate(false)}
          finish={() => {
            if (
              !providerKey ||
              !displayName.trim() ||
              !transportProfile ||
              (scope !== "PLATFORM" && !applicationId) ||
              (scope === "TENANT" && !tenantId)
            )
              return;
            void perform("connection.create", {
              providerKey,
              scope,
              displayName,
              transportProfile,
              ...(applicationId ? { applicationId } : {}),
              ...(tenantId ? { tenantId } : {}),
              ...(endpointUrl ? { endpointUrl } : {})
            }).then((result) => {
              if (result) {
                setCreate(false);
                setDisplayName("");
                setEndpointUrl("");
                setTransportProfile("");
              }
            });
          }}
        />
      )}
      <div className="factory-two-column">
        <section className="factory-pane">
          <header>
            <div>
              <span className="section-index">
                A / {words(locale, "PROVIDER DEFINITIONS", "تعريفات المزوّدين")}
              </span>
              <h3>{words(locale, "Known providers", "المزوّدون المعروفون")}</h3>
            </div>
            <div className="factory-search">
              <TextInput
                label={t.search}
                value={filter}
                onChange={setFilter}
                type="search"
                dir={locale === "ar" ? "rtl" : "ltr"}
              />
            </div>
          </header>
          <EntityPicker
            label={words(
              locale,
              "Provider definition",
              "\u062a\u0639\u0631\u064a\u0641 \u0627\u0644\u0645\u0632\u0648\u0651\u062f"
            )}
            value={providerKey}
            onChange={(key) => {
              setProviderKey(key);
              setProviderId(uniqueId(providers.find((item) => item.key === key)?.id));
              setTransportProfile("");
            }}
            options={providerOptions}
            dir={locale === "ar" ? "rtl" : "ltr"}
            locale={locale}
            {...pickerCopy(locale)}
          />
          {provider && (
            <div className="factory-definition-detail">
              <div>
                <span className="section-index">
                  {words(locale, "READ-ONLY REGISTRATION", "تسجيل للقراءة فقط")}
                </span>
                <h3>{safeText(provider.displayName)}</h3>
                <p>
                  {words(
                    locale,
                    "Provider definitions are code-owned. The API exposes no definition edit or delete action.",
                    "تعريفات المزوّدين مملوكة للشفرة. لا توفر الواجهة إجراء تحرير أو حذف للتعريف."
                  )}
                </p>
              </div>
              <dl>
                <dt>
                  {words(
                    locale,
                    "Registration state",
                    "\u062d\u0627\u0644\u0629 \u0627\u0644\u062a\u0633\u062c\u064a\u0644"
                  )}
                </dt>
                <dd>{safeText(provider.status ?? provider.lifecycle ?? "REGISTERED")}</dd>
                <dt>{words(locale, "Authentication", "المصادقة")}</dt>
                <dd>{safeText(provider.authStrategy)}</dd>
                <dt>{words(locale, "Transports", "وسائل النقل")}</dt>
                <dd>{list(provider.transportProfiles).join(" · ") || "—"}</dd>
                <dt>
                  {words(locale, "Capabilities", "\u0627\u0644\u0642\u062f\u0631\u0627\u062a")}
                </dt>
                <dd>
                  {Array.isArray(provider.capabilities) && provider.capabilities.length
                    ? safeText(provider.capabilities.join(" · "))
                    : words(
                        locale,
                        "Not declared",
                        "\u063a\u064a\u0631 \u0645\u0639\u0644\u0646\u0629"
                      )}
                </dd>
                <dt>{words(locale, "Default endpoint", "نقطة النهاية الافتراضية")}</dt>
                <dd dir="ltr">{safeText(provider.defaultEndpoint)}</dd>
                <dt>{words(locale, "Catalog ingestion", "استيراد الفهرس")}</dt>
                <dd>
                  {provider.key === "oic-local-fixture"
                    ? words(locale, "Development fixture source", "مصدر تجريبي للتطوير")
                    : words(
                        locale,
                        "Manual curated import; provider discovery is not registered",
                        "استيراد يدوي منسق؛ اكتشاف المزوّد غير مسجل"
                      )}
                </dd>
              </dl>
            </div>
          )}
        </section>
        <section className="factory-pane">
          <header>
            <div>
              <span className="section-index">B / {words(locale, "CONNECTIONS", "الاتصالات")}</span>
              <h3>{provider ? safeText(provider.displayName) : t.connection}</h3>
            </div>
            <span>
              {providerConnections.length} / {words(locale, "records", "سجلات")}
            </span>
          </header>
          {providerConnections.length > 0 ? (
            <div className="factory-connection-workspace">
              <nav
                className="factory-connection-index"
                aria-label={words(locale, "Provider connections", "اتصالات المزوّد")}
              >
                {providerConnections.map((connection) => (
                  <ActionButton
                    key={String(connection.id)}
                    variant={selectedConnection?.id === connection.id ? "secondary" : "quiet"}
                    size="compact"
                    className={`factory-connection-index-item ${selectedConnection?.id === connection.id ? "is-selected" : ""}`}
                    onPress={() => setSelectedConnectionId(uniqueId(connection.id))}
                  >
                    <span className="factory-connection-index-copy">
                      <b>{safeText(connection.displayName)}</b>
                      <small>
                        {safeText(connection.scope)} · {safeText(connection.status)} ·{" "}
                        {safeText((connection._count as Row | undefined)?.upstreamModels ?? 0)}{" "}
                        {words(locale, "catalog models", "نماذج فهرس")}
                      </small>
                    </span>
                    <span className={`oi-state-tag is-${statusTone(connection.healthStatus)}`}>
                      {safeText(connection.healthStatus)}
                    </span>
                  </ActionButton>
                ))}
              </nav>
              {selectedConnection &&
                (() => {
                  const connection = selectedConnection;
                  const credential = connection.credential as Row | null;
                  const healthChecks = rows(connection.healthChecks);
                  const latest = healthChecks[0];
                  return (
                    <article className="factory-connection-card" key={String(connection.id)}>
                      <header>
                        <div>
                          <b>{safeText(connection.displayName)}</b>
                          <small>
                            {safeText(connection.scope)} ·{" "}
                            {connection.applicationId
                              ? appLabel(connection.applicationId)
                              : words(locale, "Platform scope", "نطاق المنصة")}
                            {connection.tenantId ? ` · ${tenantLabel(connection.tenantId)}` : ""}
                          </small>
                        </div>
                        <span className={`oi-state-tag is-${statusTone(connection.healthStatus)}`}>
                          {safeText(connection.healthStatus)}
                        </span>
                      </header>
                      <div className="factory-connection-facts">
                        <span>
                          {words(locale, "Lifecycle", "دورة الحياة")}: {safeText(connection.status)}
                        </span>
                        <span>
                          {words(locale, "Credential", "بيانات الاعتماد")}:{" "}
                          {credential
                            ? `${safeText(credential.status)} · v${safeText(credential.version)}`
                            : words(locale, "Not configured", "غير مهيأ")}
                        </span>
                        <span>
                          {words(locale, "Catalog", "الفهرس")}:{" "}
                          {safeText((connection._count as Row | undefined)?.upstreamModels ?? 0)}{" "}
                          {words(locale, "models", "نماذج")}
                        </span>
                        <span>
                          {words(locale, "Bindings", "الارتباطات")}:{" "}
                          {safeText((connection._count as Row | undefined)?.bindings ?? 0)}
                        </span>
                      </div>
                      {latest && (
                        <p className="factory-observation">
                          <b>{safeText(latest.status)}</b> · {safeText(latest.diagnosticCode)} ·{" "}
                          {latest.latencyMs == null
                            ? words(locale, "latency not recorded", "زمن الاستجابة غير مسجل")
                            : `${safeText(latest.latencyMs)} ms`}{" "}
                          · {dateValue(latest.testedAt, locale)}
                        </p>
                      )}
                      <div className="factory-actions">
                        <Action onPress={() => open(connection)}>
                          {words(locale, "Inspect connection", "فحص الاتصال")}
                        </Action>
                        {navigate && (
                          <Action onPress={() => navigate("catalog", uniqueId(connection.id))}>
                            {words(locale, "Open source catalog", "فتح فهرس المصدر")}
                          </Action>
                        )}
                        <Action
                          onPress={() => void perform("connection.test", { id: connection.id })}
                          tone="primary"
                          disabled={connection.status === "ARCHIVED"}
                        >
                          {t.testConnection}
                        </Action>
                        {connection.status !== "ARCHIVED" &&
                          (connection.providerDefinition as Row | undefined)?.authStrategy !==
                            "NONE" && (
                            <SecretAction
                              title={t.setCredential}
                              label={t.credentialField}
                              submitLabel={t.setCredential}
                              onSubmit={(values) =>
                                perform("connection.credential", { id: connection.id, ...values })
                              }
                            />
                          )}
                        {(connection.status !== "ARCHIVED" || credential?.status === "ACTIVE") && (
                          <ActionMenu
                            label={words(locale, "More connection actions", "إجراءات اتصال إضافية")}
                            items={[
                              ...(connection.status !== "ARCHIVED"
                                ? [
                                    {
                                      id: "toggle",
                                      label:
                                        connection.status === "ACTIVE"
                                          ? words(locale, "Suspend", "تعليق")
                                          : words(locale, "Activate", "تفعيل")
                                    }
                                  ]
                                : []),
                              ...(credential?.status === "ACTIVE"
                                ? [
                                    {
                                      id: "revoke",
                                      label: t.revokeProviderCredential,
                                      tone: "critical" as const
                                    }
                                  ]
                                : []),
                              ...(connection.status !== "ARCHIVED"
                                ? [{ id: "archive", label: t.archive, tone: "critical" as const }]
                                : [])
                            ]}
                            onAction={(id) => {
                              if (id === "toggle" && window.confirm(t.confirmStatus)) {
                                void perform("connection.status", {
                                  id: connection.id,
                                  status: connection.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
                                });
                              }
                              if (
                                id === "revoke" &&
                                credential &&
                                window.confirm(t.confirmProviderCredentialRevoke)
                              ) {
                                void perform("provider.credential.revoke", {
                                  id: connection.id,
                                  credentialId: credential.id
                                });
                              }
                              if (id === "archive" && window.confirm(t.confirmArchive)) {
                                void perform("connection.status", {
                                  id: connection.id,
                                  status: "ARCHIVED"
                                });
                              }
                            }}
                          />
                        )}
                      </div>
                    </article>
                  );
                })()}
            </div>
          ) : (
            <div className="factory-empty-connection">
              <EmptyState
                title={words(locale, "No connection configured", "لا يوجد اتصال مهيأ")}
                description={words(
                  locale,
                  `${safeText(provider?.displayName)} · ${safeText(provider?.authStrategy)} authentication. Create a scoped connection to start catalog work.`,
                  `\u0644\u0627 \u062a\u0648\u062c\u062f \u0627\u062a\u0635\u0627\u0644\u0627\u062a \u0644\u0640 ${safeText(provider?.displayName)}. \u0623\u0646\u0634\u0626 \u0627\u062a\u0635\u0627\u0644\u0627\u064b \u0645\u062d\u062f\u062f \u0627\u0644\u0646\u0637\u0627\u0642 \u0644\u0628\u062f\u0621 \u0639\u0645\u0644 \u0627\u0644\u0641\u0647\u0631\u0633.`
                )}
                action={
                  <Action
                    onPress={() => setCreate(true)}
                    tone="primary"
                    disabled={!provider || list(provider.transportProfiles).length === 0}
                  >
                    {t.createConnection}
                  </Action>
                }
              />
            </div>
          )}
        </section>
      </div>
      <section className="factory-pane">
        <header>
          <div>
            <span className="section-index">
              C / {words(locale, "SYNC HISTORY", "سجل المزامنة")}
            </span>
            <h3>{words(locale, "Persisted catalog sync runs", "عمليات مزامنة الفهرس المحفوظة")}</h3>
          </div>
          <span>
            {recentSyncRuns.length} / {words(locale, "recent records", "سجلات حديثة")}
          </span>
        </header>
        {recentSyncRuns.length ? (
          <div className="factory-sync-history">
            {recentSyncRuns.slice(0, 20).map((run) => (
              <article key={String(run.id)}>
                <span className={`oi-state-tag is-${statusTone(run.status)}`}>
                  {safeText(run.status)}
                </span>
                <b>
                  {safeText(run.providerName)} · {safeText(run.connectionName)}
                </b>
                <span>
                  {safeText(run.discoveredCount)} {words(locale, "discovered", "مكتشف")}
                </span>
                <span>
                  {safeText(run.createdCount)} {t.created} · {safeText(run.updatedCount)}{" "}
                  {t.updated}
                </span>
                <small>{safeText(run.diagnosticCode)}</small>
                <time>{dateValue(run.completedAt ?? run.startedAt, locale)}</time>
              </article>
            ))}
          </div>
        ) : (
          <p className="factory-empty">
            {words(
              locale,
              "No catalog synchronization history is recorded.",
              "لا يوجد سجل محفوظ لمزامنة الفهرس."
            )}
          </p>
        )}
        <p>
          {words(
            locale,
            "Sync history reports persisted run counts and outcomes. It is not a field-level before/after diff.",
            "يعرض سجل المزامنة أعداد ونتائج العمليات المحفوظة. وليس مقارنة تفصيلية قبل/بعد على مستوى الحقول."
          )}
        </p>
      </section>
      <Inspector
        open={!!inspect}
        onClose={() => setInspect(null)}
        title={safeText(inspect?.displayName)}
        description={words(
          locale,
          "Connection identity, current source records and related model bindings.",
          "هوية الاتصال والسجلات المصدرية الحالية وارتباطات النماذج ذات الصلة."
        )}
        closeLabel={t.close}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        {inspect && (
          <>
            <dl className="factory-inspector-grid">
              <dt>{t.provider}</dt>
              <dd>{safeText((inspect.providerDefinition as Row | undefined)?.displayName)}</dd>
              <dt>{t.scope}</dt>
              <dd>{safeText(inspect.scope)}</dd>
              <dt>{t.endpoint}</dt>
              <dd dir="ltr">{safeText(inspect.endpointUrl)}</dd>
              <dt>{words(locale, "Transport", "وسيلة النقل")}</dt>
              <dd>{safeText(inspect.transportProfile)}</dd>
              <dt>{words(locale, "Last validated", "آخر تحقق")}</dt>
              <dd>{dateValue(inspect.lastValidatedAt, locale)}</dd>
            </dl>
            <RelationshipPanel
              label={words(locale, "Connection relationships", "علاقات الاتصال")}
              relationships={[
                {
                  id: `catalog-${String(inspect.id)}`,
                  type: words(locale, "UPSTREAM CATALOG", "الفهرس الخارجي"),
                  name: `${safeText((inspect._count as Row | undefined)?.upstreamModels ?? 0)} ${words(locale, "source models", "نماذج مصدر")}`
                },
                {
                  id: `bindings-${String(inspect.id)}`,
                  type: words(locale, "MODEL BINDINGS", "ارتباطات النماذج"),
                  name: `${safeText((inspect._count as Row | undefined)?.bindings ?? 0)} ${words(locale, "bindings", "ارتباطات")}`
                }
              ]}
            />
            <SidecarPanel
              title={words(locale, "Recent health checks", "فحوصات الصحة الأخيرة")}
              summary={words(locale, "Persisted observations only", "ملاحظات محفوظة فقط")}
            >
              {rows(inspect.healthChecks).length ? (
                rows(inspect.healthChecks).map((check, index) => (
                  <p key={index}>
                    {safeText(check.status)} · {safeText(check.diagnosticCode)} ·{" "}
                    {check.latencyMs == null ? "—" : `${safeText(check.latencyMs)} ms`} ·{" "}
                    {dateValue(check.testedAt, locale)}
                  </p>
                ))
              ) : (
                <p>
                  {words(
                    locale,
                    "No connection test history is recorded.",
                    "لا يوجد سجل لاختبارات الاتصال."
                  )}
                </p>
              )}
            </SidecarPanel>
          </>
        )}
      </Inspector>
    </div>
  );
}

function CatalogWorkspace({ data, locale, t, filter, setFilter, perform, badge, navigate }: Props) {
  const [connectionId, setConnectionId] = useState("");
  const [inspect, setInspect] = useState<Row | null>(null);
  const [preview, setPreview] = useState<Row | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [drafts, setDrafts] = useState<Row[]>([]);
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [family, setFamily] = useState("");
  const [contextLimit, setContextLimit] = useState("");
  const [outputLimit, setOutputLimit] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [mappingFilter, setMappingFilter] = useState("");
  const [capabilityFilter, setCapabilityFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");
  useEffect(() => {
    const requestedConnection = new URLSearchParams(window.location.search).get("entity");
    if (requestedConnection && data.connections.some((item) => item.id === requestedConnection)) {
      setConnectionId(requestedConnection);
    }
  }, [data.connections]);
  const connection = data.connections.find((item) => item.id === connectionId);
  const fixture = (connection?.providerDefinition as Row | undefined)?.key === "oic-local-fixture";
  const latestSync = rows(connection?.syncRuns)[0];
  const connectionOptions = data.connections
    .filter((item) => item.status !== "ARCHIVED")
    .map((item) => ({
      id: uniqueId(item.id),
      label: `${safeText(item.displayName)} · ${safeText((item.providerDefinition as Row | undefined)?.displayName)}`,
      secondary: `${safeText(item.scope)} · ${safeText(item.status)} · ${safeText(item.healthStatus)}`,
      type: words(locale, "connection", "اتصال"),
      status: statusTone(item.healthStatus)
    }));
  const mappedSourceIds = new Set(
    data.modelFamilies.flatMap((familyRow) =>
      rows(familyRow.editions).flatMap((edition) =>
        rows(edition.revisions).flatMap((revision) =>
          rows(revision.variants)
            .map((variant) => uniqueId(variant.upstreamModelId))
            .filter(Boolean)
        )
      )
    )
  );
  const capabilityOptions = [
    ...new Set(
      data.upstreamModels.flatMap((model) =>
        rows(model.capabilities)
          .map((capability) => uniqueId(capability.capability))
          .filter(Boolean)
      )
    )
  ].map((capability) => ({ id: capability, label: capability }));
  const availabilityOptions = [
    ...new Set(data.upstreamModels.map((model) => uniqueId(model.lifecycle)).filter(Boolean))
  ].map((lifecycle) => ({ id: lifecycle, label: lifecycle }));
  const mappingOptions = [
    { id: "", label: words(locale, "All mapping states", "كل حالات الربط") },
    { id: "MAPPED", label: words(locale, "Mapped", "مرتبط") },
    { id: "UNMAPPED", label: words(locale, "Unmapped", "غير مرتبط") }
  ];
  const filteredModels = data.upstreamModels.filter(
    (item) =>
      (!connectionId || item.connectionId === connectionId) &&
      (showArchived || item.lifecycle !== "ARCHIVED") &&
      (!availabilityFilter || item.lifecycle === availabilityFilter) &&
      (!mappingFilter ||
        (mappingFilter === "MAPPED"
          ? mappedSourceIds.has(uniqueId(item.id))
          : !mappedSourceIds.has(uniqueId(item.id)))) &&
      (!capabilityFilter ||
        rows(item.capabilities).some((entry) => entry.capability === capabilityFilter)) &&
      `${safeText(item.displayName)} ${safeText(item.upstreamModelId)} ${safeText(item.providerName)} ${safeText(item.connectionName)} ${safeText(item.lifecycle)}`
        .toLocaleLowerCase(locale)
        .includes(filter.toLocaleLowerCase(locale))
  );
  const currentKey = `${connectionId}:${JSON.stringify(drafts)}:${json}`;
  const addDraft = () => {
    if (
      !modelId.trim() ||
      !displayName.trim() ||
      (contextLimit && !/^[1-9]\d*$/.test(contextLimit)) ||
      (outputLimit && !/^[1-9]\d*$/.test(outputLimit))
    )
      return;
    setDrafts((current) => [
      ...current,
      {
        upstreamModelId: modelId.trim(),
        displayName: displayName.trim(),
        ...(family.trim() ? { family: family.trim() } : {}),
        ...(contextLimit ? { contextLimit: Number(contextLimit) } : {}),
        ...(outputLimit ? { outputLimit: Number(outputLimit) } : {})
      }
    ]);
    setModelId("");
    setDisplayName("");
    setFamily("");
    setContextLimit("");
    setOutputLimit("");
    setPreview(null);
  };
  const importModels = () => {
    if (!advancedOpen || !json.trim()) return drafts;
    try {
      const value: unknown = JSON.parse(json);
      return Array.isArray(value) &&
        value.length <= 500 &&
        value.every((item) => item && typeof item === "object" && !Array.isArray(item))
        ? (value as Row[])
        : null;
    } catch {
      return null;
    }
  };
  const previewCatalog = async () => {
    if (!connectionId) return;
    const models = fixture ? null : importModels();
    if (!fixture && !models) return;
    setBusy(true);
    const result = await perform(
      "catalog.preview",
      fixture ? { id: connectionId, source: "provider" } : { id: connectionId, models }
    );
    setBusy(false);
    if (result) {
      setPreview(result);
      setPreviewKey(currentKey);
    }
  };
  const syncCatalog = async () => {
    if (
      !connectionId ||
      previewKey !== currentKey ||
      !preview ||
      !window.confirm(t.confirmCatalogSync)
    )
      return;
    const models = fixture ? null : importModels();
    if (!fixture && !models) return;
    setBusy(true);
    const result = await perform(
      "catalog.sync",
      fixture ? { id: connectionId, source: "provider" } : { id: connectionId, models }
    );
    setBusy(false);
    if (result) {
      setPreview(null);
      setPreviewKey("");
      setDrafts([]);
      setJson("");
    }
  };
  const previewModels = rows(preview?.models);
  return (
    <div className="factory-workspace" dir={locale === "ar" ? "rtl" : "ltr"}>
      <FactoryHeader
        number="05"
        eyebrow={words(locale, "UPSTREAM CATALOG", "الفهرس الخارجي")}
        title={t.catalog}
        description={words(
          locale,
          "Review provider source records, evidence and supported catalog changes before an explicit synchronization.",
          "راجع سجلات المزوّد المصدرية والأدلة وتغييرات الفهرس المدعومة قبل المزامنة الصريحة."
        )}
      />
      <div className="factory-metrics">
        <Metric
          label={words(locale, "Source models", "نماذج المصدر")}
          value={data.upstreamModels.length}
        />
        <Metric
          label={words(locale, "Active", "نشط")}
          value={data.upstreamModels.filter((item) => item.lifecycle === "ACTIVE").length}
        />
        <Metric
          label={words(locale, "Mapped to variants", "مرتبطة بمتغيرات")}
          value={
            data.modelFamilies
              .flatMap((familyRow) =>
                rows(familyRow.editions).flatMap((edition) =>
                  rows(edition.revisions).flatMap((revision) => rows(revision.variants))
                )
              )
              .filter((variant) => !!variant.upstreamModelId).length
          }
        />
        <Metric
          label={words(locale, "Sync baseline", "خط أساس المزامنة")}
          value={words(locale, "No comparison baseline", "لا يوجد خط أساس للمقارنة")}
          detail={words(
            locale,
            "Preview reports CREATE/UPDATE only; no missing/deleted inference.",
            "تعرض المعاينة الإنشاء والتحديث فقط؛ ولا تستنتج سجلات مفقودة أو محذوفة."
          )}
        />
      </div>
      <div className="factory-catalog-engine">
        <section className="factory-pane">
          <header>
            <div>
              <span className="section-index">
                A / {words(locale, "SOURCE & IMPORT", "المصدر والاستيراد")}
              </span>
              <h3>{words(locale, "Select a provider connection", "اختر اتصال مزوّد")}</h3>
            </div>
          </header>
          <EntityPicker
            label={t.connectionRecord}
            value={connectionId}
            onChange={(id) => {
              setConnectionId(id);
              setPreview(null);
              setPreviewKey("");
            }}
            options={connectionOptions}
            dir={locale === "ar" ? "rtl" : "ltr"}
            locale={locale}
            {...pickerCopy(locale)}
          />
          {connection && (
            <div className="factory-readiness">
              <b>{words(locale, "Source readiness", "جاهزية المصدر")}</b>
              <span>
                {safeText(connection.status)} / {safeText(connection.healthStatus)} /{" "}
                {connection.credential && (connection.credential as Row).status === "ACTIVE"
                  ? words(locale, "credential present", "بيانات الاعتماد موجودة")
                  : words(locale, "credential absent", "بيانات الاعتماد غير موجودة")}
              </span>
              <span>
                {words(locale, "Last sync", "آخر مزامنة")}:{" "}
                {latestSync
                  ? dateValue(latestSync.completedAt ?? latestSync.startedAt, locale)
                  : words(locale, "No history", "لا يوجد سجل")}
                {latestSync && ` · ${safeText(latestSync.status)}`}
              </span>
              <small>
                {fixture
                  ? words(
                      locale,
                      "Registered local fixture catalog; safe for local preview.",
                      "فهرس تجريبي محلي مسجل؛ آمن للمعاينة المحلية."
                    )
                  : words(
                      locale,
                      "No provider discovery adapter is registered. Use curated manual import; no external provider call will be made by preview.",
                      "لا يوجد محول اكتشاف مسجل لهذا المزوّد. استخدم الاستيراد اليدوي المنسق؛ لن تستدعي المعاينة مزوّداً خارجياً."
                    )}
              </small>
            </div>
          )}
          {!fixture && (
            <div className="factory-import-form">
              <span className="section-index">
                {words(locale, "CURATED MODEL ENTRY", "إدخال نموذج منسق")}
              </span>
              <div className="factory-form-grid">
                <TextInput
                  label={words(locale, "Provider model identifier", "معرّف نموذج المزوّد")}
                  value={modelId}
                  onChange={setModelId}
                  maxLength={256}
                  dir="ltr"
                />
                <TextInput
                  label={t.displayName}
                  value={displayName}
                  onChange={setDisplayName}
                  maxLength={160}
                  dir={locale === "ar" ? "rtl" : "ltr"}
                />
                <TextInput
                  label={words(locale, "Provider family (optional)", "عائلة المزوّد (اختياري)")}
                  value={family}
                  onChange={setFamily}
                  maxLength={128}
                  dir={locale === "ar" ? "rtl" : "ltr"}
                />
                <TextInput
                  label={words(locale, "Context limit (optional)", "حد السياق (اختياري)")}
                  value={contextLimit}
                  onChange={setContextLimit}
                  type="text"
                  dir="ltr"
                />
                <TextInput
                  label={words(locale, "Output limit (optional)", "حد الإخراج (اختياري)")}
                  value={outputLimit}
                  onChange={setOutputLimit}
                  type="text"
                  dir="ltr"
                />
              </div>
              <p>
                {words(
                  locale,
                  "Capability and pricing evidence remain UNKNOWN unless a curated source is provided.",
                  "تظل أدلة القدرات والأسعار غير معروفة ما لم يتم تقديم مصدر منسق."
                )}
              </p>
              <Action
                onPress={addDraft}
                tone="secondary"
                disabled={
                  !modelId.trim() ||
                  !displayName.trim() ||
                  (!!contextLimit && !/^[1-9]\d*$/.test(contextLimit)) ||
                  (!!outputLimit && !/^[1-9]\d*$/.test(outputLimit))
                }
              >
                {words(locale, "Add to review batch", "إضافة إلى دفعة المراجعة")}
              </Action>
              {drafts.map((draft, index) => (
                <div
                  className="factory-draft-row"
                  key={`${safeText(draft.upstreamModelId)}-${index}`}
                >
                  <b>{safeText(draft.displayName)}</b>
                  <code dir="ltr">{safeText(draft.upstreamModelId)}</code>
                  <Action
                    onPress={() => {
                      setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
                      setPreview(null);
                    }}
                    tone="quiet"
                  >
                    {words(locale, "Remove draft", "إزالة المسودة")}
                  </Action>
                </div>
              ))}
            </div>
          )}
          <details
            className="factory-advanced"
            open={advancedOpen}
            onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
          >
            <summary>
              {words(locale, "Advanced import payload", "حمولة الاستيراد المتقدمة")}
            </summary>
            <p>
              {words(
                locale,
                "Expert mode for the existing bounded manual schema. The service validates every field; never include credentials.",
                "وضع خبراء للمخطط اليدوي المحدود الحالي. تتحقق الخدمة من كل حقل؛ لا تدرج بيانات اعتماد."
              )}
            </p>
            <label>
              {t.catalogJson}
              <textarea
                dir="ltr"
                spellCheck={false}
                value={json}
                onChange={(event) => {
                  setJson(event.target.value);
                  setPreview(null);
                }}
                placeholder={t.catalogJsonExample}
              />
            </label>
          </details>
          <div className="factory-actions">
            <Action
              onPress={() => void previewCatalog()}
              tone="primary"
              disabled={busy || !connectionId || (!fixture && drafts.length === 0 && !json.trim())}
            >
              {busy ? t.testing : t.previewCatalog}
            </Action>
            <Action
              onPress={() => void syncCatalog()}
              tone="danger"
              disabled={busy || !preview || previewKey !== currentKey}
            >
              {t.syncCatalog}
            </Action>
          </div>
          {preview && (
            <section className="factory-preview" aria-live="polite">
              <header>
                <div>
                  <span className="section-index">
                    {words(locale, "SERVER PREVIEW", "معاينة الخادم")}
                  </span>
                  <h4>{words(locale, "Reviewed catalog changes", "تغييرات الفهرس المراجعة")}</h4>
                </div>
                <span>
                  {safeText(preview.total)} {words(locale, "records", "سجلات")}
                </span>
              </header>
              <div className="factory-metrics">
                <Metric label={t.created} value={safeText(preview.createdCount)} />
                <Metric label={t.updated} value={safeText(preview.updatedCount)} />
                <Metric
                  label={words(locale, "Supported evidence", "أدلة مدعومة")}
                  value={safeText(preview.supportedCapabilityCount)}
                />
                <Metric label={t.unknownPricing} value={safeText(preview.unknownPricingCount)} />
              </div>
              {previewModels.map((model) => (
                <article className="factory-preview-row" key={safeText(model.upstreamModelId)}>
                  <b>{safeText(model.displayName)}</b>
                  <code dir="ltr">{safeText(model.upstreamModelId)}</code>
                  <span>{safeText(model.operation)}</span>
                  <span>
                    {words(locale, "Capabilities", "القدرات")}:{" "}
                    {rows(model.capabilities)
                      .map((entry) => `${safeText(entry.capability)} · ${safeText(entry.status)}`)
                      .join(" / ") || "UNKNOWN"}
                  </span>
                  <span>
                    {words(locale, "Pricing", "السعر")}:{" "}
                    {safeText((model.pricing as Row | undefined)?.status ?? "UNKNOWN")}
                  </span>
                </article>
              ))}
              <p>
                {words(
                  locale,
                  "This API does not expose a field-level diff or deletion baseline. Missing records are not inferred.",
                  "لا تعرض هذه الواجهة مقارنة على مستوى الحقول أو خط أساس للحذف. لا يتم استنتاج السجلات المفقودة."
                )}
              </p>
            </section>
          )}
        </section>
        <section className="factory-pane">
          <header>
            <div>
              <span className="section-index">
                B / {words(locale, "SOURCE MODEL INDEX", "فهرس نماذج المصدر")}
              </span>
              <h3>{words(locale, "Persisted upstream models", "النماذج الخارجية المحفوظة")}</h3>
            </div>
            <div className="factory-catalog-toolbar">
              <div className="factory-search">
                <TextInput
                  label={t.search}
                  value={filter}
                  onChange={setFilter}
                  type="search"
                  dir={locale === "ar" ? "rtl" : "ltr"}
                />
              </div>
              <div className="factory-catalog-filters">
                <EntityPicker
                  label={words(locale, "Mapping", "الربط")}
                  value={mappingFilter}
                  onChange={setMappingFilter}
                  options={mappingOptions}
                  dir={locale === "ar" ? "rtl" : "ltr"}
                  locale={locale}
                  {...pickerCopy(locale)}
                />
                <EntityPicker
                  label={words(locale, "Capability", "القدرة")}
                  value={capabilityFilter}
                  onChange={setCapabilityFilter}
                  options={[
                    { id: "", label: words(locale, "All capabilities", "كل القدرات") },
                    ...capabilityOptions
                  ]}
                  dir={locale === "ar" ? "rtl" : "ltr"}
                  locale={locale}
                  {...pickerCopy(locale)}
                />
                <EntityPicker
                  label={words(locale, "Availability", "التوفر")}
                  value={availabilityFilter}
                  onChange={setAvailabilityFilter}
                  options={[
                    { id: "", label: words(locale, "All availability states", "كل حالات التوفر") },
                    ...availabilityOptions
                  ]}
                  dir={locale === "ar" ? "rtl" : "ltr"}
                  locale={locale}
                  {...pickerCopy(locale)}
                />
              </div>
              <ToggleControl
                label={t.showArchived}
                value={showArchived}
                onChange={setShowArchived}
                dir={locale === "ar" ? "rtl" : "ltr"}
              />
            </div>
          </header>
          <div className="factory-model-list">
            {filteredModels.map((model) => (
              <article className="factory-model-card" key={String(model.id)}>
                <ActionButton
                  variant="quiet"
                  size="compact"
                  className="factory-entity-link"
                  onPress={() => setInspect(model)}
                >
                  <span>
                    <b>{safeText(model.displayName)}</b>
                    <small>
                      {safeText(model.providerName)} · {safeText(model.connectionName)}
                    </small>
                  </span>
                  <code dir="ltr">{safeText(model.upstreamModelId)}</code>
                </ActionButton>
                <div className="factory-connection-facts">
                  <span>
                    {words(locale, "Source", "المصدر")}: {safeText(model.source)}
                  </span>
                  <span>
                    {words(locale, "Lifecycle", "دورة الحياة")}: {badge(model.lifecycle)}
                  </span>
                  <span>
                    {words(locale, "Model Factory mapping", "ربط مصنع النماذج")}:{" "}
                    {mappedSourceIds.has(uniqueId(model.id))
                      ? words(locale, "Mapped to variant", "مرتبط بمتغير")
                      : words(locale, "Unmapped", "غير مرتبط")}
                  </span>
                  <span>
                    {words(locale, "Limits", "الحدود")}: {safeText(model.contextLimit ?? "UNKNOWN")}{" "}
                    / {safeText(model.outputLimit ?? "UNKNOWN")}
                  </span>
                  <span>
                    {words(locale, "Capabilities", "القدرات")}:{" "}
                    {rows(model.capabilities).length
                      ? rows(model.capabilities)
                          .map((item) => `${safeText(item.capability)} ${safeText(item.status)}`)
                          .join(" · ")
                      : "UNKNOWN"}
                  </span>
                </div>
                <div className="factory-actions">
                  <Action onPress={() => setInspect(model)} tone="quiet">
                    {words(locale, "Inspect provenance", "فحص المصدر")}
                  </Action>
                  {navigate && (
                    <Action onPress={() => navigate("models", uniqueId(model.id))} tone="primary">
                      {words(locale, "Open Model Factory", "فتح مصنع النماذج")}
                    </Action>
                  )}
                  {model.lifecycle !== "ARCHIVED" && (
                    <ActionMenu
                      label={words(locale, "Catalog model actions", "إجراءات نموذج الفهرس")}
                      items={[
                        ...(model.lifecycle === "ACTIVE"
                          ? [
                              { id: "disable", label: words(locale, "Disable", "تعطيل") },
                              { id: "deprecate", label: words(locale, "Deprecate", "إيقاف تدريجي") }
                            ]
                          : []),
                        ...(model.lifecycle === "DISABLED"
                          ? [{ id: "activate", label: words(locale, "Activate", "تفعيل") }]
                          : []),
                        ...(model.lifecycle !== "ARCHIVED"
                          ? [{ id: "archive", label: t.archive, tone: "critical" as const }]
                          : [])
                      ]}
                      onAction={(id) => {
                        const lifecycle = {
                          disable: "DISABLED",
                          activate: "ACTIVE",
                          deprecate: "DEPRECATED",
                          archive: "ARCHIVED"
                        }[id];
                        if (!lifecycle) return;
                        const confirm = id === "archive" ? t.confirmArchive : t.confirmStatus;
                        if (window.confirm(confirm))
                          void perform("catalog.model.lifecycle", { id: model.id, lifecycle });
                      }}
                    />
                  )}
                </div>
              </article>
            ))}
            {filteredModels.length === 0 && (
              <EmptyState
                title={words(locale, "No source models found", "لم يتم العثور على نماذج مصدر")}
                description={words(
                  locale,
                  "Adjust the source scope or filters to see persisted catalog records.",
                  "عدّل نطاق المصدر أو عوامل التصفية لعرض سجلات الفهرس المحفوظة."
                )}
              />
            )}
          </div>
        </section>
      </div>
      <Inspector
        open={!!inspect}
        onClose={() => setInspect(null)}
        title={safeText(inspect?.displayName)}
        description={words(
          locale,
          "Provider-sourced catalog metadata. Evidence is shown with its recorded source and observation time.",
          "بيانات فهرس مصدرها المزوّد. تعرض الأدلة مع مصدرها ووقت رصدها المسجل."
        )}
        closeLabel={t.close}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        {inspect && (
          <>
            <dl className="factory-inspector-grid">
              <dt>{t.provider}</dt>
              <dd>{safeText(inspect.providerName)}</dd>
              <dt>{t.connection}</dt>
              <dd>{safeText(inspect.connectionName)}</dd>
              <dt>{words(locale, "Provider ID", "معرّف المزوّد")}</dt>
              <dd dir="ltr">{safeText(inspect.upstreamModelId)}</dd>
              <dt>{words(locale, "Source kind", "نوع المصدر")}</dt>
              <dd>{safeText(inspect.source)}</dd>
              <dt>{words(locale, "Family", "العائلة")}</dt>
              <dd>{safeText(inspect.family)}</dd>
              <dt>{words(locale, "Pricing evidence", "دليل التسعير")}</dt>
              <dd>{safeText((inspect.pricing as Row | undefined)?.status ?? "UNKNOWN")}</dd>
              <dt>{words(locale, "Observed", "وقت الرصد")}</dt>
              <dd>{dateValue((inspect.pricing as Row | undefined)?.observedAt, locale)}</dd>
            </dl>
            <p>
              {words(
                locale,
                "Model-to-family mappings are visible in Model Factory; the source catalog record remains independently lifecycle-managed.",
                "تظهر روابط النموذج بالعائلة في مصنع النماذج؛ ويظل سجل فهرس المصدر مستقلاً في إدارة دورة حياته."
              )}
            </p>
          </>
        )}
      </Inspector>
    </div>
  );
}

function ModelFactoryWorkspace({
  data,
  locale,
  t,
  filter,
  setFilter,
  perform,
  badge,
  appLabel,
  profileRevisions = []
}: Props) {
  const families = data.modelFamilies.filter((family) =>
    `${safeText(family.familyKey)} ${safeText(family.displayName)}`
      .toLocaleLowerCase(locale)
      .includes(filter.toLocaleLowerCase(locale))
  );
  const [showRetired, setShowRetired] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [sourceModel, setSourceModel] = useState<Row | null>(null);
  const [wizard, setWizard] = useState<
    "family" | "edition" | "revision" | "variant" | "binding" | null
  >(null);
  const [familyId, setFamilyId] = useState("");
  const [editionId, setEditionId] = useState("");
  const [revisionId, setRevisionId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [form, setForm] = useState<Record<string, string>>({
    familyKey: "",
    displayName: "",
    publicId: "",
    editionKey: "",
    domain: "",
    instructions: "",
    specification: "",
    profileRevisionId: "",
    variantKey: "",
    upstreamModelId: "",
    transportProfile: "",
    connectionId: "",
    scope: "PLATFORM",
    applicationId: "",
    tenantId: "",
    environment: "production"
  });
  useEffect(() => {
    const requestedSource = new URLSearchParams(window.location.search).get("entity");
    if (requestedSource) {
      const match = data.upstreamModels.find((model) => model.id === requestedSource);
      if (match) setSourceModel(match);
    }
  }, [data.upstreamModels]);
  const set = (key: string) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const editions: Row[] = data.modelFamilies.flatMap((family) =>
    rows(family.editions).map((edition): Row => ({ ...edition, family }))
  );
  const revisions: Row[] = editions.flatMap((edition) =>
    rows(edition.revisions).map((revision): Row => ({ ...revision, edition }))
  );
  const variants: Row[] = revisions.flatMap((revision) =>
    rows(revision.variants).map((variant): Row => ({ ...variant, revision }))
  );
  const connectionOptions = data.connections
    .filter((connection) => connection.status !== "ARCHIVED")
    .map((connection) => ({
      id: uniqueId(connection.id),
      label: `${safeText(connection.displayName)} · ${safeText((connection.providerDefinition as Row | undefined)?.displayName)}`,
      secondary: `${safeText(connection.scope)} · ${safeText(connection.status)} · ${safeText(connection.healthStatus)}`,
      status: statusTone(connection.healthStatus)
    }));
  const sourceOptions = data.upstreamModels
    .filter((model) => model.lifecycle === "ACTIVE")
    .map((model) => ({
      id: uniqueId(model.id),
      label: `${safeText(model.displayName)} · ${safeText(model.providerName)}`,
      secondary: safeText(model.upstreamModelId),
      status: "unknown" as const
    }));
  const appOptions = data.applications.map((app) => ({
    id: uniqueId(app.id),
    label: `${safeText(app.key)} · ${safeText(app.displayName)}`
  }));
  const tenantOptions = data.tenants.map((tenant) => ({
    id: uniqueId(tenant.id),
    label: `${appLabel(tenant.applicationId)} · ${safeText(tenant.displayName)}`
  }));
  const scopeOptions = ["PLATFORM", "APPLICATION", "TENANT"].map((item) => ({
    id: item,
    label: item
  }));
  const selectedSource = data.upstreamModels.find((model) => model.id === form.upstreamModelId);
  const transportOptions = [
    ...new Set(
      data.providers
        .filter((provider) => provider.key === selectedSource?.providerKey)
        .flatMap((provider) => list(provider.transportProfiles))
    )
  ].map((item) => ({ id: item, label: item }));
  const profileOptions = profileRevisions
    .filter((revision) => (revision.profile as Row | undefined)?.lifecycle === "ACTIVE")
    .map((revision) => ({
      id: uniqueId(revision.id),
      label: `${safeText((revision.profile as Row | undefined)?.displayName)} · r${safeText(revision.revision)}`
    }));
  const wizardFields = useMemo((): WizardField[][] => {
    if (wizard === "family")
      return [
        [
          {
            key: "familyKey",
            label: t.familyKey,
            value: form.familyKey,
            onChange: set("familyKey"),
            required: true
          },
          {
            key: "displayName",
            label: t.displayName,
            value: form.displayName,
            onChange: set("displayName"),
            required: true
          }
        ]
      ];
    if (wizard === "edition")
      return [
        [
          {
            key: "publicId",
            label: t.publicId,
            value: form.publicId,
            onChange: set("publicId"),
            required: true,
            description: "oi-…"
          },
          {
            key: "editionKey",
            label: t.editionKey,
            value: form.editionKey,
            onChange: set("editionKey"),
            required: true
          },
          {
            key: "displayName",
            label: t.displayName,
            value: form.displayName,
            onChange: set("displayName"),
            required: true
          },
          { key: "domain", label: t.domain, value: form.domain, onChange: set("domain") }
        ]
      ];
    if (wizard === "revision")
      return [
        [
          {
            key: "profile",
            label: words(
              locale,
              "Intelligence profile revision (optional)",
              "مراجعة ملف الذكاء (اختياري)"
            ),
            value: form.profileRevisionId,
            onChange: set("profileRevisionId"),
            options: [
              { id: "", label: words(locale, "FAST default", "الإعداد السريع الافتراضي") },
              ...profileOptions
            ]
          }
        ]
      ];
    if (wizard === "variant")
      return [
        [
          {
            key: "variantKey",
            label: t.variantKey,
            value: form.variantKey,
            onChange: set("variantKey"),
            required: true
          },
          {
            key: "upstreamModelId",
            label: t.upstreamRecord,
            value: form.upstreamModelId,
            onChange: set("upstreamModelId"),
            required: true,
            options: sourceOptions
          },
          {
            key: "transportProfile",
            label: t.transport,
            value: form.transportProfile,
            onChange: set("transportProfile"),
            required: true,
            options: transportOptions
          }
        ]
      ];
    if (wizard === "binding")
      return [
        [
          {
            key: "connectionId",
            label: t.connectionRecord,
            value: form.connectionId,
            onChange: set("connectionId"),
            required: true,
            options: connectionOptions
          },
          {
            key: "scope",
            label: t.scope,
            value: form.scope,
            onChange: set("scope"),
            options: scopeOptions
          },
          ...(form.scope !== "PLATFORM"
            ? [
                {
                  key: "applicationId",
                  label: t.application,
                  value: form.applicationId,
                  onChange: (value: string) =>
                    setForm((current) => ({ ...current, applicationId: value, tenantId: "" })),
                  options: appOptions,
                  required: true
                }
              ]
            : []),
          ...(form.scope === "TENANT"
            ? [
                {
                  key: "tenantId",
                  label: t.tenant,
                  value: form.tenantId,
                  onChange: set("tenantId"),
                  options: tenantOptions.filter((option) => {
                    const tenant = data.tenants.find((item) => item.id === option.id);
                    return tenant?.applicationId === form.applicationId;
                  }),
                  required: true
                }
              ]
            : []),
          {
            key: "environment",
            label: t.bindingEnvironment,
            value: form.environment,
            onChange: set("environment"),
            required: true
          }
        ]
      ];
    return [];
  }, [
    wizard,
    locale,
    t,
    form,
    connectionOptions,
    scopeOptions,
    appOptions,
    tenantOptions,
    sourceOptions,
    transportOptions,
    profileOptions
  ]);
  const finish = () => {
    let action = "";
    let payload: Row = {};
    if (wizard === "family") {
      action = "model.family.create";
      payload = { familyKey: form.familyKey, displayName: form.displayName };
    }
    if (wizard === "edition" && familyId) {
      action = "model.edition.create";
      payload = {
        familyId,
        publicId: form.publicId,
        editionKey: form.editionKey,
        displayName: form.displayName,
        ...(form.domain ? { domain: form.domain } : {})
      };
    }
    if (wizard === "revision" && editionId) {
      action = "model.revision.create";
      payload = {
        editionId,
        ...(form.instructions ? { instructions: form.instructions } : {}),
        ...(form.specification ? { specification: form.specification } : {}),
        ...(form.profileRevisionId ? { intelligenceProfileRevisionId: form.profileRevisionId } : {})
      };
    }
    if (wizard === "variant" && revisionId) {
      action = "model.variant.create";
      payload = {
        revisionId,
        variantKey: form.variantKey,
        upstreamModelId: form.upstreamModelId,
        transportProfile: form.transportProfile
      };
    }
    if (wizard === "binding" && editionId) {
      action = "model.binding.create";
      payload = {
        editionId,
        variantId,
        connectionId: form.connectionId,
        scope: form.scope,
        ...(form.applicationId ? { applicationId: form.applicationId } : {}),
        ...(form.tenantId ? { tenantId: form.tenantId } : {}),
        ...(form.environment ? { environment: form.environment } : {})
      };
    }
    if (!action) return;
    void perform(action, payload).then((result) => {
      if (result) setWizard(null);
    });
  };
  const openWizard = (
    kind: NonNullable<typeof wizard>,
    family?: Row,
    edition?: Row,
    revision?: Row,
    variant?: Row
  ) => {
    setFamilyId(uniqueId(family?.id));
    setEditionId(uniqueId(edition?.id));
    setRevisionId(uniqueId(revision?.id));
    setVariantId(uniqueId(variant?.id));
    setForm({
      familyKey: "",
      displayName: "",
      publicId: "",
      editionKey: "",
      domain: "",
      instructions: "",
      specification: "",
      profileRevisionId: "",
      variantKey: "",
      upstreamModelId: kind === "variant" ? uniqueId(sourceModel?.id) : "",
      transportProfile: "",
      connectionId: "",
      scope: "PLATFORM",
      applicationId: "",
      tenantId: "",
      environment: "production"
    });
    setWizard(kind);
  };
  const wizardTitle =
    wizard === "family"
      ? t.createFamily
      : wizard === "edition"
        ? t.createEdition
        : wizard === "revision"
          ? t.createRevision
          : wizard === "variant"
            ? t.createVariant
            : t.createBinding;
  const wizardStepNames =
    wizard === "family"
      ? [words(locale, "Identity", "الهوية")]
      : wizard === "edition"
        ? [words(locale, "Edition identity", "هوية الإصدار")]
        : wizard === "revision"
          ? [words(locale, "Revision content", "محتوى المراجعة")]
          : wizard === "variant"
            ? [words(locale, "Source & transport", "المصدر والنقل")]
            : [words(locale, "Scope & target", "النطاق والهدف")];
  const modelRelationships = (variant: Row) => {
    if (variant.familyKey) {
      return (
        <RelationshipPanel
          label={words(locale, "Family lineage", "سلسلة العائلة")}
          relationships={rows(variant.editions).map((edition) => ({
            id: String(edition.id),
            type: words(locale, "EDITION", "إصدار"),
            name: `${safeText(edition.publicId)} · ${safeText(edition.lifecycle)}`
          }))}
        />
      );
    }
    const upstream = data.upstreamModels.find((item) => item.id === variant.upstreamModelId);
    const bindingRows = rows(variant.bindings);
    return (
      <RelationshipPanel
        label={words(locale, "Variant lineage", "سلسلة المتغير")}
        relationships={[
          {
            id: `family-${String(variant.revisionId)}`,
            type: words(locale, "REVISION", "المراجعة"),
            name: `r${safeText((variant.revision as Row | undefined)?.revision)}`
          },
          {
            id: `upstream-${String(variant.upstreamModelId)}`,
            type: words(locale, "UPSTREAM SOURCE", "المصدر الخارجي"),
            name: upstream
              ? `${safeText(upstream.providerName)} · ${safeText(upstream.displayName)}`
              : words(locale, "Oi-native / no upstream source", "تنفيذ أصلي لـ Oi / بلا مصدر خارجي")
          },
          ...bindingRows.map((binding) => ({
            id: String(binding.id),
            type: words(locale, "RUNTIME BINDING", "ارتباط التشغيل"),
            name: `${safeText(binding.scope)} · ${safeText(binding.environment)} · ${safeText(binding.status)}`
          }))
        ]}
      />
    );
  };
  return (
    <div className="factory-workspace" dir={locale === "ar" ? "rtl" : "ltr"}>
      <FactoryHeader
        number="06"
        eyebrow={words(locale, "MODEL FACTORY", "مصنع النماذج")}
        title={t.models}
        description={words(
          locale,
          "Trace model identity from family through immutable revision and variant to source-backed runtime bindings and application visibility.",
          "تتبّع هوية النموذج من العائلة مروراً بالمراجعة غير القابلة للتعديل والمتغير إلى ارتباطات التشغيل المصدرية وظهوره للتطبيق."
        )}
      >
        <Action onPress={() => openWizard("family")} tone="primary">
          {t.createFamily}
        </Action>
      </FactoryHeader>
      {sourceModel && (
        <section className="factory-source-handoff" aria-live="polite">
          <div>
            <span className="section-index">
              {words(locale, "CATALOG SOURCE SELECTED", "تم اختيار مصدر الفهرس")}
            </span>
            <strong>{safeText(sourceModel.displayName)}</strong>
            <code dir="ltr">{safeText(sourceModel.upstreamModelId)}</code>
            <small>
              {words(
                locale,
                "This source can be selected when creating a variant on an existing revision. No family mapping is created automatically.",
                "يمكن اختيار هذا المصدر عند إنشاء متغير على مراجعة موجودة. لا يتم إنشاء ربط عائلة تلقائياً."
              )}
            </small>
          </div>
          <Action onPress={() => setSourceModel(null)}>
            {words(locale, "Clear source", "مسح المصدر")}
          </Action>
        </section>
      )}
      <div className="factory-metrics">
        <Metric label={t.family} value={data.modelFamilies.length} />
        <Metric label={t.edition} value={editions.length} />
        <Metric
          label={t.revision}
          value={revisions.length}
          detail={words(locale, "Append-only", "إضافات فقط")}
        />
        <Metric label={t.variant} value={variants.length} />
        <Metric
          label={t.binding}
          value={variants.reduce((sum, variant) => sum + rows(variant.bindings).length, 0)}
        />
        <Metric
          label={t.visibility}
          value={editions.reduce((sum, edition) => sum + rows(edition.visibility).length, 0)}
        />
      </div>
      {wizard && (
        <FactoryWizard
          title={wizardTitle}
          locale={locale}
          fields={wizardFields}
          steps={wizardStepNames}
          finish={finish}
          finishLabel={t.create}
          cancel={() => setWizard(null)}
          supplement={
            wizard === "revision" ? (
              <div className="factory-revision-content">
                <label>
                  {t.instructions}
                  <textarea
                    maxLength={100000}
                    value={form.instructions}
                    onChange={(event) => set("instructions")(event.target.value)}
                  />
                </label>
                <label>
                  {t.specification}
                  <textarea
                    maxLength={100000}
                    value={form.specification}
                    onChange={(event) => set("specification")(event.target.value)}
                  />
                </label>
                <p>
                  {words(
                    locale,
                    "A revision is immutable after creation. Changes require creating the next revision.",
                    "المراجعة غير قابلة للتعديل بعد إنشائها. تتطلب التغييرات إنشاء المراجعة التالية."
                  )}
                </p>
              </div>
            ) : undefined
          }
        />
      )}
      <section className="factory-pane">
        <header>
          <div>
            <span className="section-index">
              A / {words(locale, "MODEL LINEAGE", "سلسلة النموذج")}
            </span>
            <h3>
              {words(
                locale,
                "Family → edition → revision → variant → binding",
                "العائلة ← الإصدار ← المراجعة ← المتغير ← الارتباط"
              )}
            </h3>
          </div>
          <div className="factory-list-controls">
            <div className="factory-search">
              <TextInput
                label={t.search}
                value={filter}
                onChange={setFilter}
                type="search"
                dir={locale === "ar" ? "rtl" : "ltr"}
              />
            </div>
            <ToggleControl
              label={words(locale, "Show retired records", "إظهار السجلات المتقاعدة")}
              value={showRetired}
              onChange={setShowRetired}
              dir={locale === "ar" ? "rtl" : "ltr"}
            />
          </div>
        </header>
        {families
          .filter((family) => showRetired || !isRetiredRecord(family))
          .map((family, familyIndex) => (
            <article className="factory-family" key={String(family.id)}>
              <header>
                <div>
                  <span className="section-index">
                    {String(familyIndex + 1).padStart(2, "0")} / {t.family}
                  </span>
                  <h3>{safeText(family.displayName)}</h3>
                  <code>{safeText(family.familyKey)}</code>
                </div>
                <span className={`oi-state-tag is-${statusTone(family.lifecycle)}`}>
                  {safeText(family.lifecycle)}
                </span>
                <div className="factory-actions">
                  <Action onPress={() => setSelected(family)} tone="quiet">
                    {words(locale, "Inspect family", "فحص العائلة")}
                  </Action>
                  {family.lifecycle !== "RETIRED" && (
                    <Action onPress={() => openWizard("edition", family)} tone="primary">
                      {t.createEdition}
                    </Action>
                  )}
                  {family.lifecycle !== "RETIRED" && (
                    <ActionMenu
                      label={words(locale, "More family actions", "إجراءات عائلة إضافية")}
                      items={[
                        {
                          id: "retire",
                          label: t.retireFamily,
                          disabled: rows(family.editions).some(
                            (edition) => edition.lifecycle !== "RETIRED"
                          ),
                          tone: "critical"
                        }
                      ]}
                      onAction={() => {
                        if (window.confirm(t.confirmRetire))
                          void perform("model.family.retire", { id: family.id });
                      }}
                    />
                  )}
                  {rows(family.editions).some((edition) => edition.lifecycle !== "RETIRED") && (
                    <small className="factory-prerequisite-note">
                      {words(
                        locale,
                        "Retire all editions before retiring this family.",
                        "يجب إيقاف جميع الإصدارات قبل إيقاف العائلة."
                      )}
                    </small>
                  )}
                </div>
              </header>
              {rows(family.editions)
                .filter((edition) => showRetired || !isRetiredRecord(edition))
                .map((edition) => (
                  <section className="factory-edition" key={String(edition.id)}>
                    <header>
                      <div>
                        <span className="section-index">{t.edition}</span>
                        <h4>
                          {safeText(edition.displayName)} <code>{safeText(edition.publicId)}</code>
                        </h4>
                        <small>
                          {safeText(edition.domain)} · {safeText(edition.editionKey)}
                        </small>
                      </div>
                      {badge(edition.lifecycle)}
                      <div className="factory-actions">
                        {EDITION_TRANSITIONS[String(edition.lifecycle).toUpperCase()]?.length >
                          0 && (
                          <ActionMenu
                            label={words(locale, "Change lifecycle", "تغيير دورة الحياة")}
                            items={EDITION_TRANSITIONS[String(edition.lifecycle).toUpperCase()].map(
                              (target) => {
                                const hasActiveBinding = rows(edition.revisions).some((revision) =>
                                  rows(revision.variants).some((variant) =>
                                    rows(variant.bindings).some(
                                      (binding) => binding.status === "ACTIVE"
                                    )
                                  )
                                );
                                const needsBinding = target === "CANARY" || target === "PRODUCTION";
                                return {
                                  id: target,
                                  label: target,
                                  disabled:
                                    (needsBinding && !hasActiveBinding) ||
                                    (target === "RETIRED" && hasActiveBinding),
                                  ...(target === "RETIRED" ? { tone: "critical" as const } : {})
                                };
                              }
                            )}
                            onAction={(target) => {
                              const confirm =
                                target === "RETIRED" ? t.confirmRetire : t.confirmStatus;
                              if (window.confirm(confirm))
                                void perform("edition.lifecycle", {
                                  id: edition.id,
                                  lifecycle: target
                                });
                            }}
                          />
                        )}
                        {edition.lifecycle !== "RETIRED" && (
                          <Action onPress={() => openWizard("revision", family, edition)}>
                            {t.createRevision}
                          </Action>
                        )}
                        {EDITION_TRANSITIONS[String(edition.lifecycle).toUpperCase()]?.length >
                          0 && (
                          <small className="factory-prerequisite-note">
                            {words(
                              locale,
                              "CANARY and PRODUCTION require an active binding; RETIRED requires none.",
                              "تتطلب حالتا CANARY وPRODUCTION ارتباطاً نشطاً، وتتطلب RETIRED عدم وجود ارتباط نشط."
                            )}
                          </small>
                        )}
                      </div>
                    </header>
                    {rows(edition.revisions)
                      .filter((revision) => showRetired || !isRetiredRecord(revision))
                      .map((revision) => (
                        <article className="factory-revision" key={String(revision.id)}>
                          <header>
                            <div>
                              <span className="section-index">
                                {words(locale, "IMMUTABLE REVISION", "مراجعة غير قابلة للتعديل")}
                              </span>
                              <h5>r{safeText(revision.revision)}</h5>
                              <small>
                                {dateValue(revision.createdAt, locale)} ·{" "}
                                {words(
                                  locale,
                                  "Read-only after creation",
                                  "للقراءة فقط بعد الإنشاء"
                                )}
                              </small>
                            </div>
                            {edition.lifecycle !== "RETIRED" && (
                              <Action
                                onPress={() => openWizard("variant", family, edition, revision)}
                                tone="primary"
                              >
                                {t.createVariant}
                              </Action>
                            )}
                          </header>
                          <div className="factory-variant-grid">
                            {rows(revision.variants)
                              .filter((variant) => showRetired || !isRetiredRecord(variant))
                              .map((variant) => {
                                const source = data.upstreamModels.find(
                                  (model) => model.id === variant.upstreamModelId
                                );
                                const providerKey = (variant.providerDefinition as Row | undefined)
                                  ?.key;
                                const bindingRows = rows(variant.bindings);
                                return (
                                  <article className="factory-variant" key={String(variant.id)}>
                                    <header>
                                      <div>
                                        <span className="section-index">{t.variant}</span>
                                        <h5>{safeText(variant.variantKey)}</h5>
                                        <small>
                                          {safeText(variant.transportProfile)} ·{" "}
                                          {safeText(variant.kind)}
                                        </small>
                                      </div>
                                      <Action
                                        onPress={() =>
                                          setSelected({ ...variant, revision, edition, family })
                                        }
                                      >
                                        {words(locale, "Inspect lineage", "فحص السلسلة")}
                                      </Action>
                                    </header>
                                    <dl>
                                      <dt>{words(locale, "Source model", "نموذج المصدر")}</dt>
                                      <dd>
                                        {source
                                          ? `${safeText(source.providerName)} · ${safeText(source.displayName)}`
                                          : words(
                                              locale,
                                              "Oi-native implementation / no upstream model",
                                              "تنفيذ أصلي لـ Oi / لا يوجد نموذج خارجي"
                                            )}
                                      </dd>
                                      <dt>{words(locale, "Source identifier", "معرّف المصدر")}</dt>
                                      <dd dir="ltr">
                                        {source ? safeText(source.upstreamModelId) : "—"}
                                      </dd>
                                      <dt>{words(locale, "Provider", "المزوّد")}</dt>
                                      <dd>
                                        {safeText(
                                          (variant.providerDefinition as Row | undefined)
                                            ?.displayName ?? providerKey
                                        )}
                                      </dd>
                                      <dt>{t.binding}</dt>
                                      <dd>
                                        {bindingRows.length} ·{" "}
                                        {bindingRows
                                          .map(
                                            (binding) =>
                                              `${safeText(binding.scope)}/${safeText(binding.environment)} ${safeText(binding.status)}`
                                          )
                                          .join(" · ") ||
                                          words(locale, "No binding", "لا يوجد ارتباط")}
                                      </dd>
                                    </dl>
                                    <div className="factory-actions">
                                      {edition.lifecycle !== "RETIRED" && (
                                        <Action
                                          onPress={() =>
                                            openWizard(
                                              "binding",
                                              family,
                                              edition,
                                              revision,
                                              variant
                                            )
                                          }
                                          tone="primary"
                                        >
                                          {t.createBinding}
                                        </Action>
                                      )}
                                      {bindingRows.length > 0 && (
                                        <ActionMenu
                                          label={words(
                                            locale,
                                            "Binding actions",
                                            "إجراءات الارتباط"
                                          )}
                                          items={bindingRows.map((binding) => ({
                                            id: uniqueId(binding.id),
                                            label: `${safeText(binding.displayName ?? binding.environment)} · ${binding.status === "ACTIVE" ? words(locale, "Disable", "تعطيل") : words(locale, "Activate", "تفعيل")}`,
                                            ...(binding.status === "ACTIVE"
                                              ? { tone: "critical" as const }
                                              : {})
                                          }))}
                                          onAction={(id) => {
                                            const binding = bindingRows.find(
                                              (item) => item.id === id
                                            );
                                            if (binding && window.confirm(t.confirmStatus)) {
                                              void perform("binding.status", {
                                                id: binding.id,
                                                status:
                                                  binding.status === "ACTIVE"
                                                    ? "DISABLED"
                                                    : "ACTIVE"
                                              });
                                            }
                                          }}
                                        />
                                      )}
                                    </div>
                                  </article>
                                );
                              })}
                          </div>
                          {rows(revision.variants).length === 0 && (
                            <p className="factory-empty">
                              {words(
                                locale,
                                "No variants are registered on this revision.",
                                "لا توجد متغيرات مسجلة في هذه المراجعة."
                              )}
                            </p>
                          )}
                        </article>
                      ))}
                    {rows(edition.visibility).length > 0 && (
                      <div className="factory-visibility">
                        <b>{words(locale, "Application visibility", "ظهور التطبيق")}</b>
                        {rows(edition.visibility).map((entry) => (
                          <span key={String(entry.applicationId)}>
                            {safeText(
                              (entry.application as Row | undefined)?.displayName ??
                                entry.applicationId
                            )}{" "}
                            · {t.visible}
                            <Action
                              onPress={() =>
                                void perform("model.visibility.revoke", {
                                  applicationId: entry.applicationId,
                                  editionId: edition.id,
                                  visible: false
                                })
                              }
                              confirm={t.confirmVisibilityRevoke}
                              tone="danger"
                            >
                              {t.removeVisibility}
                            </Action>
                          </span>
                        ))}
                      </div>
                    )}
                    {edition.lifecycle !== "RETIRED" && (
                      <div className="factory-visibility">
                        <b>{words(locale, "Publish to application", "النشر للتطبيق")}</b>
                        {data.applications
                          .filter(
                            (app) =>
                              !rows(edition.visibility).some(
                                (entry) => entry.applicationId === app.id
                              )
                          )
                          .map((app) => (
                            <span key={String(app.id)}>
                              {safeText(app.displayName)}
                              <Action
                                onPress={() =>
                                  void perform("model.visibility.grant", {
                                    applicationId: app.id,
                                    editionId: edition.id,
                                    visible: true
                                  })
                                }
                                confirm={t.confirmStatus}
                              >
                                {t.publish}
                              </Action>
                            </span>
                          ))}
                      </div>
                    )}
                  </section>
                ))}
              {rows(family.editions).length === 0 && (
                <p className="factory-empty">
                  {words(
                    locale,
                    "This family has no editions yet.",
                    "لا تحتوي هذه العائلة على إصدارات بعد."
                  )}
                </p>
              )}
            </article>
          ))}
        {families.length === 0 && (
          <p className="factory-empty">
            {words(
              locale,
              "No model families match the current filter.",
              "لا تطابق أي عائلات نماذج عامل التصفية الحالي."
            )}
          </p>
        )}
      </section>
      <section className="factory-pane">
        <header>
          <div>
            <span className="section-index">
              B / {words(locale, "ASSEMBLY RELATIONSHIPS", "علاقات التجميع")}
            </span>
            <h3>{words(locale, "Persisted hierarchy summary", "ملخص التسلسل المحفوظ")}</h3>
          </div>
        </header>
        <p>
          {words(
            locale,
            "The assembly is the persisted relationship graph. No release pipeline, validation score or runtime eligibility is inferred beyond current API state.",
            "التجميع هو رسم العلاقات المحفوظ. لا يتم استنتاج خط إصدار أو درجة تحقق أو أهلية تشغيل خارج حالة الواجهة الحالية."
          )}
        </p>
        <div className="factory-lineage">
          {[t.family, t.edition, t.revision, t.variant, t.binding].map((item, index) => (
            <div key={item}>
              <small>0{index + 1}</small>
              <b>{item}</b>
              <strong>
                {
                  [
                    data.modelFamilies.length,
                    editions.length,
                    revisions.length,
                    variants.length,
                    variants.reduce((sum, variant) => sum + rows(variant.bindings).length, 0)
                  ][index]
                }
              </strong>
            </div>
          ))}
        </div>
      </section>
      <Inspector
        open={!!selected}
        onClose={() => setSelected(null)}
        title={safeText(selected?.displayName ?? selected?.variantKey ?? selected?.familyKey)}
        description={words(
          locale,
          "Factory identity, immutable provenance and connected resources.",
          "هوية المصنع والمصدر غير القابل للتعديل والموارد المرتبطة."
        )}
        closeLabel={t.close}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        {selected && (
          <>
            {modelRelationships(selected)}
            <dl className="factory-inspector-grid">
              <dt>{t.family}</dt>
              <dd>
                {safeText(selected.familyKey ?? (selected.family as Row | undefined)?.familyKey)}
              </dd>
              <dt>{t.edition}</dt>
              <dd>{safeText((selected.edition as Row | undefined)?.publicId)}</dd>
              <dt>{t.revision}</dt>
              <dd>{safeText((selected.revision as Row | undefined)?.revision)}</dd>
              <dt>{t.variant}</dt>
              <dd>{safeText(selected.variantKey)}</dd>
            </dl>
          </>
        )}
      </Inspector>
    </div>
  );
}

export function FactoryEngineeringWorkspaces(props: Props) {
  if (props.view === "providers") return <ProviderWorkspace {...props} />;
  if (props.view === "catalog") return <CatalogWorkspace {...props} />;
  if (props.view === "models") return <ModelFactoryWorkspace {...props} />;
  return null;
}
