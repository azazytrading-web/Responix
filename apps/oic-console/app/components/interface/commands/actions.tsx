"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components/Button";
import { Menu, MenuItem, MenuTrigger, Popover as MenuPopover } from "react-aria-components/Menu";
import { transitionCommand } from "../state/command-machine";
import type { CommandStatus } from "../state/command-machine";
import type { InterfaceSize, PermissionState, SemanticTone } from "../foundation/types";

export type ActionVariant = "primary" | "secondary" | "quiet" | "ghost" | "inline" | "icon" | "danger" | "warning" | "success";
export type ActionButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ActionVariant;
  size?: InterfaceSize;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  permission?: PermissionState;
  className?: string;
  label?: string;
  type?: "button" | "submit";
};

export function ActionButton({ children, onPress, variant = "secondary", size = "standard", icon, loading = false, disabled = false, permission = { kind: "allowed" }, className = "", label, type = "button" }: ActionButtonProps) {
  const permissionId = useId();
  const permissionBlocks = permission.kind !== "allowed";
  const content = <><span className="oi-action-icon" aria-hidden="true">{loading ? <i className="oi-spinner" /> : icon}</span><span className="oi-action-label">{children}</span></>;
  return <AriaButton type={type} className={`oi-action is-${variant} oi-size-${size} ${loading ? "is-loading" : ""} ${className}`.trim()} onPress={onPress} isDisabled={disabled || loading || permissionBlocks} aria-label={label} aria-describedby={permissionBlocks ? permissionId : undefined} aria-busy={loading || undefined}>
    {content}
    {permissionBlocks && <span className="oi-visually-hidden" id={permissionId}>{permission.reason}</span>}
  </AriaButton>;
}

export const PrimaryAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="primary" />;
export const SecondaryAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="secondary" />;
export const QuietAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="quiet" />;
export const GhostAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="ghost" />;
export const InlineAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="inline" />;
export const IconAction = (props: Omit<ActionButtonProps, "variant"> & { label: string }) => <ActionButton {...props} variant="icon" />;
export const DangerAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="danger" />;
export const WarningAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="warning" />;
export const SuccessAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="success" />;
export const RetryAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="secondary" />;
export const CancelAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="quiet" />;
export const ApplyAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="primary" />;
export const SaveDraftAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="secondary" />;
export const ResetAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="quiet" />;
export const RevertDraftAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="quiet" />;
export const InspectAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="inline" />;
export const OpenWorkspaceAction = (props: Omit<ActionButtonProps, "variant">) => <ActionButton {...props} variant="inline" />;

export function ActionMenu({ label, items, onAction }: { label: string; items: readonly { id: string; label: string; disabled?: boolean; tone?: SemanticTone }[]; onAction: (id: string) => void }) {
  return <MenuTrigger><AriaButton className="oi-action is-quiet oi-size-standard"><span>{label}</span><span aria-hidden="true">⌄</span></AriaButton><MenuPopover className="oi-menu-popover"><Menu className="oi-menu" aria-label={label} onAction={(key) => onAction(String(key))}>{items.map((item) => <MenuItem key={item.id} id={item.id} isDisabled={item.disabled} className={`oi-menu-item ${item.tone ? `is-${item.tone}` : ""}`} textValue={item.label}>{item.label}</MenuItem>)}</Menu></MenuPopover></MenuTrigger>;
}

export function SplitAction({ label, onPress, menuLabel, items, onAction }: { label: string; onPress: () => void; menuLabel: string; items: readonly { id: string; label: string; disabled?: boolean; tone?: SemanticTone }[]; onAction: (id: string) => void }) {
  return <div className="oi-split-action"><PrimaryAction onPress={onPress}>{label}</PrimaryAction><ActionMenu label={menuLabel} items={items} onAction={onAction} /></div>;
}

