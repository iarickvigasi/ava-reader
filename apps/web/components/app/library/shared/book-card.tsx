import Link from "next/link";
import type { LibraryPayload } from "@/lib/api-types";
import { resolveApiAssetUrl } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatAuthors } from "@/lib/format-authors";
import { BookCover } from "@/components/app/shared/book-cover";
import { getLibraryBookInfoHref } from "@/lib/app-routes";

// Covers stand on a shared shelf line. Each card is a two-row subgrid of its
// container, so the cover track is as tall as the tallest cover in that row and
// every cover aligns to its bottom edge — which also lands all the titles on
// one line. Both need the container's own tracks, hence subgrid rather than
// per-card sizing; a fixed cover box would have to be tall enough for the
// narrowest cover and would leave the rest floating in dead space.
const CARD_LAYOUT = "row-span-2 grid grid-rows-subgrid gap-3";

type LibraryBookCardProps = {
  book: LibraryPayload["collections"][number]["books"][number];
  collectionSlug?: string;
  mobile?: boolean;
};

export function LibraryBookCard({
  book,
  collectionSlug,
  mobile = false,
}: LibraryBookCardProps) {
  return (
    <Link
      href={getLibraryBookInfoHref(book.slug, {
        card: book,
        fromCollectionSlug: collectionSlug,
      })}
      className={cn(
        CARD_LAYOUT,
        "group shrink-0 transition hover:-translate-y-0.5",
        mobile ? "w-43.5" : "w-full",
      )}
    >
      <div className="flex items-end">
        <BookCover
          alt={`${book.title} cover`}
          className={cn(
            "w-full",
            book.coverImageUrl ? "shadow-(--shadow-card)" : "",
            mobile ? "max-w-43.5" : "max-w-61.5",
          )}
          src={resolveApiAssetUrl(book.coverImageUrl)}
          title={book.title}
        />
      </div>
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
          {formatAuthors(book.authors)}
        </p>
      </div>
    </Link>
  );
}

type BookCardSkeletonProps = {
  mobile?: boolean;
};

export function BookCardSkeleton({ mobile = false }: BookCardSkeletonProps) {
  return (
    <div
      className={cn(CARD_LAYOUT, "shrink-0", mobile ? "w-43.5" : "w-full")}
    >
      <div className="flex items-end">
        <div
          className={cn(
            "aspect-2/3 w-full animate-pulse rounded-cover bg-paper-strong",
            mobile ? "max-w-43.5" : "max-w-61.5",
          )}
        />
      </div>
      <div className="space-y-2">
        <div className="h-8 w-4/5 animate-pulse rounded bg-paper-strong" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-paper-strong" />
      </div>
    </div>
  );
}
