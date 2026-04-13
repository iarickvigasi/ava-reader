import Link from "next/link";
import type { LibraryCollection } from "@/lib/api-types";
import { LibraryCollectionActions } from "./library-collection-actions";
import { LibraryBookCard } from "./library-book-card";

type LibraryCollectionScreenProps = {
  collection: LibraryCollection;
};

export function LibraryCollectionScreen({ collection }: LibraryCollectionScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-6 md:pb-14 md:pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-[1280px] space-y-8 md:space-y-10">
        <section className="space-y-4">
          <Link
            href="/app/library"
            className="inline-flex text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-brand-fill hover:text-brand-fill-strong"
          >
            Back to Library
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
                <h1
                  className="font-sans text-[1.9rem] font-medium leading-[1.05] tracking-[-0.03em] text-title md:text-[2rem]">
                  {collection.name}
                </h1>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-olive md:pb-1">
                  {collection.itemCount} items • {collection.unreadCount} unread
                </p>
              </div>
              {collection.description ? (
                <p className="max-w-3xl text-base leading-6 text-copy">
                  {collection.description}
                </p>
              ) : null}
            </div>
            <LibraryCollectionActions
              collectionDescription={collection.description}
              collectionId={collection.id}
              collectionName={collection.name}
            />
          </div>
        </section>

        {collection.books.length === 0 ? (
          <div className="rounded-[22px] border border-line/30 bg-paper-strong/70 px-5 py-6 text-base leading-7 text-copy">
            No books are in this collection yet.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:hidden">
              {collection.books.map((book) => (
                <LibraryBookCard
                  key={book.libraryItemId}
                  book={book}
                  collectionId={collection.id}
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
      </div>
    </div>
  );
}
