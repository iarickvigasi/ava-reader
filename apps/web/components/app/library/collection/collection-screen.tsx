"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { LibraryCollection } from "@/lib/api-types";
import { useCollectionView } from "@/features/offline/buckets/library";
import { LibraryCollectionActions } from "./collection-actions/collection-actions";
import { useCollectionDisplay } from "../shared/collection-display";
import { LibraryBookCard } from "../shared/book-card";

type LibraryCollectionScreenProps = {
  // Initial payload from the RSC page. Used as the SSR fallback until the
  // bucket finishes hydrating from Dexie. Hydration itself runs in a
  // sibling <CollectionHydrator> mounted by the page — this keeps the
  // screen testable without a ClerkProvider in scope.
  collection: LibraryCollection;
};

export function LibraryCollectionScreen({
  collection,
}: LibraryCollectionScreenProps) {
  const t = useTranslations("library.collection");
  const collectionDisplay = useCollectionDisplay();

  // Prefer the bucket view (kept in sync via revalidation + cross-feature
  // updates); fall back to the RSC payload so the first paint matches what
  // the server rendered.
  const fromBucket = useCollectionView(collection.slug);
  const effective = fromBucket
    ? toLibraryCollection(fromBucket, collection)
    : collection;

  const displayName = collectionDisplay.name(effective);
  const displayDescription = collectionDisplay.description(effective);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-6 md:pb-14 md:pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-8 md:space-y-10">
        <section className="space-y-4">
          <Link
            href="/app/library"
            className="inline-flex text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-brand-fill hover:text-brand-fill-strong"
          >
            {t("backToLibrary")}
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
                <h1
                  className="font-sans text-[1.9rem] font-medium leading-[1.05] tracking-[-0.03em] text-title md:text-[2rem]">
                  {displayName}
                </h1>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-olive md:pb-1">
                  {t("itemsAndUnread", {
                    items: effective.itemCount,
                    unread: effective.unreadCount,
                  })}
                </p>
              </div>
              {displayDescription ? (
                <p className="max-w-3xl text-base leading-6 text-copy">
                  {displayDescription}
                </p>
              ) : null}
            </div>
            <LibraryCollectionActions
              collectionDescription={effective.description}
              collectionId={effective.id}
              collectionKind={effective.kind}
              collectionName={displayName}
            />
          </div>
        </section>

        {effective.books.length === 0 ? (
          <div className="rounded-card bg-paper-strong/70 px-5 py-6 text-base leading-7 text-copy">
            {t("noBooksYet")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:hidden">
              {effective.books.map((book) => (
                <LibraryBookCard
                  key={book.libraryItemId}
                  book={book}
                  collectionSlug={effective.slug}
                />
              ))}
            </div>

            <div className="hidden gap-x-8 gap-y-6 md:grid md:grid-cols-3 xl:grid-cols-4">
              {effective.books.map((book) => (
                <LibraryBookCard
                  key={book.libraryItemId}
                  book={book}
                  collectionSlug={effective.slug}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Bridge bucket view → server payload shape. The downstream LibraryBookCard
// only reads `LibraryCardBook` fields, all of which the bucket preserves.
// Description/itemCount/etc. come straight off the bucket row.
function toLibraryCollection(
  view: ReturnType<typeof useCollectionView> & {},
  initial: LibraryCollection,
): LibraryCollection {
  return {
    ...initial,
    id: view.id,
    slug: view.slug,
    kind: view.kind,
    name: view.name,
    description: view.description,
    smartKey: view.smartKey,
    itemCount: view.itemCount,
    unreadCount: view.unreadCount,
    books: view.books.map((book) => ({
      libraryItemId: book.libraryItemId,
      slug: book.slug,
      title: book.title,
      authors: book.authors,
      coverImageUrl: book.coverImageUrl,
      completionPercent: book.completionPercent,
      // The bucket trims primaryFormat to string for storage; cast back to
      // the BookFileFormat union. Values stored were always one of the
      // valid enum members so the runtime is sound.
      primaryFormat: book.primaryFormat as LibraryCollection["books"][number]["primaryFormat"],
      lastReadAt: book.lastReadAt ?? "",
    })),
  };
}
