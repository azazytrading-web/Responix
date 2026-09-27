import { circularSliderPoint, continuousIntensity, effectiveValue, personalityOrDefault, soulScore } from "./personality-console";
import { describe, expect, it } from "vitest";

describe("operational personality calculations", () => {
  const personality = personalityOrDefault({
    warmth: { base: 30, intensity: 50 },
    enthusiasm: { base: 80, intensity: 100 },
    formality: { base: 40, intensity: 0 }
  });

  it("keeps base values distinct from intensity", () => {
    expect(effectiveValue({ base: 30, intensity: 0 })).toBe(0);
    expect(effectiveValue({ base: 30, intensity: 50 })).toBe(15);
    expect(effectiveValue({ base: 30, intensity: 100 })).toBe(30);
  });

  it("supports arbitrary continuous rotary intensity values", () => {
    expect(continuousIntensity(37)).toBe(37);
    expect(continuousIntensity(68)).toBe(68);
    expect(continuousIntensity(93)).toBe(93);
    expect(continuousIntensity(-4)).toBe(0);
    expect(continuousIntensity(104)).toBe(100);
  });

  it("maps arbitrary intensities to distinct points on the circular slider arc", () => {
    expect(circularSliderPoint(37)).not.toEqual(circularSliderPoint(68));
    expect(circularSliderPoint(68)).not.toEqual(circularSliderPoint(93));
  });

  it("derives a bounded deterministic soul score", () => {
    expect(soulScore(personality)).toBe(3.2);
    expect(soulScore(personality)).toBe(soulScore(personality));
    expect(soulScore(personality)).toBeGreaterThanOrEqual(0);
    expect(soulScore(personality)).toBeLessThanOrEqual(10);
  });
});
