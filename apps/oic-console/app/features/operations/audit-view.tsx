"use client";

import type { ReactNode } from "react";
import type { Messages, View } from "../../i18n";
import type { Row, Snapshot } from "../../types";
import { FilterBox } from "../../components/oic-controls";

type Props = {
  view: View;
  data: Snapshot | null;
  t: Messages;
  literal: (value: string) => string;
  filter: string;
  setFilter: (value: string) => void;
  filtered: (rows: Row[] | undefined) => Row[];
  renderAudit: (events: Row[]) => ReactNode;
};

export function AuditView({ view, data, t, literal, filter, setFilter, filtered, renderAudit }: Props) {
  return <>          {view === "audit" && data && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="section-index">09 / {literal("TRACEABLE OPERATIONS")}</span>
                  <h3>{t.audit}</h3>
                  <p>{t.noMetadata}</p>
                </div>
              </div>
              <FilterBox value={filter} onChange={setFilter} placeholder={t.search} />
              {renderAudit(filtered(data.audit))}
            </section>
          )}


  </>;
}
