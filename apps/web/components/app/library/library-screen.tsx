"use client";

import type { LibraryPayload } from "@/lib/api-types";
import { CollectionSection } from "@/components/app/library/library-sections/collection-section";
import { LibraryFeaturesSection } from "./library-sections/library-features-section";
import { LibraryHeader } from "@/components/app/library/library-sections/library-header";
import { LibraryEmptyState } from "./library-sections/library-empty-state";
import { LibraryHeaderBar } from "@/components/app/library/library-sections/header-bar";
import { LibraryBooksGrid } from "./library-sections/library-books-grid";
import { LibraryScreenShell } from "./library-screen-shell";
export { LibraryScreenSkeleton } from "./library-screen-skeleton";

import { LibraryFilterPills } from "./library-filter-pills";
import { BooksNoResults } from "@/components/app/shared/books-no-results";

import { useLibraryScreen } from "@/features/library/use-library-screen";

type LibraryScreenProps = {
  // Initial payload from the RSC page. Used as the fallback render until the
  // bucket finishes hydrating from Dexie. Hydration itself runs in a sibling
  // <LibraryHydrator> mounted by the page — this keeps the screen testable
  // without a ClerkProvider in scope.
  library: LibraryPayload;
};

export function LibraryScreen({ library }: LibraryScreenProps) {
  const { collections, summary, books, isEmpty, filters, toggle, noMatches } =
    useLibraryScreen(library);

  return (
    <LibraryScreenShell>
      <LibraryHeader />
      <LibraryFeaturesSection />
      <div className="min-w-0 space-y-6">
        <LibraryHeaderBar summary={summary} />
        <LibraryFilterPills filters={filters} toggle={toggle} />
      </div>
      {noMatches && summary.booksCount > 0 && <BooksNoResults />}
      {summary.booksCount === 0 && <LibraryEmptyState />}

      {!isEmpty && (
        <div className="space-y-12 md:space-y-14">
          <LibraryBooksGrid key={filters.join(",")} books={books} />
          {collections.map((collection) => (
            <CollectionSection key={collection.id} collection={collection} />
          ))}
        </div>
      )}
    </LibraryScreenShell>
  );
}

export type { LibraryBookView } from "@/features/offline/buckets/library";
