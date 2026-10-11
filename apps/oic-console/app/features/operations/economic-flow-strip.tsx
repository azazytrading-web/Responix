"use client";

import type { Locale, View } from "../../i18n";
import { ActionButton } from "../../components/interface";

export type EvidenceAvailability = "AVAILABLE" | "PARTIAL" | "UNKNOWN" | "NOT_CONFIGURED";
type FlowNode = { id: string; label: string; view: View; state: EvidenceAvailability };

export function EconomicFlowStrip({
  current,
  locale,
  navigate,
  states
}: {
  current: FlowNode["id"];
  locale: Locale;
  navigate: (view: View) => void;
  states: { usage: EvidenceAvailability; provider: EvidenceAvailability; oiu: EvidenceAvailability; admission: EvidenceAvailability; rating: EvidenceAvailability };
}) {
  const ar = locale === "ar";
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const nodes: FlowNode[] = [
    { id: "usage", label: tr("Raw usage", "الاستخدام الخام"), view: "usage", state: states.usage },
    { id: "provider", label: tr("Provider expense", "نفقات المزوّد"), view: "economics", state: states.provider },
    { id: "oiu", label: tr("OIU", "وحدات OIU"), view: "economics", state: states.oiu },
    { id: "admission", label: tr("Policy / admission", "السياسة / القبول"), view: "admission", state: states.admission },
    { id: "rating", label: tr("Customer rating", "تسعير العميل"), view: "rating", state: states.rating }
  ];
  const stateLabel = (state: EvidenceAvailability) => ({
    AVAILABLE: tr("Available", "متاح"),
    PARTIAL: tr("Partial", "جزئي"),
    UNKNOWN: tr("Unknown", "غير معروف"),
    NOT_CONFIGURED: tr("Not configured", "غير مهيأ")
  })[state];
  return <nav className="economic-flow-strip" aria-label={tr("Economics evidence flow", "تدفق أدلة الاقتصاد") } dir={ar ? "rtl" : "ltr"}>
    <span className="eyebrow">{tr("ECONOMICS CONTROL PLANE", "لوحة التحكم الاقتصادية")}</span>
    <ol>{nodes.map((node, index) => <li key={node.id} className={current === node.id ? "is-current" : undefined}>
      <ActionButton variant={current === node.id ? "secondary" : "quiet"} onPress={() => navigate(node.view)} aria-current={current === node.id ? "page" : undefined}>
        <span>{node.label}</span><small className={`economic-flow-state is-${node.state.toLowerCase()}`}>{stateLabel(node.state)}</small>
      </ActionButton>{index < nodes.length - 1 && <span className="economic-flow-arrow" aria-hidden="true">→</span>}
    </li>)}</ol>
  </nav>;
}
