export type InterfaceDensity = "compact" | "standard" | "precision" | "large";
export type InterfaceSize = "compact" | "standard" | "large";
export type InterfaceDirection = "ltr" | "rtl";
export type InterfaceLocale = "en" | "ar";
export type MotionPreference = "system" | "reduced" | "full";
export type SemanticTone = "neutral" | "good" | "warning" | "critical" | "amber";

export type PermissionState =
  | { kind: "allowed" }
  | { kind: "read-only"; reason: string }
  | { kind: "denied"; reason: string }
  | { kind: "unsupported"; reason: string }
  | { kind: "unavailable"; reason: string };

export type SourceState =
  | { kind: "persisted"; revision?: string }
  | { kind: "draft" }
  | { kind: "local-preview" }
  | { kind: "unmeasured"; reason: string }
  | { kind: "stale"; observedAt?: string }
  | { kind: "unknown"; reason: string };

export type ValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  field?: string;
};

export type DomainBounds = {
  min: number;
  max: number;
  step: number;
  unit?: string;
  polarity?: "high-is-good" | "high-is-bad" | "target-range" | "neutral";
};

export type ControlMarker = {
  value: number;
  label: string;
  kind: "persisted" | "default" | "target" | "recommended" | "warning" | "critical";
};

export const isActionAllowed = (permission: PermissionState): boolean => permission.kind === "allowed";
