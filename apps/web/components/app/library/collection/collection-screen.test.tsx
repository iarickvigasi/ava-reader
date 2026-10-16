import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryCollectionScreen } from "./collection-screen";
import type { LibraryCollection } from "@/lib/api-types";
import type { CollectionView } from "@/features/offline/buckets/library/types";
import { withIntl } from "@/lib/test-utils/intl";

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


const bucket = vi.hoisted(() => ({ view: null as CollectionView | null }));
vi.mock("@/features/offline/buckets/library", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/offline/buckets/library")>(),
  useCollectionView: () => bucket.view,
}));
beforeEach(() => { bucket.view = null; });

describe("library collection detail UI", () => {
  it.each(["PENDING", "FAILED", "READY"] as const)(
    "keeps hydrated native EPUB %s status when the initial collection is stale",
    (status) => {
      const initial = createCollection();
      bucket.view = {
        ...initial,
        books: [{
          ...initial.books[0],
          savedOffline: false,
          offlineRequested: false,
          epubImport: { status, runId: "fixture-run", updatedAt: "2026-10-16T00:00:00Z", finalContentId: status === "READY" ? "finished" : null },
        }],
      };
      const markup = renderToStaticMarkup(withIntl(<LibraryCollectionScreen collection={initial} />));
      if (status === "PENDING") expect(markup).toContain("Preparing");
      if (status === "FAILED") expect(markup).toContain("Preparation failed");
      if (status === "READY") {
        expect(markup).not.toContain("Preparing");
        expect(markup).not.toContain("Preparation failed");
      }
    },
  );
  it("keeps failed PDF status on the hydrated collection card", () => {
    const initial = createCollection();
    bucket.view = {
      ...initial,
      books: [{
        ...initial.books[0], savedOffline: false, offlineRequested: false,
        pdfImport: { status: "FAILED", finalContentId: null, operationId: "fixture-op", libraryItemId: "library-1", stage: "VALIDATION", generation: 1, updatedAt: "2026-10-16T00:00:00Z", sourceArtifactId: "fixture-source", failureId: "fixture-failure", investigationRecorded: true, progress: null },
      }],
    };
    const markup = renderToStaticMarkup(withIntl(<LibraryCollectionScreen collection={initial} />));
    expect(markup).toContain("Failed · Last known status");
  });

  it("renders all books in a collection and back navigation", () => {
    const markup = renderToStaticMarkup(
      withIntl(<LibraryCollectionScreen collection={createCollection()} />),
    );

    expect(markup).toContain('href="/app/library"');
    // Hrefs include card snapshot params (title/author/cover/liid/…) so
    // the next page can render from URL state. Assert correct slug +
    // correct fromCollection rather than pinning the exact tail.
    expect(markup).toMatch(
      /href="\/app\/library\/books\/meditations-by-marcus-aurelius\?[^"]*fromCollection=imported-books/,
    );
    expect(markup).toMatch(
      /href="\/app\/library\/books\/the-republic-by-plato\?[^"]*fromCollection=imported-books/,
    );
    expect(markup).toMatch(
      /href="\/app\/library\/books\/discourses-by-epictetus\?[^"]*fromCollection=imported-books/,
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
        completionPercent: 12,
        coverImageUrl: null,
        lastReadAt: "2026-04-05T10:00:00.000Z",
        libraryItemId: "library-3",
        primaryFormat: "EPUB",
        slug: "discourses-by-epictetus",
        title: "Discourses",
      },
    ],
    description: "Your personal uploads.",
    id: "collection-1",
    itemCount: 3,
    kind: "CUSTOM",
    name: "Imported Books",
    slug: "imported-books",
    smartKey: null,
    unreadCount: 2,
  };
}
