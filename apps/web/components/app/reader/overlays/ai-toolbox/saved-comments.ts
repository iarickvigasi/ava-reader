import type { AiCommentRecord } from "@/features/offline/buckets/ai-comments";
import type { ReaderRangeLocator } from "@/lib/api-types";

export type ToolKey = "translate" | "etymology" | "explain";

// The bucket comment matching the current selection+kind, if one exists. The
// panel renders from this (the bucket is the source of truth): `body` is empty
// until a queued/streaming request produces output, `status` drives the
// queued/failed placeholders, and `error` carries a permanent-failure reason.
export type SavedComment = Pick<AiCommentRecord, "body" | "status" | "error">;

const KIND_TO_TOOL: Record<AiCommentRecord["kind"], ToolKey> = {
  TRANSLATE: "translate",
  ETYMOLOGY: "etymology",
  EXPLAIN: "explain",
};

// Pure: pick the saved comment per tool whose locator matches the current
// selection exactly (same start/end the highlight bridge uses). The server
// upserts on (libraryItem, locator, kind), so there's at most one row per tool
// for a given fragment.
export function selectSavedComments(
  comments: AiCommentRecord[],
  selectedLocator: ReaderRangeLocator | null,
): Partial<Record<ToolKey, SavedComment>> {
  if (!selectedLocator) return {};
  const result: Partial<Record<ToolKey, SavedComment>> = {};
  for (const comment of comments) {
    const locator = comment.locator;
    if (!locator) continue;
    if (
      locator.startBlockId !== selectedLocator.startBlockId ||
      locator.startOffset !== selectedLocator.startOffset ||
      locator.endBlockId !== selectedLocator.endBlockId ||
      locator.endOffset !== selectedLocator.endOffset
    ) {
      continue;
    }
    const toolKey = KIND_TO_TOOL[comment.kind];
    if (result[toolKey] === undefined) {
      result[toolKey] = {
        body: comment.body,
        status: comment.status,
        error: comment.error,
      };
    }
  }
  return result;
}
