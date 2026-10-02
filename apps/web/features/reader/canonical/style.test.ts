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
      color: "#000000",
      backgroundColor: "#ffff00",
      textDecorationColor: "#0000ff",
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
