"use client";

import type { FormEvent } from "react";
import type { Locale, Messages, View } from "../../i18n";
import { safeText } from "../../format";
import type { Row, Snapshot } from "../../types";

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
                    void runInvocation(event);
                  }}
                >
                  <label>
                    {t.requestModel}
                    <input
                      name="model"
                      required
                      maxLength={64}
                      pattern="oi-[a-z0-9]+([._-][a-z0-9]+)*"
                      dir="ltr"
                      list="oic-visible-models"
                      placeholder={t.runtimeModelHint}
                    />
                    <datalist id="oic-visible-models">
                      {data?.modelFamilies.flatMap((family) =>
                        ((family.editions as Row[]) ?? [])
                          .filter((edition) => ((edition.visibility as Row[]) ?? []).some((item) => item.applicationId === data.runtimeContext?.application.id))
                          .map((edition) => <option key={String(edition.id)} value={String(edition.publicId)}>{String(edition.displayName)}</option>)
                      )}
                    </datalist>
                  </label>
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
                    <label>
                      {t.runtimeTenant}
                      <select name="tenantId" defaultValue="" disabled={!data?.runtimeContext}>
                        <option value="">—</option>
                        {(data?.runtimeContext?.tenants ?? []).map((tenant) => (
                          <option key={String(tenant.id)} value={String(tenant.id)}>
                            {`${safeText(tenant.key)} · ${safeText(tenant.displayName)}`}
                          </option>
                        ))}
                      </select>
                    </label>
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
                  <div className="response-empty">
                    <span>01</span>
                    <p>{t.noData}</p>
                    <small>{literal("REQUEST → RESOLUTION → EXECUTION → RESPONSE")}</small>
                  </div>
                )}
              </div>
            </section>
          )}


  </>;
}
