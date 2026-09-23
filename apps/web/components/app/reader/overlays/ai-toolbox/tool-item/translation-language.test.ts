import { describe, expect, it } from "vitest";
import { translationTarget } from "./translation-language";

describe("bilingual translation direction", () => {
  it("uses the reading language for original selections", () => {
    expect(translationTarget("fr", "English", false)).toBe("English");
  });
  it("uses the book language for translated selections", () => {
    expect(translationTarget("fr", "English", true)).toBe("French");
    expect(translationTarget("French", "English", true)).toBe("French");
  });
  it("requires a target when the book language is unknown or identical", () => {
    for (const source of [null, "und", "mul", "en-US", "English"])
      expect(translationTarget(source, "English", true)).toBe("");
  });
});
