import Link from "next/link";
import type { LibraryPayload } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { formatAuthors } from "@/lib/format-authors";
import { BookCover } from "@/components/app/shared/book-cover";
import { getLibraryBookInfoHref } from "@/lib/app-routes";

type LibraryBookCardProps = {
  book: LibraryPayload["collections"][number]["books"][number];
  collectionId?: string;
  mobile?: boolean;
};

export function LibraryBookCard({
  book,
  collectionId,
  mobile = false,
}: LibraryBookCardProps) {
  return (
    <Link
      href={getLibraryBookInfoHref(book.libraryItemId, {
        fromCollectionId: collectionId,
      })}
      className={cn(
        "group block shrink-0 transition hover:-translate-y-0.5",
        mobile ? "w-43.5" : "w-full",
      )}
    >
      <div className="space-y-3">
        <BookCover
          alt={`${book.title} cover`}
          className={cn(
            "aspect-[0.666] w-full rounded-[3px] border-0 bg-paper-strong",
            book.coverImageDataUrl ? "shadow-(--shadow-card)" : "",
            mobile ? "max-w-43.5" : "max-w-61.5",
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
            {formatAuthors(book.authors)}
          </p>
        </div>
      </div>
    </Link>
  );
}

type BookCardSkeletonProps = {
  mobile?: boolean;
};

export function BookCardSkeleton({ mobile = false }: BookCardSkeletonProps) {
  return (
    <div className={cn("shrink-0", mobile ? "w-43.5" : "w-full")}>
      <div className="space-y-3">
        <div
          className={cn(
            "aspect-[0.666] w-full animate-pulse rounded-[3px] bg-paper-strong",
            mobile ? "max-w-43.5" : "max-w-61.5",
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
