import type { InterfaceLocale } from "./types";

export type NumberFormat = {
  locale?: InterfaceLocale;
  unit?: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  style?: "decimal" | "percent";
};

export function formatNumber(value: number, options: NumberFormat = {}): string {
  if (!Number.isFinite(value)) return "—";
  const locale = options.locale === "ar" ? "ar-EG" : "en-US";
  const formatted = new Intl.NumberFormat(locale, {
    style: options.style ?? "decimal",
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    minimumFractionDigits: options.minimumFractionDigits ?? 0
  }).format(value);
  return options.unit ? `${formatted}\u00a0${options.unit}` : formatted;
}

export function clampValue(value: number, min: number, max: number, step = 1): number {
  if (![value, min, max, step].every(Number.isFinite) || max < min || step <= 0) return min;
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = min + Math.round((clamped - min) / step) * step;
  const precision = Math.min(8, Math.max(decimalPlaces(min), decimalPlaces(step)));
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(precision));
}

function decimalPlaces(value: number): number {
  const text = value.toString().toLowerCase();
  const [mantissa = "", exponentText] = text.split("e");
  const fraction = mantissa.split(".")[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponentText ?? 0));
}
