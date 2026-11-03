import type { HomePayload } from "@/lib/api-types";

// Reading and completion are already reconciled by the Home bucket.
export function composeHomeStats(
  baseline: HomePayload["stats"],
  highlightsNet: number,
): HomePayload["stats"] {
  return {
    ...baseline,
    highlights: Math.max(0, baseline.highlights + highlightsNet),
  };
}
