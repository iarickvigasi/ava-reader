import { describe, expect, it } from "vitest";
import { canonicalStyle } from "./style";

describe("source annotation styles", () => {
  it("keeps colors and simultaneous underline/strike-through as inline styling", () => {
    expect(
      canonicalStyle({
        id: "source",
        color: "#000000",
        background_color: "#ffff00",
        decoration_color: "#0000ff",
        underline: true,
        strike_through: true,
      }),
    ).toEqual({
      color: "var(--reader-source-foreground, #000000)",
      "--reader-source-foreground": "#000000",
      colorScheme: "only light",
      backgroundColor: "#ffff00",
      textDecorationColor: "light-dark(#0000ff, #aca7ed)",
      textDecorationLine: "underline line-through",
    });
  });
  it("preserves observed false resets and leaves unknown properties inherited", () => {
    expect(
      canonicalStyle({ id: "source", underline: false, strike_through: false }),
    ).toEqual({ textDecorationLine: "none" });
    expect(canonicalStyle({ id: "legacy" })).toEqual({});
  });
});

it("keeps whole-block indentation separate from first-line indentation", () => {
  expect(
    canonicalStyle({ id: "pair", block_indent_em: 3.6, indent_em: 0 }),
  ).toEqual({
    marginInlineStart: "3.6em",
    textIndent: "0em",
  });
  expect(canonicalStyle({ id: "legacy", indent_em: 2 })).toEqual({
    textIndent: "2em",
  });
});

it("establishes a source-background island even when source foreground is unknown", () => {
  expect(canonicalStyle({ id: "light", background_color: "#ffff00" })).toEqual({
    backgroundColor: "#ffff00",
    colorScheme: "only light",
    color: "var(--reader-source-foreground, #000000)",
  });
  expect(
    canonicalStyle({ id: "dark", background_color: "#123456" }).color,
  ).toBe("var(--reader-source-foreground, #ffffff)");
  const source = Object.freeze({ id: "ink", color: "#231f20" });
  expect(canonicalStyle(source)).toEqual({
    color: "light-dark(#231f20, #b3aea8)",
    "--reader-source-foreground": "#231f20",
  });
  expect(source).toEqual({ id: "ink", color: "#231f20" });
});
