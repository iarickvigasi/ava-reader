import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import type { HighlightRecord } from "@/features/offline/buckets/highlights";
import type { AiCommentRecord } from "@/features/offline/buckets/ai-comments";
import { BookAnnotationsView } from "./book-annotations-view";

const highlight: HighlightRecord = {
  id: "highlight", excerpt: "A saved passage", color: "jade", locator: null,
  createdAt: "2026-09-11", updatedAt: "2026-09-11",
};
const comment: AiCommentRecord = {
  id: "comment", sourceText: "The original words", body: "The full explanation.\nAnother paragraph.",
  kind: "EXPLAIN", targetLang: null, locator: null, createdAt: "2026-09-11", status: "ready", error: null,
};
const defaults = {
  highlights: [highlight], comments: [comment], chapterLabels: new Map<string, string>(),
  highlightsStatus: "ready" as const, commentsStatus: "ready" as const,
  deleteHighlight: vi.fn(), deleteAiComment: vi.fn(), retryHighlights: vi.fn(), retryComments: vi.fn(),
};
const render = (props: Partial<Parameters<typeof BookAnnotationsView>[0]> = {}) =>
  renderToStaticMarkup(withIntl(<BookAnnotationsView {...defaults} {...props} />));

describe("book-info annotations", () => {
  it("provides a separate list menu for each section even when lists are empty", () => {
    for (const props of [{}, { highlights: [], comments: [] }]) {
      const markup = render(props);
      expect(markup).toContain('aria-label="More options for Highlights"');
      expect(markup).toContain('aria-label="More options for AI Comments"');
      expect(markup.match(/aria-label="More options for (?:Highlights|AI Comments)"/g))
        .toHaveLength(2);
    }
  });

  it("renders every passage and expanded response without color or expansion controls", () => {
    const markup = render({
      highlights: Array.from({ length: 14 }, (_, i) => ({ ...highlight, id: `h${i}`, excerpt: `Passage ${i}` })),
      comments: Array.from({ length: 12 }, (_, i) => ({ ...comment, id: `c${i}`, body: `Response ${i}` })),
    });
    expect(markup).toContain("Passage 13");
    expect(markup).toContain("Response 11");
    expect(markup.match(/<li/g)).toHaveLength(26);
    expect(markup).not.toMatch(/Show all|line-clamp|background-color|Unknown chapter|Expand/);
    expect(markup.indexOf("Highlights")).toBeLessThan(markup.indexOf("AI Comments"));
  });

  it("shows distinct loading, empty and failed states independently", () => {
    const pending = render({ highlights: [], comments: [], highlightsStatus: "loading" });
    expect(pending).toContain("Loading saved passages");
    expect(pending).not.toContain("No highlights yet");
    expect(pending).toContain("No AI comments yet");
    const failed = render({ highlights: [], highlightsStatus: "error" });
    expect(failed).toContain("Couldn’t load saved passages");
    expect(failed).toContain("Try again");
    expect(failed).toContain(comment.body);
  });

  it("keeps cached records readable during refresh failures and preserves line breaks", () => {
    const markup = render({ highlightsStatus: "error", commentsStatus: "loading" });
    expect(markup).toContain(highlight.excerpt);
    expect(markup).toContain(comment.body);
    expect(markup).not.toContain("Loading saved passages");
  });

  it("shows queued and failed AI comment states without hiding the source passage", () => {
    const queued = render({ comments: [{ ...comment, body: "", status: "queued" }] });
    expect(queued).toContain(comment.sourceText);
    expect(queued).toContain("Waiting for connection");
    expect(render({ comments: [{ ...comment, body: "", status: "failed", error: "No credits left" }] }))
      .toContain("No credits left");
  });
});
