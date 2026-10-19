import { expect, it } from "vitest";
import { stepFontScale } from "./font-scale";

it("returns to the default after reaching and reversing from either limit", () => {
  let value = 1;
  for (let i = 0; i < 4; i++) value = stepFontScale(value, 1);
  expect(value).toBe(1.35);
  expect(stepFontScale(value, 1)).toBe(1.35);
  for (let i = 0; i < 4; i++) value = stepFontScale(value, -1);
  expect(value).toBe(1);
  value = stepFontScale(stepFontScale(value, -1), -1);
  expect(value).toBe(0.85);
  expect(stepFontScale(value, -1)).toBe(0.85);
  expect(stepFontScale(stepFontScale(value, 1), 1)).toBe(1);
});

it("keeps existing off-step preferences until the reader chooses a direction", () => {
  expect(stepFontScale(0.95, 1)).toBe(1);
  expect(stepFontScale(0.95, -1)).toBe(0.9);
  expect(stepFontScale(1.25, 1)).toBe(1.3);
  expect(stepFontScale(1.25, -1)).toBe(1.2);
});

it("is bounded and monotonic for every supported saved hundredth", () => {
  for (let percent = 85; percent <= 135; percent++) {
    const current = percent / 100;
    expect(stepFontScale(current, 1)).toBeGreaterThanOrEqual(current);
    expect(stepFontScale(current, 1)).toBeLessThanOrEqual(1.35);
    expect(stepFontScale(current, -1)).toBeLessThanOrEqual(current);
    expect(stepFontScale(current, -1)).toBeGreaterThanOrEqual(0.85);
  }
});
