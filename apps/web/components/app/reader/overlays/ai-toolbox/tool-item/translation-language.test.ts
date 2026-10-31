import { expect, it } from "vitest";
import { languageCode } from "./translation-language";
it("normalizes the translated column language without overriding the shared target", () => {
  expect(languageCode("French")).toBe("fr");
  expect(languageCode("en-US")).toBe("en");
  expect(languageCode(null)).toBeNull();
});
