import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LibraryScreen } from "./library-screen";
import { isAppNavigationItemActive } from "@/lib/app-navigation";
import type { LibraryPayload } from "@/lib/api-types";

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

describe("library and navigation UI", () => {
  it("renders per-collection view-all links to collection detail screens", () => {
    const markup = renderToStaticMarkup(
      <LibraryScreen library={createLibraryPayload()} />,
    );

    expect(markup).toContain('href="/app/library/collections/imported-books"');
    expect(markup).toContain('href="/app/library/collections/late-night-reads"');
  });

  it("renders collection preview books and empty collection messaging on the library screen", () => {
    const markup = renderToStaticMarkup(
      <LibraryScreen library={createLibraryPayload()} />,
    );

    expect(markup).toContain(
      'href="/app/library/books/meditations-by-marcus-aurelius?fromCollection=imported-books"',
    );
    expect(markup).toContain(
      'href="/app/library/books/the-republic-by-plato?fromCollection=imported-books"',
    );
    expect(markup).toContain(
      'href="/app/library/books/discourses-by-epictetus?fromCollection=imported-books"',
    );
    expect(markup).toContain(
      'href="/app/library/books/nicomachean-ethics-by-aristotle?fromCollection=imported-books"',
    );
    expect(markup).toContain("Imported Books");
    expect(markup).toContain("No books are in this collection yet.");
  });

  it("marks the library tab active in shared app navigation", () => {
    expect(isAppNavigationItemActive("/app/library", "/app/library")).toBe(true);
    expect(isAppNavigationItemActive("/app/library", "/app")).toBe(false);
    expect(isAppNavigationItemActive("/app/library", "/app/explore")).toBe(false);
  });
});

function createLibraryPayload(): LibraryPayload {
  return {
    collections: [
      {
        books: [
          {
            authors: ["Marcus Aurelius"],
            completionPercent: 42,
            coverImageUrl: null,
            lastReadAt: "2026-04-08T10:00:00.000Z",
            libraryItemId: "library-1",
            primaryFormat: "EPUB",
            slug: "meditations-by-marcus-aurelius",
            title: "Meditations",
          },
          {
            authors: ["Plato"],
            completionPercent: 100,
            coverImageUrl: null,
            lastReadAt: "2026-04-06T10:00:00.000Z",
            libraryItemId: "library-2",
            primaryFormat: "EPUB",
            slug: "the-republic-by-plato",
            title: "The Republic",
          },
          {
            authors: ["Epictetus"],
            completionPercent: 8,
            coverImageUrl: null,
            lastReadAt: "2026-04-05T10:00:00.000Z",
            libraryItemId: "library-3",
            primaryFormat: "EPUB",
            slug: "discourses-by-epictetus",
            title: "Discourses",
          },
          {
            authors: ["Aristotle"],
            completionPercent: 13,
            coverImageUrl: null,
            lastReadAt: "2026-04-04T10:00:00.000Z",
            libraryItemId: "library-4",
            primaryFormat: "EPUB",
            slug: "nicomachean-ethics-by-aristotle",
            title: "Nicomachean Ethics",
          },
        ],
        description: "Your personal uploads.",
        id: "collection-1",
        itemCount: 5,
        kind: "SMART",
        name: "Imported Books",
        slug: "imported-books",
        smartKey: "imported-library",
        unreadCount: 4,
      },
      {
        books: [],
        description: "A custom shelf.",
        id: "collection-2",
        itemCount: 0,
        kind: "CUSTOM",
        name: "Late Night Reads",
        slug: "late-night-reads",
        smartKey: null,
        unreadCount: 0,
      },
    ],
    summary: {
      booksCount: 2,
      collectionsCount: 2,
    },
  };
}
