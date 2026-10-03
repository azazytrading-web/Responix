"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type { Locale, Messages, View } from "../../i18n";
import { safeText } from "../../format";
import type { Row, Snapshot } from "../../types";
import { EmptyState, EntityPicker } from "../../components/oic-primitives";

type Props = {
  view: View;
  data: Snapshot | null;
  locale: Locale;
  t: Messages;
  literal: (value: string) => string;
  runInvocation: (event: FormEvent<HTMLFormElement>) => void;
  running: boolean;
  invocation: Row | null;
};

export function RuntimeView({ view, data, locale, t, literal, runInvocation, running, invocation }: Props) {
  const [model, setModel] = useState("");
  const [tenantId, setTenantId] = useState("");
  const visibleModels = (data?.modelFamilies ?? []).flatMap((family) => {
    const editions = Array.isArray(family.editions) ? family.editions as Row[] : [];
    return editions
      .filter((edition) => (Array.isArray(edition.visibility) ? edition.visibility as Row[] : []).some((item) => item.applicationId === data?.runtimeContext?.application.id))
      .map((edition) => {
        const lifecycle = safeText(edition.lifecycle) || "ACTIVE";
        const enumLabels = t.enums as Record<string, string>;
        return {
          id: safeText(edition.publicId),
          label: safeText(edition.displayName) || safeText(edition.publicId),
          metadata: `${safeText(family.displayName)} · ${safeText(edition.publicId)}`,
          status: lifecycle,
          statusLabel: enumLabels[lifecycle] ?? lifecycle
        };
      });
  }).filter((option, index, items) => option.id && items.findIndex((candidate) => candidate.id === option.id) === index);
  const tenants = (data?.runtimeContext?.tenants ?? []).map((tenant) => ({
    id: safeText(tenant.id),
    label: safeText(tenant.displayName) || safeText(tenant.key),
    metadata: safeText(tenant.key)
  }));
  return <>          {view === "runtime" && (
            <section className="runtime-grid">
              <div className="panel runtime-form-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-index">07 / {literal("NATIVE RUNTIME")}</span>
                    <h3>{t.runtime}</h3>
                    <p>{t.testNotice}</p>
                  </div>
                  <span className="runtime-symbol">⌘</span>
                </div>
                <form
                  className="runtime-form"
                  onSubmit={(event) => {
                    if (!model) { event.preventDefault(); return; }
                    void runInvocation(event);
                  }}
                >
                  <EntityPicker name="model" options={visibleModels} value={model} onChange={setModel} label={t.requestModel} placeholder={t.chooseRuntimeModel} emptyLabel={t.noVisibleModels} disabled={!data?.runtimeContext} dir={locale === "ar" ? "rtl" : "ltr"} />
                  <div className="runtime-context-row">
                    <span>{t.runtimeApplication}</span>
                    <b>{data?.runtimeContext?.application ? `${safeText(data.runtimeContext.application.key)} · ${safeText(data.runtimeContext.application.displayName)}` : t.noRuntimeContext}</b>
                  </div>
                  <label>
                    {t.prompt}
                    <textarea
                      name="prompt"
                      required
                      maxLength={12000}
                      defaultValue={
                        locale === "ar"
                          ? "مرحباً، أجب بجملة قصيرة."
                          : "Hello. Reply in one short sentence."
                      }
                    />
                  </label>
                  <div className="form-row">
                    <EntityPicker name="tenantId" options={tenants} value={tenantId} onChange={setTenantId} label={t.runtimeTenant} placeholder={t.chooseRuntimeTenant} emptyLabel={t.noGrantedTenants} disabled={!data?.runtimeContext || tenants.length === 0} dir={locale === "ar" ? "rtl" : "ltr"} />
                    <label>
                      {t.maxOutput}
                      <input
                        name="maxOutputUnits"
                        type="number"
                        min={1}
                        max={65536}
                        defaultValue={1024}
                      />
                    </label>
                  </div>
                  <button className="button primary" type="submit" disabled={running}>
                    {running ? t.running : t.run}
                    <span>↗</span>
                  </button>
                </form>
              </div>
              <div className="panel response-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-index">EXECUTION / EVIDENCE</span>
                    <h3>{t.result}</h3>
                  </div>
                  <span className="response-dot" />
                </div>
                {invocation ? (
                  <>
                    <div className="runtime-correlation">
                      <span>{t.requestIdLabel}<code>{safeText(invocation.requestId)}</code></span>
                      <span>{t.traceIdLabel}<code>{safeText(invocation.traceId)}</code></span>
                      <span>HTTP {safeText(invocation.httpStatus)}</span>
                    </div>
                    <pre className="response-code">{JSON.stringify(invocation.result ?? invocation, null, 2)}</pre>
                  </>
                ) : (
                  <EmptyState title={t.runtimeAwaitingResult} description={t.runtimeAwaitingExplain} technicalReason={literal("REQUEST → RESOLUTION → EXECUTION → RESPONSE")} />
                )}
              </div>
            </section>
          )}


  </>;
}
