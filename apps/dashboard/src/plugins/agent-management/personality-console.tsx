"use client";

import { useTranslations } from "next-intl";
import type { OperationalPersonality, PersonalityDimension } from "./agent-api";

const dimensions: Array<keyof OperationalPersonality> = ["warmth", "enthusiasm", "formality"];
const defaults: OperationalPersonality = {
  warmth: { base: 50, intensity: 100 },
  enthusiasm: { base: 50, intensity: 100 },
  formality: { base: 50, intensity: 100 }
};

export function personalityOrDefault(value?: OperationalPersonality): OperationalPersonality {
  return dimensions.reduce((result, key) => ({ ...result, [key]: value?.[key] ?? defaults[key] }), {} as OperationalPersonality);
}

export function effectiveValue(value: PersonalityDimension) {
  return value.base * value.intensity / 100;
}

export function continuousIntensity(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function circularSliderPoint(intensity: number) {
  const angle = (-135 + continuousIntensity(intensity) * 2.7) * Math.PI / 180;
  return { x: 60 + 44 * Math.cos(angle), y: 60 + 44 * Math.sin(angle) };
}

export function soulScore(personality: OperationalPersonality) {
  const average = dimensions.reduce((sum, key) => sum + effectiveValue(personality[key]), 0) / dimensions.length;
  return Math.max(0, Math.min(10, Math.round(average / 10 * 10) / 10));
}

export function PersonalityConsole({
  value, disabled, saving, onChange, onSave
}: {
  value?: OperationalPersonality;
  disabled?: boolean;
  saving?: boolean;
  onChange: (next: OperationalPersonality) => void;
  onSave: () => void;
}) {
  const t = useTranslations("personality");
  const personality = personalityOrDefault(value);
  const score = soulScore(personality);
  const description = score >= 7 ? t("high") : score >= 4 ? t("balanced") : t("reserved");
  return <section aria-labelledby="personality-console-title" className="rounded-lg border bg-card p-5">
    <div className="mb-5"><h2 id="personality-console-title" className="text-lg font-semibold">{t("title")}</h2><p className="text-sm text-muted-foreground">{t("description")}</p></div>
    <div className="grid gap-5 sm:grid-cols-3">
      {dimensions.map((key) => <PersonalityKnob key={key} name={key} value={personality[key]} disabled={disabled} onChange={(next) => onChange({ ...personality, [key]: next })} />)}
    </div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/60 p-4"><div><p className="text-xs font-medium tracking-[.16em] text-muted-foreground">{t("soul")}</p><p className="mt-1 text-2xl font-semibold">{score.toFixed(1)} / 10</p><p className="text-sm text-muted-foreground">{description}</p></div><button type="button" disabled={disabled || saving} onClick={onSave} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? t("saving") : t("save")}</button></div>
    <p className="mt-3 text-xs text-muted-foreground">{t("responseLengthUnavailable")}</p>
  </section>;
}

function PersonalityKnob({ name, value, disabled, onChange }: { name: keyof OperationalPersonality; value: PersonalityDimension; disabled?: boolean; onChange: (next: PersonalityDimension) => void }) {
  const t = useTranslations("personality");
  const setIntensity = (intensity: number) => onChange({ ...value, intensity: continuousIntensity(intensity) });
  const pointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const degrees = Math.atan2(y, x) * 180 / Math.PI;
    setIntensity((Math.max(-135, Math.min(135, degrees)) + 135) / 2.7);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const label = t(name);
  const thumb = circularSliderPoint(value.intensity);
  const circumference = 2 * Math.PI * 44;
  const arcLength = circumference * .75;
  return <div className="text-center"><button data-testid={`${name}-circular-slider`} type="button" role="slider" aria-label={t("intensity", { name: label })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value.intensity} disabled={disabled} onPointerDown={pointer} onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && pointer(event)} onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowRight") { event.preventDefault(); setIntensity(value.intensity + 1); } if (event.key === "ArrowDown" || event.key === "ArrowLeft") { event.preventDefault(); setIntensity(value.intensity - 1); } if (event.key === "Home") { event.preventDefault(); setIntensity(0); } if (event.key === "End") { event.preventDefault(); setIntensity(100); } }} className="relative mx-auto grid h-32 w-32 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"><svg aria-hidden viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-[135deg]"><circle cx="60" cy="60" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${arcLength} ${circumference}`} /><circle cx="60" cy="60" r="44" fill="none" stroke="hsl(var(--primary))" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${arcLength * value.intensity / 100} ${circumference}`} /></svg><span aria-hidden className="absolute h-5 w-5 rounded-full border-2 border-background bg-primary shadow transition-[left,top] duration-75" style={{ left: `${thumb.x / 1.2}%`, top: `${thumb.y / 1.2}%`, transform: "translate(-50%, -50%)" }} /><span className="relative grid h-20 w-20 place-items-center rounded-full bg-card text-lg font-semibold shadow-sm">{value.intensity}%</span></button><p className="mt-3 text-sm font-semibold uppercase tracking-wide">{label}</p><p className="mt-2 text-xs text-muted-foreground">{t("base")}: {value.base}%</p><p className="mt-1 text-xs text-muted-foreground">{t("active", { value: effectiveValue(value).toFixed(1), base: value.base })}</p></div>;
}
