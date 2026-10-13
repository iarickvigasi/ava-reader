"use client";

import type { ReactNode } from "react";
import { ScreenContainer } from "@/components/ui/screen-container";
import type { LibraryCollection, LibraryPayload } from "@/lib/api-types";
import {
  CollectionSection,
  CollectionSectionSkeleton,
} from "@/components/app/library/library-sections/collection-section";
import { LibraryFeaturesSection } from "./library-sections/library-features-section";
import { LibraryHeader } from "@/components/app/library/library-sections/library-header";
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

  const hasBooks = collections.some(
    (collection) => collection.books.length > 0,
  );
  const isEmpty =
    !hasBooks &&
    !collections.some((collection) => collection.kind === "CUSTOM");

  return (
    <LibraryScreenShell>
      <LibraryHeader hasBooks={summary.booksCount > 0} />
      <LibraryFeaturesSection />
      <LibraryHeaderBar summary={summary} />

      {!isEmpty && (
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
      <LibraryHeader />
      <LibraryFeaturesSection />
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
    <ScreenContainer className="gap-10 py-10 sm:gap-16 sm:py-16">
      {children}
    </ScreenContainer>
  );
}

// Bucket book views preserve the card fields consumed by CollectionSection.
type CollectionLike = CollectionView | LibraryCollection;

function toLibraryCollection(collection: CollectionLike): LibraryCollection {
  return collection as LibraryCollection;
}

// Re-export for the book-card path that hasn't been migrated yet.
export type { LibraryBookView };
