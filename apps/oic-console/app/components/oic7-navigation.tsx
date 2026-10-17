"use client";

import type { Locale, View } from "../i18n";

const destinations: ReadonlyArray<{ view: View; en: string; ar: string }> = [
  { view: "evaluation", en: "Evaluation", ar: "التقييم" },
  { view: "economics", en: "Economics", ar: "الاقتصاديات" },
  { view: "admission", en: "Admission & budget", ar: "القبول والميزانية" }
];

export function Oic7Navigation({ locale, view, onNavigate }: {
  locale: Locale;
  view: View;
  onNavigate: (destination: View) => void;
}) {
  return <div className="nav-group oic7-navigation" data-navigation-group="oic7" aria-label="OIC-7 workspaces">
    <p>OIC-7</p>
    {destinations.map((destination) => <button
      key={destination.view}
      type="button"
      className={`nav-item ${view === destination.view ? "selected" : ""}`}
      aria-current={view === destination.view ? "page" : undefined}
      onClick={() => onNavigate(destination.view)}
    >
      <span className="nav-item-label">{locale === "ar" ? destination.ar : destination.en}</span>
      {view === destination.view && <span className="nav-arrow" aria-hidden="true">↗</span>}
    </button>)}
  </div>;
}
