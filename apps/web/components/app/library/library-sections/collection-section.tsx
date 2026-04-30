import Link from "next/link";
import type { LibraryPayload } from "@/lib/api-types";
import { BookCardSkeleton, LibraryBookCard } from "../shared/book-card";

type CollectionSectionProps = {
  collection: LibraryPayload["collections"][number];
};

export function CollectionSection({ collection }: CollectionSectionProps) {
  return (
    <section className="space-y-5 md:space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
            <h2 className="font-sans text-[1.9rem] font-medium leading-[1.05] tracking-[-0.03em] text-title md:text-[2rem]">
              {collection.name}
            </h2>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-olive md:pb-1">
              {collection.itemCount} items • {collection.unreadCount} unread
            </p>
          </div>
          {collection.description ? (
            <p className="max-w-2xl text-base leading-6 text-copy">
              {collection.description}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <Link
            href={`/app/library/collections/${collection.id}`}
            className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-brand-fill"
          >
            View all
          </Link>
        </div>
      </div>

      {collection.books.length === 0 ? (
        <div className="rounded-[22px] border border-line/30 bg-paper-strong/70 px-5 py-6 text-base leading-7 text-copy">
          No books are in this collection yet.
        </div>
      ) : (
        <>
          <div className="flex gap-4 overflow-x-auto pb-2 md:hidden">
            {collection.books.map((book) => (
              <LibraryBookCard
                key={book.libraryItemId}
                book={book}
                collectionId={collection.id}
                mobile
              />
            ))}
          </div>

          <div className="hidden gap-x-8 gap-y-6 md:grid md:grid-cols-3 xl:grid-cols-4">
            {collection.books.map((book) => (
              <LibraryBookCard
                key={book.libraryItemId}
                book={book}
                collectionId={collection.id}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function CollectionSectionSkeleton() {
  return (
    <section className="space-y-5 md:space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
            <div className="h-9 w-56 animate-pulse rounded bg-paper-strong md:h-10" />
            <div className="h-4 w-32 animate-pulse rounded bg-paper-strong sm:mb-1" />
          </div>
          <div className="h-5 w-72 max-w-full animate-pulse rounded bg-paper-strong" />
        </div>
        <div className="hidden h-4 w-16 animate-pulse rounded bg-paper-strong md:block" />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <BookCardSkeleton key={index} mobile />
        ))}
      </div>

      <div className="hidden gap-x-8 gap-y-6 md:grid md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <BookCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}
