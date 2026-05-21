import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LibraryBookInfoScreen } from "./book-info-screen";
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
    expect(markup).toContain("3.3 h / 5.4 h estimated");
    expect(markup).toContain("Page count");
    expect(markup).toContain("~163 pages");
    expect(markup).toContain("Published");
    expect(markup).toContain("1818");
    expect(markup).not.toContain("Minutes read");
  });

  it("renders full language name for canonical language tags", () => {
    const markup = renderToStaticMarkup(
      <LibraryBookInfoScreen
        backHref="/app/library"
        book={createBookInfo({
          language: "en",
        })}
      />,
    );

    expect(markup).toContain("Language");
    expect(markup).toContain("English");
    expect(markup).not.toContain(">en<");
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
    expect(markup).toContain("Reading time");
    expect(markup).toContain("3.3 h");
    expect(markup).not.toContain("estimated");
  });

  it("renders estimated total reading time from page count", () => {
    const markup = renderToStaticMarkup(
      <LibraryBookInfoScreen
        backHref="/app/library"
        book={createBookInfo({
          approximatePageCount: 60,
          minutesRead: 0,
        })}
      />,
    );

    expect(markup).toContain("Reading time");
    expect(markup).toContain("0.0 h / 2.0 h estimated");
  });

  it("renders genre chips instead of legacy source and collection tags", () => {
    const markup = renderToStaticMarkup(
      <LibraryBookInfoScreen
        backHref="/app/library"
        book={createBookInfo({
          collections: [
            {
              id: "collection-1",
              kind: "SMART",
              name: "Imported Books",
              smartKey: "imported-library",
            },
          ],
          genres: ["Gothic", "Science Fiction"],
          source: "CATALOG",
        })}
      />,
    );

    expect(markup).toContain("Gothic");
    expect(markup).toContain("Science Fiction");
    expect(markup).not.toContain(">Catalog<");
    expect(markup).not.toContain("Imported Books");
  });

  it("does not crash when genres are missing in a legacy payload", () => {
    const markup = renderToStaticMarkup(
      <LibraryBookInfoScreen
        backHref="/app/library"
        book={createBookInfo({
          genres: undefined as unknown as string[],
        })}
      />,
    );

    expect(markup).not.toContain(">Catalog<");
    expect(markup).toContain("Frankenstein");
  });
});

function createBookInfo(
  overrides: Partial<LibraryBookInfo> = {},
): LibraryBookInfo {
  return {
    addedAt: "2026-04-01T10:00:00.000Z",
    approximatePageCount: 163,
    authors: ["Mary Shelley"],
    chapterLabel: "Chapter 7",
    collections: [
      {
        id: "collection-1",
        kind: "SMART",
        name: "Imported Books",
        smartKey: "imported-library",
      },
    ],
    completionPercent: 44,
    coverImageUrl: null,
    description: "A gothic classic.",
    genres: ["Gothic", "Classic"],
    language: "English",
    lastReadAt: "2026-04-11T08:30:00.000Z",
    libraryItemId: "library-42",
    minutesRead: 195,
    primaryFormat: "EPUB",
    publishedYear: 1818,
    slug: "frankenstein-by-mary-shelley",
    source: "IMPORTED",
    title: "Frankenstein",
    ...overrides,
  };
}
