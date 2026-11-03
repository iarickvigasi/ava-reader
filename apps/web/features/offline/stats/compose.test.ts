import { expect, it } from "vitest";
import { composeHomeStats } from "./compose";

const baseline = {
  aiComments: 5,
  highlights: 10,
  hoursReading: 8,
  volumesRead: 3,
};

it.each([
  [2, 12],
  [-3, 7],
  [-50, 0],
  [0, 10],
])(
  "applies highlight delta %s while preserving reconciled totals",
  (delta, highlights) => {
    expect(composeHomeStats(baseline, delta)).toEqual({
      ...baseline,
      highlights,
    });
    expect(baseline.highlights).toBe(10);
  },
);
