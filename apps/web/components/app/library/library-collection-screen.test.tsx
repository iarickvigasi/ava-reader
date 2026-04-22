import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LibraryCollectionScreen } from "./library-collection-screen";
import type { LibraryCollection } from "@/lib/api-types";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: vi.fn(),
    isLoaded: true,
    isSignedIn: true,
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("library collection detail UI", () => {
  it("renders all books in a collection and back navigation", () => {
    const markup = renderToStaticMarkup(
      <LibraryCollectionScreen collection={createCollection()} />,
    );

    expect(markup).toContain('href="/app/library"');
    expect(markup).toContain(
      'href="/app/library/books/library-1?fromCollection=collection-1"',
    );
    expect(markup).toContain(
      'href="/app/library/books/library-2?fromCollection=collection-1"',
    );
    expect(markup).toContain(
      'href="/app/library/books/library-3?fromCollection=collection-1"',
    );
    expect(markup).toContain("Imported Books");
    expect(markup).toContain("3 items • 2 unread");
    expect(markup).toContain("Edit");
    expect(markup).toContain("Delete");
    expect(markup).toContain('class="grid grid-cols-2 gap-x-4 gap-y-6 md:hidden"');
    expect(markup).not.toContain('class="flex gap-4 overflow-x-auto pb-2 md:hidden"');
    expect(markup).toContain(
      'class="hidden gap-x-8 gap-y-6 md:grid md:grid-cols-3 xl:grid-cols-4"',
    );
  });
});

function createCollection(): LibraryCollection {
  return {
    books: [
      {
        authors: ["Marcus Aurelius"],
        completionPercent: 42,
        coverImageDataUrl: null,
        lastReadAt: "2026-04-08T10:00:00.000Z",
        libraryItemId: "library-1",
        primaryFormat: "EPUB",
        title: "Meditations",
      },
      {
        authors: ["Plato"],
        completionPercent: 100,
        coverImageDataUrl: null,
        lastReadAt: "2026-04-06T10:00:00.000Z",
        libraryItemId: "library-2",
        primaryFormat: "EPUB",
        title: "The Republic",
      },
      {
        authors: ["Epictetus"],
        completionPercent: 12,
        coverImageDataUrl: null,
        lastReadAt: "2026-04-05T10:00:00.000Z",
        libraryItemId: "library-3",
        primaryFormat: "EPUB",
        title: "Discourses",
      },
    ],
    description: "Your personal uploads.",
    id: "collection-1",
    itemCount: 3,
    kind: "CUSTOM",
    name: "Imported Books",
    unreadCount: 2,
  };
}
