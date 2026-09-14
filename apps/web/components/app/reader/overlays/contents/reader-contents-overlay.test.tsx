import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createReaderResumeFixturePayload } from "@/features/reader/test-fixture";
import type { ReaderTocNode } from "@/lib/api-types";
import { withIntl } from "@/lib/test-utils/intl";
import { READER_STATUS_READY } from "../../shared/constants";
import { ReaderContentsOverlay } from "./reader-contents-overlay";

function renderOverlayMarkup(input: {
  activeBlockId?: string;
  activeChapterId?: string;
  pendingChapterId?: string;
  toc?: ReaderTocNode[];
} = {}): string {
  const payload = createReaderResumeFixturePayload();
  if (payload.status !== READER_STATUS_READY) {
    throw new Error("fixture payload must be ready");
  }
  const activeChapterId = input.activeChapterId ?? payload.activeChapterId;
  return renderToStaticMarkup(
    withIntl(
      <ReaderContentsOverlay
        activeChapterId={activeChapterId}
        activeLocator={input.activeBlockId
          ? { blockId: input.activeBlockId, chapterId: activeChapterId, textOffset: 0 }
          : null}
        onClose={() => {}}
        onSelectChapter={() => {}}
        payload={{ ...payload, toc: input.toc ?? payload.toc }}
        pendingChapterId={input.pendingChapterId ?? null}
      />,
    ),
  );
}

function tocEntry(
  input: Pick<ReaderTocNode, "id" | "label"> & Partial<ReaderTocNode>,
): ReaderTocNode {
  return {
    anchorId: null,
    blockId: null,
    chapterId: "chapter-1",
    children: [],
    href: "chapter.xhtml",
    spineIndex: 0,
    ...input,
  };
}

function contentsRows(markup: string): string[] {
  const navigation = markup.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
  return [...navigation.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(
    (match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  );
}

describe("ReaderContentsOverlay", () => {
  it("pins only the slim header: every close control precedes the scroll container", () => {
    const markup = renderOverlayMarkup();
    const scrollStart = markup.indexOf("overflow-auto");

    expect(scrollStart).toBeGreaterThan(-1);
    expect(markup.lastIndexOf("overflow-auto")).toBe(scrollStart);
    expect(markup.lastIndexOf("Close contents panel")).toBeLessThan(scrollStart);
  });

  it("scrolls the book title, authors, and progress together with the chapter tree", () => {
    const markup = renderOverlayMarkup();
    const scrollStart = markup.indexOf("overflow-auto");

    expect(markup.indexOf("Reader Resume Fixture")).toBeGreaterThan(scrollStart);
    expect(markup.indexOf("Fixture Author")).toBeGreaterThan(scrollStart);
    expect(markup.indexOf("% completed")).toBeGreaterThan(scrollStart);
    expect(markup.indexOf("Fixture Chapter 1")).toBeGreaterThan(scrollStart);
  });

  it.each([null, "chapter-1::heading"])(
    "marks the current chapter consistently with anchor %s and omits type badges",
    (blockId) => {
      const toc = [
        tocEntry({ id: "current", label: "First", blockId }),
        tocEntry({ id: "other", label: "Second", chapterId: "chapter-2" }),
        tocEntry({
          id: "anchored-other",
          label: "Third",
          chapterId: "chapter-3",
          blockId: "chapter-3::heading",
        }),
      ];

      const markup = renderOverlayMarkup({ toc });
      expect(contentsRows(markup)).toEqual([
        "First Current", "Second", "Third",
      ]);
      expect(markup.match(/aria-current="location"/g)).toHaveLength(1);
    },
  );

  it.each([
    {
      activeBlockId: "chapter-1::heading",
      expected: ["Fixture Chapter 1", "Fixture Chapter 1 Opening Current"],
    },
    {
      activeBlockId: "chapter-1::body",
      expected: ["Fixture Chapter 1 Current", "Fixture Chapter 1 Opening"],
    },
  ])("marks only the selected parent or child at $activeBlockId", ({ activeBlockId, expected }) => {
    expect(contentsRows(renderOverlayMarkup({ activeBlockId }))).toEqual([
      ...expected, "Fixture Chapter 2", "Fixture Chapter 3",
    ]);
  });

  it("marks only the first duplicate chapter entry", () => {
    const toc = [
      tocEntry({ id: "first", label: "First" }),
      tocEntry({ id: "duplicate", label: "Duplicate" }),
    ];

    expect(contentsRows(renderOverlayMarkup({ toc }))).toEqual([
      "First Current", "Duplicate",
    ]);
  });

  it("does not mark an entry current when the chapter is absent", () => {
    const markup = renderOverlayMarkup({ activeChapterId: "missing" });
    expect(contentsRows(markup)).toEqual([
      "Fixture Chapter 1",
      "Fixture Chapter 1 Opening",
      "Fixture Chapter 2",
      "Fixture Chapter 3",
    ]);
    expect(markup).not.toContain("aria-current");
  });

  it("keeps the visible chapter current while another chapter loads", () => {
    expect(contentsRows(renderOverlayMarkup({ pendingChapterId: "chapter-2" }))).toEqual([
      "Fixture Chapter 1 Current",
      "Fixture Chapter 1 Opening",
      "Fixture Chapter 2 Loading",
      "Fixture Chapter 3",
    ]);
  });

  it("preserves loading feedback when reloading the active chapter", () => {
    const toc = [tocEntry({ id: "current", label: "First" })];

    expect(contentsRows(renderOverlayMarkup({ toc, pendingChapterId: "chapter-1" }))).toEqual([
      "First Loading",
    ]);
  });
});
