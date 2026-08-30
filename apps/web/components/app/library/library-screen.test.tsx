import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LibraryScreen } from "./library-screen";
import { isAppNavigationItemActive } from "@/lib/app-navigation";
import type { LibraryPayload } from "@/lib/api-types";
import { withIntl } from "@/lib/test-utils/intl";

// The header's import action mounts <ImportButton>, which reads Clerk auth and
// the router for its post-upload refresh. Static markup mounts neither
// provider, so both are stubbed the way import-button.test.tsx stubs them.
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: async () => "test-token",
    isLoaded: true,
    isSignedIn: true,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

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
      withIntl(<LibraryScreen library={createLibraryPayload()} />),
    );

    expect(markup).toContain('href="/app/library/collections/imported-books"');
    expect(markup).toContain('href="/app/library/collections/late-night-reads"');
  });

  it("renders collection titles as links to their collection screens", () => {
    const markup = renderToStaticMarkup(
      withIntl(<LibraryScreen library={createLibraryPayload()} />),
    );

    expect(markup).toMatch(
      /<h2[^>]*><a[^>]*href="\/app\/library\/collections\/imported-books"[^>]*>Imported Books<\/a><\/h2>/,
    );
    expect(markup).toMatch(
      /<h2[^>]*><a[^>]*href="\/app\/library\/collections\/late-night-reads"[^>]*>Late Night Reads<\/a><\/h2>/,
    );
  });

  it("renders collection preview books and empty collection messaging on the library screen", () => {
    const markup = renderToStaticMarkup(
      withIntl(<LibraryScreen library={createLibraryPayload()} />),
    );

    // Cards now embed snapshot params (title, author[], cover, liid, …) in
    // the href so the next page can render from URL state. We assert the
    // shape — correct slug + correct fromCollection — without pinning the
    // exact tail, which would break on every URL hint change.
    expect(markup).toMatch(
      /href="\/app\/library\/books\/meditations-by-marcus-aurelius\?[^"]*fromCollection=imported-books/,
    );
    expect(markup).toMatch(
      /href="\/app\/library\/books\/the-republic-by-plato\?[^"]*fromCollection=imported-books/,
    );
    expect(markup).toMatch(
      /href="\/app\/library\/books\/discourses-by-epictetus\?[^"]*fromCollection=imported-books/,
    );
    expect(markup).toMatch(
      /href="\/app\/library\/books\/nicomachean-ethics-by-aristotle\?[^"]*fromCollection=imported-books/,
    );
    expect(markup).toContain("Imported Books");
    expect(markup).toContain("No books are in this collection yet.");
  });

  it("pairs each header metric with the action that changes it", () => {
    const markup = renderToStaticMarkup(
      withIntl(<LibraryScreen library={createLibraryPayload()} />),
    );

    // Phone layout comes first in the DOM: New collection → Collections,
    // Import new book → Books, action first in each row.
    expect(markup).toMatch(
      /New collection[\s\S]*?>Collections<\/p>[\s\S]*?Import new book[\s\S]*?>Books<\/p>/,
    );
    // Both actions again in the md+ bar — one copy per breakpoint layout.
    expect(markup.split("New collection").length - 1).toBe(2);
    expect(markup.split("Import new book").length - 1).toBe(2);
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
