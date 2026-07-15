import { describe, expect, it } from "vitest";
import {
  isOverrideActive,
  parseOverride,
  resolveTheme,
  toggleOverride,
  type ThemeOverride,
} from "./resolve-theme";

describe("isOverrideActive", () => {
  it("is inactive when there is no override", () => {
    expect(isOverrideActive("light", null)).toBe(false);
  });

  it("is active while the device scheme matches the segment it was set against", () => {
    const override: ThemeOverride = { theme: "dark", setAgainst: "light" };
    expect(isOverrideActive("light", override)).toBe(true);
  });

  it("goes stale once the device scheme has shifted away from that segment", () => {
    const override: ThemeOverride = { theme: "dark", setAgainst: "light" };
    expect(isOverrideActive("dark", override)).toBe(false);
  });
});

describe("resolveTheme", () => {
  it("follows the device scheme when there is no override", () => {
    expect(resolveTheme("dark", null)).toBe("dark");
    expect(resolveTheme("light", null)).toBe("light");
  });

  it("uses the override while it is active for the current segment", () => {
    const override: ThemeOverride = { theme: "light", setAgainst: "dark" };
    expect(resolveTheme("dark", override)).toBe("light");
  });

  it("ignores a stale override and follows the device scheme", () => {
    const override: ThemeOverride = { theme: "light", setAgainst: "dark" };
    expect(resolveTheme("light", override)).toBe("light");
  });
});

describe("toggleOverride", () => {
  it("sets an override against the current device scheme when following the device", () => {
    expect(toggleOverride("light", null)).toEqual({
      theme: "dark",
      setAgainst: "light",
    });
    expect(toggleOverride("dark", null)).toEqual({
      theme: "light",
      setAgainst: "dark",
    });
  });

  it("clears the override when toggling back to the device scheme", () => {
    const override: ThemeOverride = { theme: "light", setAgainst: "dark" };
    expect(toggleOverride("dark", override)).toBeNull();
  });

  it("replaces a stale override with a fresh one against the current scheme", () => {
    // Override was set against light, but the device is now dark (stale).
    // Effective theme is the device's dark, so a toggle should pin light here.
    const stale: ThemeOverride = { theme: "dark", setAgainst: "light" };
    expect(toggleOverride("dark", stale)).toEqual({
      theme: "light",
      setAgainst: "dark",
    });
  });
});

describe("parseOverride", () => {
  it("returns null for absent or malformed storage", () => {
    expect(parseOverride(null)).toBeNull();
    expect(parseOverride("not json")).toBeNull();
    expect(parseOverride("null")).toBeNull();
    expect(parseOverride("42")).toBeNull();
  });

  it("returns null when the shape is not a valid override", () => {
    expect(parseOverride('{"theme":"blue","setAgainst":"light"}')).toBeNull();
    expect(parseOverride('{"theme":"dark"}')).toBeNull();
    expect(parseOverride('{"setAgainst":"light"}')).toBeNull();
    expect(parseOverride('{"theme":"dark","setAgainst":"sepia"}')).toBeNull();
  });

  it("parses a well-formed override", () => {
    expect(parseOverride('{"theme":"dark","setAgainst":"light"}')).toEqual({
      theme: "dark",
      setAgainst: "light",
    });
  });
});