export function CommandBar({ title, children }: { title: string; children: React.ReactNode }) { return <div className="oi-command-bar" role="toolbar" aria-label={title}><strong>{title}</strong><div>{children}</div></div>; }
export function ActionCluster({ label, children }: { label: string; children: React.ReactNode }) { return <div className="oi-action-cluster" role="group" aria-label={label}>{children}</div>; }
export function StickyActionBar({ children, label = "Pending changes" }: { children: React.ReactNode; label?: string }) { return <div className="oi-sticky-action-bar" role="region" aria-label={label}>{children}</div>; }
export const StickyControlBar = StickyActionBar;
export function BatchActionBar({ count, label, selectedLabel, children }: { count: number; label: string; selectedLabel: string; children: React.ReactNode }) { return <div className="oi-batch-action-bar" role="toolbar" aria-label={label}><span>{count} {selectedLabel}</span>{children}</div>; }

export function HoldToConfirm({ label, holdLabel, completedLabel, instruction, durationMs = 700, onConfirm }: { label: string; holdLabel: string; completedLabel: string; instruction: string; durationMs?: number; onConfirm: () => void }) {
  const helpId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const [complete, setComplete] = useState(false);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const start = () => { if (complete || timer.current) return; setHolding(true); timer.current = setTimeout(() => { timer.current = null; setHolding(false); setComplete(true); onConfirm(); }, durationMs); };
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setHolding(false); };
  return <button type="button" className={`oi-action is-danger oi-hold-action ${holding ? "is-holding" : ""}`} style={{ "--oi-hold-duration": `${durationMs}ms` } as React.CSSProperties} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onBlur={stop} onKeyDown={(event) => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); start(); } }} onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") stop(); }} aria-describedby={helpId} aria-live="polite"><span>{complete ? completedLabel : holding ? holdLabel : label}</span><span className="oi-visually-hidden" id={helpId}>{instruction}</span></button>;
}

export function ArmThenExecute({ title, target, consequence, labels, onExecute }: { title: string; target: string; consequence: string; labels: { arm: string; execute: string; cancel: string; status: Record<CommandStatus, string> }; onExecute: () => Promise<Exclude<CommandStatus, "IDLE" | "READY" | "ARMED" | "EXECUTING">> }) {
  const [status, setStatus] = useState<CommandStatus>("READY");
  const execute = async () => {
    if (status !== "ARMED") return;
    setStatus(transitionCommand(status, "EXECUTE"));
    try {
      const result = await onExecute();
      const event = result === "SUCCEEDED" ? "SUCCEED" : result === "FAILED" ? "FAIL" : result === "PARTIAL" ? "PARTIAL" : result === "CANCELLED" ? "CANCEL" : result === "BLOCKED" ? "BLOCK" : result === "DENIED" ? "DENY" : result === "CONFLICT" ? "CONFLICT" : "AMBIGUOUS";
      setStatus((current) => transitionCommand(current, event));
    } catch { setStatus("UNKNOWN_RESULT"); }
  };
  return <section className="oi-arm-pattern"><div><small>{title}</small><h4>{target}</h4><p>{consequence}</p></div><span className={`oi-state-tag is-${status.toLowerCase()}`}>{labels.status[status]}</span><div>{status === "READY" && <WarningAction onPress={() => setStatus(transitionCommand(status, "ARM"))}>{labels.arm}</WarningAction>}{status === "ARMED" && <><DangerAction onPress={() => { void execute(); }}>{labels.execute}</DangerAction><QuietAction onPress={() => setStatus(transitionCommand(status, "DISARM"))}>{labels.cancel}</QuietAction></>}{status !== "READY" && status !== "ARMED" && status !== "EXECUTING" && <QuietAction onPress={() => setStatus(transitionCommand(status, "RESET"))}>{labels.arm}</QuietAction>}</div></section>;
}

export function CommandStateCard({ state, labels }: { state: CommandStatus; labels: Record<CommandStatus, string> }) { return <span className={`oi-command-state is-${state.toLowerCase()}`} role="status"><i aria-hidden="true" />{labels[state]}</span>; }
