import type { ReaderRangeLocator } from "@/lib/api-types";
import {
  buildRangeFromLocator,
  unwrapMarksByClass,
  wrapRangeWithMarks,
} from "./range-marks";

// Class added to every <mark> the AI-comment highlighter creates. We use it
// both as a styling hook and as the cleanup selector — anything else marked
// manually in the DOM is left alone.
export const AI_COMMENT_MARK_CLASS = "ai-comment-mark";

type CommentForMarking = {
  id: string;
  locator: ReaderRangeLocator | null;
  // when "queued" or "streaming", the comment is locally pending
  // and the underline renders at 50% opacity so the user can tell it's
  // not yet on the server.
  status?: "queued" | "streaming" | "ready" | "failed";
};

// Wraps every saved AI-comment range inside `article` with a styled <mark>
// element. Designed to run inside a useLayoutEffect that re-fires whenever
// the article's blocks re-render — React replaces text nodes on each render,
// which silently strips our marks, so we always start from a clean slate by
// unwrapping any leftover marks first.
export function applyAiCommentMarks(
  article: HTMLElement,
  comments: readonly CommentForMarking[],
): void {
  unwrapMarksByClass(article, AI_COMMENT_MARK_CLASS);

  for (const comment of comments) {
    const locator = comment.locator;
    if (!locator) {
      continue;
    }
    const range = buildRangeFromLocator(article, locator);
    if (!range) {
      continue;
    }
    const pending =
      comment.status === "queued" || comment.status === "streaming";
    wrapRangeWithMarks(range, (mark) => {
      mark.className = AI_COMMENT_MARK_CLASS;
      mark.dataset.aiCommentId = comment.id;
      // Inline styles instead of Tailwind classes: the <mark> is created
      // outside React, so utility classes wouldn't be safelisted. The
      // browser's default <mark> background is yellow — we strip that.
      mark.style.backgroundColor = "transparent";
      mark.style.color = "inherit";
      mark.style.textDecorationLine = "underline";
      mark.style.textDecorationStyle = "solid";
      // Pull the underline color from the theme so it follows light/dark
      // mode. `--title` is the warm brown / cream token used elsewhere for
      // headings. Pending comments fade the underline (color → 50% alpha)
      // without changing the underlying text color — the user can still
      // read the source comfortably while a queued / streaming comment
      // shows up as a softer marker.
      mark.style.textDecorationColor = pending
        ? "color-mix(in srgb, var(--title) 50%, transparent)"
        : "var(--title)";
      mark.style.textDecorationThickness = "2px";
      mark.style.textUnderlineOffset = "3px";
      mark.style.cursor = "pointer";
      if (pending) {
        mark.dataset.aiCommentStatus = comment.status;
      }
    });
  }
}

// Removes every AI-comment <mark> from `article`. Kept as a named export so
// consumers (e.g. ReaderArticle's cleanup) can target the right class without
// reaching into shared internals.
export function unwrapAllMarks(article: HTMLElement): void {
  unwrapMarksByClass(article, AI_COMMENT_MARK_CLASS);
}
