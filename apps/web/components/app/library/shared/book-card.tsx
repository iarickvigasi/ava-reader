import { PdfImportStatus } from "@/components/app/shared/pdf-import/status";
export { BookCardSkeleton } from "./book-card-skeleton";
import Link from "next/link";
import type { LibraryPayload } from "@/lib/api-types";
import { resolveApiAssetUrl } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatAuthors } from "@/lib/format-authors";
import { BookCover } from "@/components/app/shared/book-cover";
import { getLibraryBookInfoHref } from "@/lib/app-routes";

const CARD_LAYOUT = "row-span-2 grid grid-cols-1 grid-rows-subgrid gap-3";

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
          libraryItemId={book.libraryItemId}
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
        <PdfImportStatus status={book.pdfImport} />
      </div>
    </Link>
  );
}
