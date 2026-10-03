"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  RefObject,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

export type ControlSize = "compact" | "regular";

export function Button({
  children,
  variant = "secondary",
  size = "regular",
  type = "button",
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: ControlSize;
  loading?: boolean;
}) {
  return <button {...props} type={type} className={`oic-button is-${variant} is-${size} ${className}`.trim()} disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading && <span className="oic-spinner" aria-hidden="true" />}{children}
  </button>;
}

export function IconButton({ label, type = "button", className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button {...props} type={type} className={`oic-icon-button ${className}`.trim()} aria-label={label} title={props.title ?? label}>{children}</button>;
}

export function TextInput({ label, hint, className = "", id, visuallyHidden = false, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; visuallyHidden?: boolean }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return <label className="oic-field" htmlFor={inputId}>{label && <span className={visuallyHidden ? "oic-visually-hidden" : ""}>{label}</span>}<input {...props} id={inputId} aria-describedby={[props["aria-describedby"], hint ? `${inputId}-hint` : undefined].filter(Boolean).join(" ") || undefined} className={`oic-input ${className}`.trim()} />{hint && <small id={`${inputId}-hint`}>{hint}</small>}</label>;
}

export function SearchInput({ label, visuallyHidden = false, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; visuallyHidden?: boolean }) {
  return <TextInput {...props} label={label} visuallyHidden={visuallyHidden} type="search" className={`oic-search-input ${props.className ?? ""}`} />;
}

export function TextArea({ label, hint, className = "", id, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return <label className="oic-field" htmlFor={inputId}>{label && <span>{label}</span>}<textarea {...props} id={inputId} aria-describedby={[props["aria-describedby"], hint ? `${inputId}-hint` : undefined].filter(Boolean).join(" ") || undefined} className={`oic-input oic-textarea ${className}`.trim()} />{hint && <small id={`${inputId}-hint`}>{hint}</small>}</label>;
}

export function Select({ label, children, className = "", id, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return <label className="oic-field" htmlFor={inputId}>{label && <span>{label}</span>}<select {...props} id={inputId} className={`oic-input oic-select ${className}`.trim()}>{children}</select></label>;
}

export type EntityOption = { id: string; label: string; metadata?: string; status?: string; statusLabel?: string };
export function SearchableSelect({ options, value, onChange, label, placeholder, emptyLabel, disabled = false, dir = "ltr", name }: {
  options: EntityOption[]; value: string; onChange: (value: string) => void; label: string; placeholder: string; emptyLabel: string; disabled?: boolean; dir?: "ltr" | "rtl"; name?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.id === value);
  const filtered = options.filter((option) => `${option.label} ${option.metadata ?? ""} ${option.statusLabel ?? option.status ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", closeOutside);
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  const choose = (option: EntityOption) => { onChange(option.id); setQuery(""); setOpen(false); triggerRef.current?.focus(); };
  return <div className="oic-field oic-picker" ref={rootRef} dir={dir}>
    {name && <input type="hidden" name={name} value={selected ? value : ""} disabled={disabled} />}
    <span id={`${id}-label`}>{label}</span>
    <button ref={triggerRef} type="button" className="oic-picker-trigger" aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-label`} aria-controls={`${id}-options`} disabled={disabled} onClick={() => { setOpen((current) => !current); setQuery(""); setActive(0); }}>
      <span className="oic-picker-value">{selected ? <><b>{selected.label}</b>{selected.metadata && <small>{selected.metadata}</small>}</> : <span className="oic-placeholder">{placeholder}</span>}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="oic-picker-popover">
      <SearchInput className="oic-picker-search" visuallyHidden label={label} autoFocus role="combobox" aria-expanded="true" aria-controls={`${id}-options`} aria-activedescendant={filtered[active] ? `${id}-option-${active}` : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, Math.max(0, filtered.length - 1))); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); }
        if (event.key === "Enter" && filtered[active]) { event.preventDefault(); choose(filtered[active]); }
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
        if (event.key === "Tab") setOpen(false);
      }} />
      <div className="oic-picker-options" role="listbox" id={`${id}-options`}>
        {filtered.length ? filtered.map((option, index) => <button type="button" role="option" aria-selected={option.id === value} id={`${id}-option-${index}`} key={option.id} className={`oic-picker-option ${index === active ? "is-active" : ""}`} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>
          <span><b>{option.label}</b>{option.metadata && <small>{option.metadata}</small>}</span>{option.status && <span className={`oic-status is-${option.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{option.statusLabel ?? option.status}</span>}
        </button>) : <p className="oic-picker-empty">{emptyLabel}</p>}
      </div>
    </div>}
  </div>;
}

export const EntityPicker = SearchableSelect;

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="oic-check"><input {...props} type="checkbox" /><span>{label}</span></label>;
}

export function Toggle({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="oic-toggle"><input {...props} type="checkbox" role="switch" /><span className="oic-toggle-track" aria-hidden="true" /><span>{label}</span></label>;
}

export function RadioGroup({ label, name, value, onChange, options, disabled = false }: {
  label: string; name: string; value: string; onChange: (value: string) => void; options: { value: string; label: string; disabled?: boolean }[]; disabled?: boolean;
}) {
  return <fieldset className="oic-radio-group"><legend>{label}</legend>{options.map((option) => <label key={option.value}><input type="radio" name={name} value={option.value} checked={value === option.value} disabled={disabled || option.disabled} onChange={() => onChange(option.value)} /><span>{option.label}</span></label>)}</fieldset>;
}

export function SegmentedControl({ label, value, onChange, options, dir = "ltr" }: {
  label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string; disabled?: boolean }[]; dir?: "ltr" | "rtl";
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  return <div className="oic-segmented" role="radiogroup" aria-label={label} dir={dir}>{options.map((option, index) => <button key={option.value} ref={(node) => { refs.current[index] = node; }} type="button" role="radio" aria-checked={value === option.value} disabled={option.disabled} tabIndex={value === option.value ? 0 : -1} className={value === option.value ? "is-selected" : ""} onClick={() => onChange(option.value)} onKeyDown={(event) => {
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backward = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    if (event.key !== forward && event.key !== backward) return;
    event.preventDefault();
    const delta = event.key === forward ? 1 : -1;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const next = (selectedIndex + delta * offset + options.length * 2) % options.length;
      const nextOption = options[next];
      if (nextOption && !nextOption.disabled) { onChange(nextOption.value); refs.current[next]?.focus(); break; }
    }
  }}>{option.label}</button>)}</div>;
}

export function Slider({ label, value, defaultValue, onChange, min = 0, max = 100, step = 1, disabled = false, unavailable = false, unavailableLabel, markers = [], compact = false, dir = "ltr", inputProps }: {
  label: string; value?: number | null; defaultValue?: number; onChange?: (value: number) => void; min?: number; max?: number; step?: number; disabled?: boolean; unavailable?: boolean; unavailableLabel: string; markers?: { value: number; label: string }[]; compact?: boolean; dir?: "ltr" | "rtl"; inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "min" | "max" | "step" | "value" | "defaultValue" | "onChange"> & Record<`data-${string}`, string | undefined>;
}) {
  const id = useId();
  const [internalValue, setInternalValue] = useState(defaultValue ?? min);
  const currentValue = value === undefined ? internalValue : value;
  const isUnavailable = unavailable || currentValue === null;
  const markerPosition = (markerValue: number) => max === min ? 0 : Math.max(0, Math.min(100, ((markerValue - min) / (max - min)) * 100));
  return <div className={`oic-slider ${compact ? "is-compact" : ""} ${isUnavailable ? "is-unavailable" : ""}`} dir={dir}>
    <div className="oic-slider-head"><label htmlFor={id}>{label}</label><output htmlFor={id}>{isUnavailable ? unavailableLabel : currentValue}</output></div>
    <input {...inputProps} id={id} type="range" min={min} max={max} step={step} value={currentValue ?? min} disabled={disabled || isUnavailable} aria-valuetext={isUnavailable ? unavailableLabel : String(currentValue)} onChange={(event) => { const next = Number(event.target.value); if (value === undefined) setInternalValue(next); onChange?.(next); }} />
    {markers.length > 0 && <div className="oic-slider-markers">{markers.map((marker) => <span key={`${marker.value}-${marker.label}`} style={{ insetInlineStart: `${markerPosition(marker.value)}%` }}>{marker.label}</span>)}</div>}
    <div className="oic-slider-limits"><span>{min}</span><span>{max}</span></div>
  </div>;
}

export function RangeSlider({ label, value, onChange, min = 0, max = 100, step = 1, disabled = false, unavailable = false, unavailableLabel, markers = [], compact = false, dir = "ltr", labels }: {
  label: string; value: [number, number] | null; onChange: (value: [number, number]) => void; min?: number; max?: number; step?: number; disabled?: boolean; unavailable?: boolean; unavailableLabel: string; markers?: { value: number; label: string }[]; compact?: boolean; dir?: "ltr" | "rtl"; labels: { minimum: string; maximum: string; selectedRange: string };
}) {
  const id = useId();
  const unavailableState = unavailable || value === null;
  const range: [number, number] = value ?? [min, max];
  const markerPosition = (markerValue: number) => max === min ? 0 : Math.max(0, Math.min(100, ((markerValue - min) / (max - min)) * 100));
  const setLower = (lower: number) => onChange([Math.min(lower, range[1]), range[1]]);
  const setUpper = (upper: number) => onChange([range[0], Math.max(upper, range[0])]);
  return <div className={`oic-slider oic-range-slider ${compact ? "is-compact" : ""} ${unavailableState ? "is-unavailable" : ""}`} dir={dir}>
    <div className="oic-slider-head"><span>{label}</span><output>{unavailableState ? unavailableLabel : `${range[0]} – ${range[1]}`}</output></div>
    <div className="oic-range-inputs"><input aria-label={`${label} · ${labels.minimum}`} aria-describedby={`${id}-range-description`} aria-valuetext={unavailableState ? unavailableLabel : `${labels.minimum}: ${range[0]}`} type="range" min={min} max={max} step={step} value={range[0]} disabled={disabled || unavailableState} onChange={(event) => setLower(Number(event.target.value))} /><input aria-label={`${label} · ${labels.maximum}`} aria-describedby={`${id}-range-description`} aria-valuetext={unavailableState ? unavailableLabel : `${labels.maximum}: ${range[1]}`} type="range" min={min} max={max} step={step} value={range[1]} disabled={disabled || unavailableState} onChange={(event) => setUpper(Number(event.target.value))} /></div>
    {markers.length > 0 && <div className="oic-slider-markers">{markers.map((marker) => <span key={`${marker.value}-${marker.label}`} style={{ insetInlineStart: `${markerPosition(marker.value)}%` }}>{marker.label}</span>)}</div>}
    <div className="oic-slider-limits"><span>{min}</span><span>{max}</span></div>
    <span id={`${id}-range-description`} className="oic-visually-hidden">{labels.selectedRange}: {unavailableState ? unavailableLabel : `${range[0]}–${range[1]}`}</span>
  </div>;
}

export function StatusPill({ children, status = "neutral" }: { children: ReactNode; status?: "healthy" | "ready" | "success" | "connected" | "warning" | "degraded" | "critical" | "offline" | "neutral" }) {
  return <span className={`oic-status is-${status}`}>{children}</span>;
}
export const Badge = StatusPill;
export function Chip({ children, onRemove, label }: { children: ReactNode; onRemove?: () => void; label: string }) {
  return <span className="oic-chip">{children}{onRemove && <button type="button" aria-label={label ?? "Remove"} onClick={onRemove}>×</button>}</span>;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return <span className="oic-tooltip" tabIndex={0} aria-describedby={id} data-tooltip={label}>{children}<span className="oic-visually-hidden" id={id} role="tooltip">{label}</span></span>;
}

export function Popover({ trigger, children, align = "start" }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end" }) {
  return <details className={`oic-popover align-${align}`}><summary>{trigger}</summary><div className="oic-popover-content">{children}</div></details>;
}

export function DropdownMenu({ label, items }: { label: string; items: { label: string; onSelect: () => void; disabled?: boolean; destructive?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const focusItem = (index: number) => rootRef.current?.querySelectorAll<HTMLButtonElement>(".oic-menu-item:not(:disabled)")[index]?.focus();
  return <div className="oic-menu" ref={rootRef}>
    <Button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); requestAnimationFrame(() => focusItem(0)); } }}>{label}<span aria-hidden="true">⌄</span></Button>
    {open && <div className="oic-menu-list" role="menu" onKeyDown={(event) => {
      const count = rootRef.current?.querySelectorAll<HTMLButtonElement>(".oic-menu-item:not(:disabled)").length ?? 0;
      const current = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>(".oic-menu-item:not(:disabled)") ?? []).indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Escape") { setOpen(false); rootRef.current?.querySelector("button")?.focus(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); focusItem((current + (event.key === "ArrowDown" ? 1 : count - 1)) % count); }
    }}>{items.map((item) => <button key={item.label} type="button" role="menuitem" disabled={item.disabled} className={`oic-menu-item ${item.destructive ? "is-danger" : ""}`} onClick={() => { item.onSelect(); setOpen(false); }}>{item.label}</button>)}</div>}
  </div>;
}

export function ContextMenu({ label, children }: { label: string; children: ReactNode }) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openAt = (x: number, y: number) => {
    setPoint({ x: Math.max(8, Math.min(x, window.innerWidth - 210)), y: Math.max(8, Math.min(y, window.innerHeight - 240)) });
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"],button:not(:disabled)')?.focus());
  };
  useEffect(() => {
    if (!point) return;
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setPoint(null); };
    const navigate = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setPoint(null); anchorRef.current?.focus(); return; }
      if (!menuRef.current || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled),button:not(:disabled)'));
      if (!items.length) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
      items[next]?.focus();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", navigate);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", navigate); };
  }, [point]);
  return <div ref={anchorRef} className="oic-context-anchor" role="group" aria-label={label} tabIndex={0} onKeyDown={(event) => {
    if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); openAt(rect.left, rect.bottom); }
  }} onContextMenu={(event) => { event.preventDefault(); openAt(event.clientX, event.clientY); }}>
    {label}{point && <div className="oic-menu-list oic-context-menu" ref={menuRef} style={{ left: point.x, top: point.y }} role="menu">{children}</div>}
  </div>;
}

function useDialogFocus(open: boolean, onClose: () => void, ref: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const focusable = () => Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])') ?? []);
    requestAnimationFrame(() => (focusable()[0] ?? root)?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key === "Tab") {
        const items = focusable();
        if (!items.length) { event.preventDefault(); root?.focus(); return; }
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [open, ref]);
}

export function Dialog({ open, onClose, title, description, children, actions, closeLabel, dir = "ltr" }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; actions?: ReactNode; closeLabel: string; dir?: "ltr" | "rtl";
}) {
  const id = useId();
  const panelRef = useRef<HTMLElement>(null);
  useDialogFocus(open, onClose, panelRef);
  if (!open) return null;
  return <div className="oic-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="oic-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} dir={dir} tabIndex={-1} ref={panelRef}>
      <header><div><h2 id={`${id}-title`}>{title}</h2>{description && <p id={`${id}-description`}>{description}</p>}</div><IconButton label={closeLabel} type="button" onClick={onClose}>×</IconButton></header>
      <div className="oic-dialog-body">{children}</div>{actions && <footer>{actions}</footer>}
    </section>
  </div>;
}

export function ConfirmationDialog({ open, onClose, onConfirm, title, description, confirmLabel, cancelLabel, closeLabel, failureLabel, destructive = false }: {
  open: boolean; onClose: () => void; onConfirm: () => void | Promise<void>; title: string; description: string; confirmLabel: string; cancelLabel: string; closeLabel: string; failureLabel: string; destructive?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirm = async () => {
    setBusy(true); setFailed(false);
    try { await onConfirm(); onClose(); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onClose={onClose} title={title} description={description} closeLabel={closeLabel} actions={<><Button type="button" onClick={onClose}>{cancelLabel}</Button><Button type="button" variant={destructive ? "danger" : "primary"} loading={busy} onClick={() => { void confirm(); }}>{confirmLabel}</Button></>}><p>{description}</p>{failed && <p className="oic-validation-error" role="alert">{failureLabel}</p>}</Dialog>;
}

export function DestructiveAction({ label, title, description, confirmLabel, cancelLabel, closeLabel, failureLabel, onConfirm }: {
  label: string; title: string; description: string; confirmLabel: string; cancelLabel: string; closeLabel: string; failureLabel: string; onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return <><Button variant="danger" type="button" onClick={() => setOpen(true)}>{label}</Button><ConfirmationDialog open={open} onClose={() => setOpen(false)} onConfirm={onConfirm} title={title} description={description} confirmLabel={confirmLabel} cancelLabel={cancelLabel} closeLabel={closeLabel} failureLabel={failureLabel} destructive /></>;
}

export function Drawer({ open, onClose, title, description, children, actions, closeLabel, dir = "ltr" }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; actions?: ReactNode; closeLabel: string; dir?: "ltr" | "rtl";
}) {
  const id = useId();
  const panelRef = useRef<HTMLElement>(null);
  useDialogFocus(open, onClose, panelRef);
  if (!open) return null;
  return <div className="oic-overlay oic-drawer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="oic-drawer" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} dir={dir} tabIndex={-1} ref={panelRef}>
      <header><div><h2 id={`${id}-title`}>{title}</h2>{description && <p id={`${id}-description`}>{description}</p>}</div><IconButton label={closeLabel} type="button" onClick={onClose}>×</IconButton></header>
      <div className="oic-drawer-body">{children}</div>{actions && <footer>{actions}</footer>}
    </section>
  </div>;
}

export function InspectorPanel({ open, onClose, title, overview, metadata, relationships, lifecycle, actions, labels, dir }: {
  open: boolean; onClose: () => void; title: string; overview?: ReactNode; metadata?: { label: string; value: ReactNode }[]; relationships?: ReactNode; lifecycle?: ReactNode; actions?: ReactNode; labels: { overview: string; technicalDetails: string; relationships: string; lifecycle: string; close: string }; dir?: "ltr" | "rtl";
}) {
  return <Drawer open={open} onClose={onClose} title={title} closeLabel={labels.close} dir={dir}><div className="oic-inspector-content">{overview && <section><h3>{labels.overview}</h3>{overview}</section>}{metadata && <section><h3>{labels.technicalDetails}</h3><dl>{metadata.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></section>}{relationships && <section><h3>{labels.relationships}</h3>{relationships}</section>}{lifecycle && <section><h3>{labels.lifecycle}</h3>{lifecycle}</section>}{actions && <section className="oic-inspector-actions">{actions}</section>}</div></Drawer>;
}

export function Tabs({ label, tabs, active, onChange, dir = "ltr" }: { label: string; tabs: { id: string; label: string; disabled?: boolean }[]; active: string; onChange: (id: string) => void; dir?: "ltr" | "rtl" }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  return <div className="oic-tabs" role="tablist" aria-label={label} dir={dir}>{tabs.map((tab, index) => <button ref={(node) => { refs.current[index] = node; }} type="button" role="tab" key={tab.id} id={`tab-${tab.id}`} aria-controls={`panel-${tab.id}`} aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1} disabled={tab.disabled} onClick={() => onChange(tab.id)} onKeyDown={(event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault(); const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight"; const delta = event.key === forward ? 1 : -1;
    for (let offset = 1; offset <= tabs.length; offset += 1) {
      const next = (index + delta * offset + tabs.length * 2) % tabs.length;
      if (!tabs[next]?.disabled) { onChange(tabs[next].id); refs.current[next]?.focus(); break; }
    }
  }}>{tab.label}</button>)}</div>;
}

export function Stepper({ steps, current, completed = [], label }: { steps: { id: string; label: string }[]; current: number; completed?: number[]; label: string }) {
  return <ol className="oic-stepper" aria-label={label}>{steps.map((step, index) => <li key={step.id} className={`${index === current ? "is-current" : ""} ${completed.includes(index) ? "is-complete" : ""}`} aria-current={index === current ? "step" : undefined}><span>{completed.includes(index) ? "✓" : index + 1}</span><b>{step.label}</b></li>)}</ol>;
}

export type WizardStep = { id: string; label: string; content: ReactNode; validate?: () => boolean | Promise<boolean> };
export function WizardFrame({ steps, onCancel, onComplete, nextLabel, backLabel, cancelLabel, reviewLabel, completeLabel, progressLabel, validationMessage, dir = "ltr" }: {
  steps: WizardStep[]; onCancel: () => void; onComplete: () => void | Promise<void>; nextLabel: string; backLabel: string; cancelLabel: string; reviewLabel: string; completeLabel: string; progressLabel: string; validationMessage: string; dir?: "ltr" | "rtl";
}) {
  const [current, setCurrent] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const step = steps[current];
  const last = current === steps.length - 1;
  const advance = async () => {
    if (!step) return;
    setBusy(true);
    try {
      const valid = await step.validate?.() ?? true;
      if (!valid) { setInvalid(true); return; }
      setInvalid(false); setCompleted((list) => list.includes(current) ? list : [...list, current]);
      if (last) await onComplete(); else setCurrent((index) => index + 1);
    } catch { setInvalid(true); }
    finally { setBusy(false); }
  };
  if (!step) return null;
  return <section className="oic-wizard" dir={dir}><Stepper steps={steps} current={current} completed={completed} label={progressLabel} /><div className="oic-wizard-step" aria-live="polite">{step.content}{invalid && <p className="oic-validation-error" role="alert">{validationMessage}</p>}</div><footer><Button type="button" variant="quiet" onClick={onCancel}>{cancelLabel}</Button><span />{current > 0 && <Button type="button" onClick={() => { setInvalid(false); setCurrent((index) => index - 1); }}>{backLabel}</Button>}<Button type="button" variant="primary" loading={busy} onClick={() => { void advance(); }}>{last ? completeLabel : current === steps.length - 2 ? reviewLabel : nextLabel}</Button></footer></section>;
}

export function DataTable({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={`oic-data-table ${className}`.trim()} role="region" aria-label={label} tabIndex={0}>{children}</div>;
}

export function EmptyState({ title, description, action, technicalReason }: { title: string; description: string; action?: ReactNode; technicalReason?: string }) {
  return <section className="oic-state-card"><span className="oic-state-mark" aria-hidden="true">∅</span><h3>{title}</h3><p>{description}</p>{technicalReason && <small>{technicalReason}</small>}{action && <div>{action}</div>}</section>;
}
export function LoadingState({ label }: { label: string }) { return <div className="oic-loading-state" role="status"><span className="oic-spinner" aria-hidden="true" />{label}</div>; }
export function ErrorState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <section className="oic-state-card is-error" role="alert"><span className="oic-state-mark" aria-hidden="true">!</span><h3>{title}</h3><p>{description}</p>{action && <div>{action}</div>}</section>; }
export function UnavailableState({ title, explanation, reason }: { title: string; explanation: string; reason?: string }) { return <section className="oic-state-card is-unavailable" role="status"><h3>{title}</h3><p>{explanation}</p>{reason && <small>{reason}</small>}</section>; }

export function FaultState({ title, description, code, correlationId, action }: { title: string; description: string; code?: string; correlationId?: string; action?: ReactNode }) {
  return <section className="oic-state-card is-error is-fault" role="alert"><span className="oic-state-mark" aria-hidden="true">!</span><h3>{title}</h3><p>{description}</p>{(code || correlationId) && <small>{[code, correlationId].filter(Boolean).join(" · ")}</small>}{action && <div>{action}</div>}</section>;
}

export function ActionFeedback({ result, affectedState, nextAction }: { result: string; affectedState?: string; nextAction?: ReactNode }) {
  return <section className="oic-action-feedback" role="status" aria-live="polite"><span className="oic-feedback-mark" aria-hidden="true">✓</span><div><b>{result}</b>{affectedState && <p>{affectedState}</p>}{nextAction && <div>{nextAction}</div>}</div></section>;
}

export function Toast({ open, onClose, children, status = "success", closeLabel }: { open: boolean; onClose: () => void; children: ReactNode; status?: "success" | "warning" | "critical" | "neutral"; closeLabel: string }) {
  if (!open) return null;
  return <div className={`oic-toast is-${status}`} role={status === "critical" ? "alert" : "status"} aria-live={status === "critical" ? "assertive" : "polite"}><span>{children}</span><IconButton type="button" label={closeLabel} onClick={onClose}>×</IconButton></div>;
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) { return <div className="oic-key-value"><dt>{label}</dt><dd>{value}</dd></div>; }
export function TechnicalId({ value, label }: { value: string; label: string }) { return <code className="oic-technical-id" dir="ltr" title={label}>{value}</code>; }
export function CopyControl({ value, label, copiedLabel, copyLabel }: { value: string; label: string; copiedLabel: string; copyLabel: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* Clipboard access can be unavailable outside a secure context. */ } };
  return <Button type="button" size="compact" aria-label={label} onClick={() => { void copy(); }}>{copied ? copiedLabel : copyLabel}</Button>;
}

export function ContextualInsight({ kind, title, children, action, kindLabel }: { kind: "info" | "insight" | "warning" | "recommendation" | "relationship" | "actionable"; title: string; children: ReactNode; action?: ReactNode; kindLabel: string }) {
  return <aside className={`oic-insight is-${kind}`}><span className="oic-insight-type">{kindLabel}</span><div><b>{title}</b><p>{children}</p>{action && <div>{action}</div>}</div></aside>;
}
