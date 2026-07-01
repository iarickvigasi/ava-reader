"use client";

import type { LibraryBookInfo } from "@/lib/api-types";
import { useBookInfo } from "@/features/offline/buckets/library";
import { BackLink } from "./back-link";
import { BookActionCards } from "./action-cards";
import { BookActions } from "./actions";
import { BookCoverPanel } from "./cover-panel";
import { BookDescription } from "./description";
import { BookHeader } from "./header";
import { BookMetadata } from "./metadata";
import { ReadingProgress } from "./reading-progress";

type LibraryBookInfoScreenProps = {
  backHref: string;
  // Initial payload from the RSC page. Used as the SSR-stable fallback;
  // useBookInfo swaps in the Dexie-cached row when it becomes available so
  // subsequent navigations / offline reloads still work.
  book: LibraryBookInfo;
};

export function LibraryBookInfoScreen({
  backHref,
  book: initial,
}: LibraryBookInfoScreenProps) {
  const book = useBookInfo(initial.slug, initial);
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-6 md:pb-14 md:pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-12 md:space-y-16">
        <section className="space-y-6 md:space-y-8">
          <BackLink backHref={backHref} />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-12">
            <BookCoverPanel
              coverImageUrl={book.coverImageUrl}
              title={book.title}
            />

            <div className="space-y-8">
              <BookHeader book={book} />
              <BookActions
                slug={book.slug}
                libraryItemId={book.libraryItemId}
              />
              <ReadingProgress book={book} />
              <BookMetadata book={book} />
            </div>
          </div>
        </section>

        <section className="grid gap-10 border-t border-line/30 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] lg:gap-12 lg:pt-14">
          <BookDescription description={book.description} />
          <BookActionCards
            collections={book.collections}
            libraryItemId={book.libraryItemId}
          />
        </section>
      </div>
    </div>
  );
}
