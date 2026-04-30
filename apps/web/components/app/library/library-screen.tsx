import type { ReactNode } from "react";
import type { LibraryPayload } from "@/lib/api-types";
import {
  CollectionSection,
  CollectionSectionSkeleton,
} from "@/components/app/library/library-sections/collection-section";
import { LibraryEmptyState } from "@/components/app/library/library-sections/empty-state";
import {
  LibraryHeaderBar,
  LibraryHeaderBarSkeleton,
} from "@/components/app/library/library-sections/header-bar";

type LibraryScreenProps = {
  library: LibraryPayload;
};

export function LibraryScreen({ library }: LibraryScreenProps) {
  const hasBooks = library.collections.some(
    (collection) => collection.books.length > 0,
  );
  const isEmpty = library.collections.length === 0 || !hasBooks;

  return (
    <LibraryScreenShell>
      <LibraryHeaderBar summary={library.summary} />

      {isEmpty ? (
        <LibraryEmptyState />
      ) : (
        <div className="space-y-12 md:space-y-14">
          {library.collections.map((collection) => (
            <CollectionSection key={collection.id} collection={collection} />
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
