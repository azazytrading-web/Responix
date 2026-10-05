"use client";

import { useMemo, useState } from "react";
import { OverviewView } from "../../features/overview/overview-view";
import type { Locale } from "../../i18n";
import { createShowcaseFixture } from "./demo-data";
import type { ShowcaseScenario } from "./demo-data";

const scenarios: ShowcaseScenario[] = ["NOMINAL", "DEGRADED", "CRITICAL", "MIXED", "DORMANT"];
const copy = {
  en: { title: "Flight Deck / development showcase", intro: "Isolated demo data rendered by the same Overview composition.", scenario: "Scenario", language: "Language", direction: "Direction", viewport: "Preview width", desktop: "Desktop", narrow: "Narrow", warning: "DEVELOPMENT REFERENCE · DEMO VALUES ONLY · NOT LIVE OIC TELEMETRY", footer: "Generated locally for visual evaluation. No demo values are sent to OIC services." },
  ar: { title: "لوحة القيادة / عرض التطوير", intro: "بيانات توضيحية معزولة تعرض باستخدام تكوين النظرة العامة نفسه.", scenario: "السيناريو", language: "اللغة", direction: "الاتجاه", viewport: "عرض المعاينة", desktop: "سطح المكتب", narrow: "ضيق", warning: "DEVELOPMENT REFERENCE · DEMO VALUES ONLY · NOT LIVE OIC TELEMETRY", footer: "تُنشأ القيم محلياً للتقييم المرئي. لا تُرسل أي قيم تجريبية إلى خدمات OIC." }
} as const;

const literal = (value: string, locale: Locale) => locale === "ar" && value === "Intelligence, under control." ? "ذكاء تحت السيطرة." : value;

export default function FlightDeckShowcase() {
  const [scenario, setScenario] = useState<ShowcaseScenario>("NOMINAL");
  const [locale, setLocale] = useState<Locale>("en");
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr");
  const [layout, setLayout] = useState<"desktop" | "narrow">("desktop");
  const labels = copy[locale];
  const fixture = useMemo(() => createShowcaseFixture(scenario), [scenario]);

  return <main className="fd-showcase-control" dir={direction} lang={locale}>
    <header className="fd-showcase-header"><div><small>OIC / DEVELOPMENT REFERENCE</small><h1>{labels.title}</h1><p>{labels.intro}</p></div><b>DEMO VALUES ONLY</b></header>
    <section className="fd-showcase-controls" aria-label={locale === "ar" ? "عناصر التحكم في العرض" : "Showcase controls"}>
      <label>{labels.scenario}<select value={scenario} onChange={(event) => setScenario(event.target.value as ShowcaseScenario)}>{scenarios.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <div><span>{labels.language}</span><button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button><button type="button" aria-pressed={locale === "ar"} onClick={() => setLocale("ar")}>AR / العربية</button></div>
      <div><span>{labels.direction}</span><button type="button" aria-pressed={direction === "ltr"} onClick={() => setDirection("ltr")}>LTR</button><button type="button" aria-pressed={direction === "rtl"} onClick={() => setDirection("rtl")}>RTL</button></div>
      <div><span>{labels.viewport}</span><button type="button" aria-pressed={layout === "desktop"} onClick={() => setLayout("desktop")}>{labels.desktop}</button><button type="button" aria-pressed={layout === "narrow"} onClick={() => setLayout("narrow")}>{labels.narrow}</button></div>
    </section>
    <p className="fd-showcase-warning">{labels.warning}</p>
    <div className={`fd-showcase-viewport ${layout}`} data-layout={layout}>
      <OverviewView view="overview" data={fixture.snapshot} health={fixture.health} executions={fixture.executions} locale={locale} literal={(value) => literal(value, locale)} navigate={() => undefined} loading={false} refresh={() => undefined} showcase={fixture.overview} />
    </div>
    <footer>{labels.footer}</footer>
  </main>;
}
