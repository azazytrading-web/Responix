import type { ReactNode } from "react";

export type OiuValueVariant = "CARD" | "INLINE" | "TABLE" | "COMPACT" | "MUTED";

export function OiuValue({ value, locale = "en", label, className = "", variant = "INLINE" }: {
  value: string | number | null | undefined;
  locale?: "en" | "ar";
  label?: string;
  className?: string;
  variant?: OiuValueVariant;
}) {
  const unknown = value === null || value === undefined;
  const raw = unknown ? null : String(value);
  const formatted = raw === null
    ? (locale === "ar" ? "غير معروف" : "Unknown")
    : raw.replace(/\B(?=(\d{3})+(?!\d))/g, locale === "ar" ? "٬" : ",");
  return <span className={`oiu-value oiu-value-${variant.toLowerCase()} ${unknown ? "is-unknown" : ""} ${className}`.trim()} aria-label={label ? `${label}: ${formatted} OIU` : `${formatted} OIU`}>
    <span className="oiu-value-mark" aria-hidden="true"><span>◈</span> OIU</span>
    <bdi className="oiu-value-number" dir="ltr">{formatted}</bdi>
  </span>;
}

export function OiuValueGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`oiu-value-group ${className}`.trim()}>{children}</span>;
}
