import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LibraryBookInfoScreen } from "./library-book-info-screen";
import type { LibraryBookInfo } from "@/lib/api-types";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("library book info metadata", () => {
  it("renders reading time and approximate page count metadata", () => {
    const markup = renderToStaticMarkup(
      <LibraryBookInfoScreen
        backHref="/app/library"
        book={createBookInfo({
          approximatePageCount: 163,
          minutesRead: 195,
          publishedYear: 1818,
        })}
      />,
    );

    expect(markup).toContain("Reading time");
    expect(markup).toContain("3.3 h");
    expect(markup).toContain("Page count");
    expect(markup).toContain("~163 pages");
    expect(markup).toContain("Published");
    expect(markup).toContain("1818");
    expect(markup).not.toContain("Minutes read");
  });

  it("renders unknown page count fallback", () => {
    const markup = renderToStaticMarkup(
      <LibraryBookInfoScreen
        backHref="/app/library"
        book={createBookInfo({
          approximatePageCount: null,
          publishedYear: null,
        })}
      />,
    );

    expect(markup).toContain("Page count");
    expect(markup).toContain("Unknown");
    expect(markup).toContain("Published");
  });
});

function createBookInfo(
  overrides: Partial<LibraryBookInfo> = {},
): LibraryBookInfo {
  return {
    addedAt: "2026-04-01T10:00:00.000Z",
    approximatePageCount: 163,
    author: "Mary Shelley",
    chapterLabel: "Chapter 7",
    collections: [
      {
        id: "collection-1",
        kind: "SMART",
        name: "Imported Books",
      },
    ],
    completionPercent: 44,
    coverImageDataUrl: null,
    description: "A gothic classic.",
    language: "English",
    lastReadAt: "2026-04-11T08:30:00.000Z",
    libraryItemId: "library-42",
    minutesRead: 195,
    primaryFormat: "EPUB",
    publishedYear: 1818,
    source: "IMPORTED",
    title: "Frankenstein",
    ...overrides,
  };
}
