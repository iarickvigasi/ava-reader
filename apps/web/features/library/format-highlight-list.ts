import type { HighlightRecord } from "@/features/offline/buckets/highlights";

export function formatHighlightList(
  highlights: readonly HighlightRecord[], chapterLabels: ReadonlyMap<string, string>,
): string {
  return highlights.map((highlight) => [
    chapterLabels.get(highlight.locator?.chapterId ?? ""),
    highlight.excerpt,
  ].filter(Boolean).join("\n\n")).join("\n\n---\n\n");
}
