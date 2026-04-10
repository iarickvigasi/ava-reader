import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LibraryScreen } from "./library-screen";
import { isAppNavigationItemActive } from "@/lib/app-navigation";
import { APP_LIBRARY_HREF } from "@/lib/app-routes";
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
  it("keeps the collections open-all destination pointed at the library page", () => {
    expect(APP_LIBRARY_HREF).toBe("/app/library");
  });

  it("renders collection book links and empty collection messaging on the library screen", () => {
    const markup = renderToStaticMarkup(
      <LibraryScreen library={createLibraryPayload()} />,
    );

    expect(markup).toContain('href="/app/read/library-1"');
    expect(markup).toContain('href="/app/read/library-2"');
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
            author: "Marcus Aurelius",
            completionPercent: 42,
            coverImageDataUrl: null,
            lastReadAt: "2026-04-08T10:00:00.000Z",
            libraryItemId: "library-1",
            primaryFormat: "EPUB",
            title: "Meditations",
          },
          {
            author: "Plato",
            completionPercent: 100,
            coverImageDataUrl: null,
            lastReadAt: "2026-04-06T10:00:00.000Z",
            libraryItemId: "library-2",
            primaryFormat: "EPUB",
            title: "The Republic",
          },
        ],
        description: "Your personal uploads.",
        id: "collection-1",
        itemCount: 2,
        kind: "SMART",
        name: "Imported Books",
        unreadCount: 1,
      },
      {
        books: [],
        description: "A custom shelf.",
        id: "collection-2",
        itemCount: 0,
        kind: "CUSTOM",
        name: "Late Night Reads",
        unreadCount: 0,
      },
    ],
    summary: {
      booksCount: 2,
      collectionsCount: 2,
    },
  };
}
