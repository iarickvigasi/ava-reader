import { expect, it } from "vitest";
import {
  clampIntroduction,
  introductionLength,
  isPublishableIntroduction,
} from "./introduction";

it("counts and limits Unicode code points without breaking surrogate pairs", () => {
  const value = "📚".repeat(181);
  expect(introductionLength(value)).toBe(181);
  expect(clampIntroduction(value)).toBe("📚".repeat(180));
});

it("requires 50–180 trimmed code points to publish", () => {
  expect(isPublishableIntroduction("a".repeat(49))).toBe(false);
  expect(isPublishableIntroduction(" " + "a".repeat(49) + " ")).toBe(false);
  expect(isPublishableIntroduction("a".repeat(50))).toBe(true);
  expect(isPublishableIntroduction("📚".repeat(50))).toBe(true);
  expect(isPublishableIntroduction("a".repeat(180))).toBe(true);
  expect(isPublishableIntroduction("a".repeat(181))).toBe(false);
});
