import type { ReactNode } from "react";

export function PageFrame({ breadcrumbs, breadcrumbLabel, context, title, description, meta, actions, workspaceNavigation, workspaceNavigationLabel, inspector, children, dir = "ltr", wide = false }: {
  breadcrumbs?: { label: string; href?: string; current?: boolean }[];
  breadcrumbLabel: string;
  context: string;
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
  workspaceNavigation?: ReactNode;
  workspaceNavigationLabel: string;
  inspector?: ReactNode;
  children: ReactNode;
  dir?: "ltr" | "rtl";
  wide?: boolean;
}) {
  return <section className={`oic-page-frame ${wide ? "oic-page-frame-wide" : ""}`} dir={dir}>
    {breadcrumbs && <nav className="oic-page-breadcrumbs" aria-label={breadcrumbLabel}>{breadcrumbs.map((item, index) => <span key={`${item.label}-${index}`}>{item.href && !item.current ? <a href={item.href}>{item.label}</a> : <span aria-current={item.current ? "page" : undefined}>{item.label}</span>}{index < breadcrumbs.length - 1 && <i aria-hidden="true">/</i>}</span>)}</nav>}
    <header className="oic-page-header">
      <div><span className="eyebrow">{context}</span><h1>{title}</h1><p>{description}</p></div>
      {meta && <div className="oic-page-meta">{meta}</div>}
      {actions && <div className="oic-page-actions">{actions}</div>}
    </header>
    {workspaceNavigation && <nav className="oic-workspace-nav" aria-label={workspaceNavigationLabel}>{workspaceNavigation}</nav>}
    <div className={inspector ? "oic-page-layout has-inspector" : "oic-page-layout"}>
      <div className="oic-page-content">{children}</div>
      {inspector && <aside className="oic-page-inspector">{inspector}</aside>}
    </div>
  </section>;
}

export function WorkspaceFrame({ title, description, navigation, selected, onSelect, navigationLabel, workspaceLabel, actions, listPane, children, inspector, dir = "ltr" }: {
  title: string;
  description?: string;
  navigation: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
  navigationLabel: string;
  workspaceLabel: string;
  actions?: ReactNode;
  listPane?: ReactNode;
  children: ReactNode;
  inspector?: ReactNode;
  dir?: "ltr" | "rtl";
}) {
  return <section className="oic-workspace-frame" dir={dir}>
    <header><div><span className="section-index">{workspaceLabel}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="oic-workspace-actions">{actions}</div>}</header>
    <nav className="oic-workspace-nav" aria-label={navigationLabel}>
      {navigation.map((item) => <button key={item.id} type="button" aria-current={selected === item.id ? "page" : undefined} className={selected === item.id ? "is-selected" : ""} onClick={() => onSelect(item.id)}>{item.label}</button>)}
    </nav>
    <div className={`oic-workspace-layout ${listPane ? "has-list" : ""} ${inspector ? "has-inspector" : ""}`}>
      {listPane && <aside className="oic-workspace-list">{listPane}</aside>}<div>{children}</div>{inspector && <aside className="oic-workspace-inspector">{inspector}</aside>}
    </div>
  </section>;
}

export function CompareSurface({ title, sides, children, compareLabel, dir = "ltr" }: {
  title: string;
  sides: [ReactNode, ReactNode];
  children: ReactNode;
  compareLabel: string;
  dir?: "ltr" | "rtl";
}) {
  return <section className="oic-compare" dir={dir}>
    <header><span className="section-index">{compareLabel}</span><h2>{title}</h2></header>
    <div className="oic-compare-columns"><div>{sides[0]}</div><span aria-hidden="true">↔</span><div>{sides[1]}</div></div>
    {children}
  </section>;
}

export const CompareFrame = CompareSurface;
