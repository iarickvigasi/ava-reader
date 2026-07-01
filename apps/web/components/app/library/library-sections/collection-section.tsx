import Link from "next/link";
import { useTranslations } from "next-intl";
import type { LibraryPayload } from "@/lib/api-types";
import { getCollectionHref } from "@/lib/app-routes";
import { useCollectionDisplay } from "../shared/collection-display";
import { BookCardSkeleton, LibraryBookCard } from "../shared/book-card";

type CollectionSectionProps = {
  collection: LibraryPayload["collections"][number];
};

export function CollectionSection({ collection }: CollectionSectionProps) {
  const t = useTranslations("library.collection");
  const collectionDisplay = useCollectionDisplay();
  const description = collectionDisplay.description(collection);
  return (
    <section className="space-y-5 md:space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
            <h2 className="font-sans text-[1.9rem] font-medium leading-[1.05] tracking-[-0.03em] text-title md:text-[2rem]">
              {collectionDisplay.name(collection)}
            </h2>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-olive md:pb-1">
              {t("itemsAndUnread", {
                items: collection.itemCount,
                unread: collection.unreadCount,
              })}
            </p>
          </div>
          {description ? (
            <p className="max-w-2xl text-base leading-6 text-copy">
              {description}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <Link
            href={getCollectionHref(collection.slug)}
            className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-brand-fill"
          >
            {t("viewAll")}
          </Link>
        </div>
      </div>

      {collection.books.length === 0 ? (
        <div className="rounded-card bg-paper-strong/70 px-5 py-6 text-base leading-7 text-copy">
          {t("noBooksYet")}
        </div>
      ) : (
        <>
          <div className="flex gap-4 overflow-x-auto pb-2 md:hidden">
            {collection.books.map((book) => (
              <LibraryBookCard
                key={book.libraryItemId}
                book={book}
                collectionSlug={collection.slug}
                mobile
              />
            ))}
          </div>

          <div className="hidden gap-x-8 gap-y-6 md:grid md:grid-cols-3 xl:grid-cols-4">
            {collection.books.map((book) => (
              <LibraryBookCard
                key={book.libraryItemId}
                book={book}
                collectionSlug={collection.slug}
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
