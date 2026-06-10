import { describe, expect, it } from "vitest";

import type { SaveOutcome } from "./download";
import { shouldToastSaveFailure } from "./save-toast";

const FAILED: SaveOutcome = { kind: "failed", reason: "network" };
const SAVED: SaveOutcome = { kind: "saved" };
const CANCELLED: SaveOutcome = { kind: "cancelled" };

describe("shouldToastSaveFailure", () => {
  it("toasts an explicit save that failed while online", () => {
    expect(shouldToastSaveFailure(FAILED, "explicit", true)).toBe(true);
  });

  it("never toasts an auto-save failure (background convenience, opening any book)", () => {
    expect(shouldToastSaveFailure(FAILED, "auto", true)).toBe(false);
    expect(shouldToastSaveFailure(FAILED, "auto", false)).toBe(false);
  });

  it("does not toast an explicit save that failed while offline (it's queued)", () => {
    expect(shouldToastSaveFailure(FAILED, "explicit", false)).toBe(false);
  });

  it("does not toast a successful or cancelled save", () => {
    expect(shouldToastSaveFailure(SAVED, "explicit", true)).toBe(false);
    expect(shouldToastSaveFailure(CANCELLED, "explicit", true)).toBe(false);
  });
});
