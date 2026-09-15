import { describe, expect, it } from "vitest";
import { parseReadingGoal } from "./reading-goal";

describe("parseReadingGoal", () => {
  it.each([1, 30, 1440, "1", "30", "1440", " 45 ", "030"])(
    "accepts whole minutes: %j",
    (raw) => expect(parseReadingGoal(raw)).toBe(Number(raw)),
  );

  it.each([
    null, undefined, true, {}, [], "", " ", "30minutes", "1e2", "1.5",
    "0x10", "-10", 0, -1, 1441, 1.5, NaN, Infinity,
  ])("rejects invalid goals without rounding: %j", (raw) => {
    expect(parseReadingGoal(raw)).toBeNull();
  });
});
