import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookCover } from "./book-cover";
import type { LibraryPayload } from "@/lib/api-types";
import { cn } from "@/lib/cn";

type LibraryScreenProps = {
  library: LibraryPayload;
};

export function LibraryScreen({ library }: LibraryScreenProps) {
  const hasBooks = library.collections.some(
    (collection) => collection.books.length > 0,
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-6 md:pb-14 md:pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-[1280px] space-y-10 md:space-y-12">
        <section>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
            <label className="block md:w-[352px] md:max-w-[352px] md:shrink-0">
            <span className="sr-only">Search library</span>
            <input
              aria-label="Search library"
              className="h-10 w-full rounded-[10px] border border-line/10 bg-paper-strong/90 px-4 text-[0.82rem] uppercase tracking-[0.14em] text-title outline-none placeholder:text-[#9a938d]"
              placeholder="Search"
              readOnly
              value=""
            />
          </label>

            <div className="flex items-center gap-5 sm:gap-8 md:gap-10">
              <SummaryMetric
                label="Collections"
                value={library.summary.collectionsCount}
              />
              <SummaryMetric label="Books" value={library.summary.booksCount} />
            </div>

            <Button
              type="button"
              variant="primary"
              className="min-h-10 w-full rounded-[10px] px-4 text-[0.72rem] uppercase tracking-[0.14em] shadow-[var(--shadow-nav)] md:ml-auto md:w-auto"
            >
              New collection
            </Button>
          </div>
        </section>

        {library.collections.length === 0 || !hasBooks ? (
          <LibraryEmptyState />
        ) : (
          <div className="space-y-12 md:space-y-14">
            {library.collections.map((collection) => (
              <CollectionSection key={collection.id} collection={collection} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function LibraryScreenSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-6 md:pb-14 md:pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-[1280px] space-y-10 md:space-y-12">
        <section>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
            <div className="h-10 w-full animate-pulse rounded-[10px] bg-paper-strong md:w-[352px] md:max-w-[352px] md:shrink-0" />

            <div className="flex items-center gap-5 sm:gap-8 md:gap-10">
              <SummaryMetricSkeleton />
              <SummaryMetricSkeleton />
            </div>

            <div className="h-10 w-full animate-pulse rounded-[10px] bg-paper-strong md:ml-auto md:w-34" />
          </div>
        </section>

        <div className="space-y-12 md:space-y-14">
          {Array.from({ length: 3 }, (_, index) => (
            <CollectionSectionSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CollectionSection({
  collection,
}: {
  collection: LibraryPayload["collections"][number];
}) {
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
        <div className="hidden text-right md:block">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-brand-fill">
            View all
          </p>
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
              <BookCard key={book.libraryItemId} book={book} mobile />
            ))}
          </div>

          <div className="hidden gap-x-8 gap-y-6 md:grid md:grid-cols-3 xl:grid-cols-4">
            {collection.books.map((book) => (
              <BookCard key={book.libraryItemId} book={book} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BookCard({
  book,
  mobile = false,
}: {
  book: LibraryPayload["collections"][number]["books"][number];
  mobile?: boolean;
}) {
  return (
    <Link
      href={`/app/read/${book.libraryItemId}`}
      className={cn(
        "group block shrink-0 transition hover:-translate-y-0.5",
        mobile ? "w-[174px]" : "w-full",
      )}
    >
      <div className="space-y-3">
        <BookCover
          alt={`${book.title} cover`}
          className={cn(
            "aspect-[0.666] w-full rounded-[3px] border-0 bg-paper-strong",
            book.coverImageDataUrl ? "shadow-(--shadow-card)" : "",
            mobile ? "max-w-[174px]" : "max-w-[246px]",
          )}
          src={book.coverImageDataUrl}
          title={book.title}
        />
        <div className="space-y-1">
          <h3
            className="overflow-hidden font-display text-[1.9rem] leading-[1.02] tracking-[-0.03em] text-title group-hover:text-ink md:text-[2rem]"
            style={{
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              display: "-webkit-box",
            }}
          >
            {book.title}
          </h3>
          <p className="text-[0.95rem] leading-5 text-plum md:text-base">
            {book.author ?? "Unknown author"}
          </p>
        </div>
      </div>
    </Link>
  );
}

function LibraryEmptyState() {
  return (
    <section className="rounded-[28px] bg-paper-strong/75 px-6 py-10 sm:px-8">
      <div className="max-w-2xl space-y-4">
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-brand-fill">
          Library
        </p>
        <h1 className="font-display text-4xl leading-[1.02] text-title sm:text-5xl">
          Your collections will appear here as you build your reading world.
        </h1>
        <p className="text-lg leading-8 text-copy">
          Import books or add them from the public catalog and AVA will start
          organizing them into personal collections.
        </p>
      </div>
    </section>
  );
}

function CollectionSectionSkeleton() {
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

function BookCardSkeleton({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={cn("shrink-0", mobile ? "w-[174px]" : "w-full")}>
      <div className="space-y-3">
        <div
          className={cn(
            "aspect-[0.666] w-full animate-pulse rounded-[3px] bg-paper-strong",
            mobile ? "max-w-[174px]" : "max-w-[246px]",
          )}
        />
        <div className="space-y-2">
          <div className="h-8 w-4/5 animate-pulse rounded bg-paper-strong" />
          <div className="h-5 w-2/3 animate-pulse rounded bg-paper-strong" />
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <p className="font-display text-[2rem] leading-none text-title md:text-[2.25rem]">
        {value}
      </p>
      <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
    </div>
  );
}

function SummaryMetricSkeleton() {
  return (
    <div>
      <div className="h-8 w-12 animate-pulse rounded bg-paper-strong md:h-9" />
      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-paper-strong" />
    </div>
  );
}
