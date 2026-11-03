import type { ReadingCoverage } from "@/lib/api-types/reading-coverage";

export function isOlderReadingSnapshot(
  incoming: ReadingCoverage | undefined,
  current: ReadingCoverage | undefined,
) {
  return (
    current?.readingRevision !== undefined &&
    (incoming?.readingRevision ?? -1) < current.readingRevision
  );
}
