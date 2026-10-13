import { expect, it } from "vitest";
import {
  clampIntroduction,
  introductionLength,
  isPublishableIntroduction,
} from "./introduction";

it("counts and limits Unicode code points without breaking surrogate pairs", () => {
  const value = "📚".repeat(801);
  expect(introductionLength(value)).toBe(801);
  expect(clampIntroduction(value)).toBe("📚".repeat(800));
});

it("requires 80–800 trimmed code points to publish", () => {
  expect(isPublishableIntroduction("a".repeat(79))).toBe(false);
  expect(isPublishableIntroduction(" " + "a".repeat(79) + " ")).toBe(false);
  expect(isPublishableIntroduction("a".repeat(80))).toBe(true);
  expect(isPublishableIntroduction("📚".repeat(80))).toBe(true);
  expect(isPublishableIntroduction("a".repeat(800))).toBe(true);
  expect(isPublishableIntroduction("a".repeat(801))).toBe(false);
});
