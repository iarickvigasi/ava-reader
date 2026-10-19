import { describe, expect, it } from "vitest";
import { intrinsicScriptRuns } from "./intrinsic-script-runs";

describe("intrinsic script digits", () => {
  it.each([
    ["super", "⁰¹²³⁴⁵⁶⁷⁸⁹"],
    ["sub", "₀₁₂₃₄₅₆₇₈₉"],
  ] as const)("preserves %s digits without extra placement", (script, text) => {
    expect(intrinsicScriptRuns(text, script)).toEqual([{ text, script: undefined }]);
  });
  it("splits only matching digits and preserves every UTF-16 code unit", () => {
    const text = "A😀²³2₄ⁱ⁵";
    const runs = intrinsicScriptRuns(text, "super");
    expect(runs).toEqual([
      { text: "A😀", script: "super" },
      { text: "²³", script: undefined },
      { text: "2₄ⁱ", script: "super" },
      { text: "⁵", script: undefined },
    ]);
    expect(runs.map(r => r.text).join("")).toBe(text);
    expect(intrinsicScriptRuns(text, undefined)).toEqual([{ text, script: undefined }]);
  });
  it.each(["²\u0301", "²\ufe0f", "²\u{e0100}", "²\u200d³"])("does not split complex sequence %s", text => {
    expect(intrinsicScriptRuns(text, "super")).toEqual([{ text, script: "super" }]);
  });
  it("guards combining boundaries across existing style runs", () => {
    expect(intrinsicScriptRuns("²", "super", "", "\u0301")).toEqual([{ text: "²", script: "super" }]);
    expect(intrinsicScriptRuns("²", "super", "\u200d", "")).toEqual([{ text: "²", script: "super" }]);
  });
});
