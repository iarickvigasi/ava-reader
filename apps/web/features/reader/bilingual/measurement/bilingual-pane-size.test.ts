import { describe, expect, it } from "vitest";
import { bilingualPaneSize } from "./bilingual-pane-size";

describe("bilingual pane geometry", () => {
  it("splits phone height equally, preserving full width in either orientation", () => {
    expect(bilingualPaneSize(334, 645, true)).toEqual({
      width: 334,
      height: 314,
    });
    expect(bilingualPaneSize(788, 191, true)).toEqual({
      width: 788,
      height: 87,
    });
  });
  it("retains desktop side-by-side geometry", () => {
    expect(bilingualPaneSize(1000, 600, false)).toEqual({
      width: 476,
      height: 600,
    });
  });
  it("does not produce negative sizes before the surface is ready", () => {
    expect(bilingualPaneSize(0, 0, true)).toEqual({ width: 0, height: 0 });
    expect(bilingualPaneSize(0, 0, false)).toEqual({ width: 0, height: 0 });
  });
});
