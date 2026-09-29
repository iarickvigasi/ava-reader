import type { ReaderMeasurementEntry } from "@/features/reader/measurement";
import type { RestoreIntent } from "@/features/reader/navigation";

export function restoreSucceeded(
  intent: RestoreIntent,
  entry: ReaderMeasurementEntry,
) {
  if (entry.status !== "ready") return false;
  if (intent.kind !== "block") return true;
  const resolution = entry.resolvePageIndex(intent);
  return (
    resolution.status === "exact" ||
    (resolution.status === "block-start" && intent.textOffset === 0)
  );
}
