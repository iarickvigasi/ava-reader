"use client";

import type { ReactNode } from "react";
import type {
  LibraryCollection,
  LibraryPayload,
} from "@/lib/api-types";
import {
  CollectionSection,
  CollectionSectionSkeleton,
} from "@/components/app/library/library-sections/collection-section";
import { LibraryEmptyState } from "@/components/app/library/library-sections/empty-state";
import {
  LibraryHeaderBar,
  LibraryHeaderBarSkeleton,
} from "@/components/app/library/library-sections/header-bar";
import { useLibraryView } from "@/features/offline/buckets/library";
import type {
  CollectionView,
  LibraryBookView,
} from "@/features/offline/buckets/library";

type LibraryScreenProps = {
  // Initial payload from the RSC page. Used as the fallback render until the
  // bucket finishes hydrating from Dexie. Hydration itself runs in a sibling
  // <LibraryHydrator> mounted by the page — this keeps the screen testable
  // without a ClerkProvider in scope.
  library: LibraryPayload;
};

export function LibraryScreen({ library }: LibraryScreenProps) {
  const view = useLibraryView();

  // Until the bucket has hydrated (sync read of Dexie completes), fall back
  // to the RSC payload so the first paint matches what the server rendered.
  // After that the bucket is the source of truth.
  const collections: CollectionLike[] = view
    ? view.collections
    : library.collections;
  const summary = view?.summary ?? library.summary;

  const hasBooks = collections.some((collection) => collection.books.length > 0);
  const isEmpty = collections.length === 0 || !hasBooks;

  return (
    <LibraryScreenShell>
      <LibraryHeaderBar summary={summary} />

      {isEmpty ? (
        <LibraryEmptyState />
      ) : (
        <div className="space-y-12 md:space-y-14">
          {collections.map((collection) => (
            <CollectionSection
              key={collection.id}
              collection={toLibraryCollection(collection)}
            />
          ))}
        </div>
      )}
    </LibraryScreenShell>
  );
}

export function LibraryScreenSkeleton() {
  return (
    <LibraryScreenShell>
      <LibraryHeaderBarSkeleton />

      <div className="space-y-12 md:space-y-14">
        {Array.from({ length: 3 }, (_, index) => (
          <CollectionSectionSkeleton key={index} />
        ))}
      </div>
    </LibraryScreenShell>
  );
}

function LibraryScreenShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-6 md:pb-14 md:pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-10 md:space-y-12">
        {children}
      </div>
    </div>
  );
}

// CollectionSection still expects the server payload shape. The bucket's
// CollectionView is structurally compatible — same id/name/books — but the
// books are LibraryBookView, which trims some metadata. The downstream
// `LibraryBookCard` only reads the LibraryCardBook fields, all of which are
// preserved, so this widening is safe. (Phase 2 will switch downstream to
// `LibraryBookView` directly and drop the conversion.)
type CollectionLike = CollectionView | LibraryCollection;

function toLibraryCollection(
  collection: CollectionLike,
): LibraryCollection {
  return collection as LibraryCollection;
}

// Re-export for the book-card path that hasn't been migrated yet.
export type { LibraryBookView };
