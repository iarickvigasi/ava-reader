import type { AiCommentRecord } from "./use-ai-comments";

export type AiCommentKind = AiCommentRecord["kind"];

// Order matches the Figma reference (Explanation → Etymology → Translation).
// Used by the filter chip row and to colour-coordinate the empty/full states.
export const AI_COMMENT_KIND_ORDER: AiCommentKind[] = [
  "EXPLAIN",
  "ETYMOLOGY",
  "TRANSLATE",
];

export type AiCommentsFilterId = AiCommentKind | "all";

export type AiCommentFilter = {
  id: AiCommentsFilterId;
  label: string;
  count: number;
};

// One row as displayed in the panel — what the row component renders. Built
// by the view-model from an AiCommentRecord plus the TOC chapter lookup.
export type AiCommentPanelRow = {
  id: string;
  kind: AiCommentKind;
  sourceText: string;
  body: string;
  chapterLabel: string;
};
