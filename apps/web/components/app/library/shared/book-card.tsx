import type { LibraryCardBook } from "@/lib/api-types/library";
import { resolveApiAssetUrl } from "@/lib/api";
import { getLibraryBookInfoHref } from "@/lib/app-routes";
import { BookCard } from "@/components/app/shared/books/book-card";
export { BookCardSkeleton } from "@/components/app/shared/books/book-card-skeleton";

export function LibraryBookCard({
  book,
  collectionSlug,
  mobile = false,
}: {
  book: LibraryCardBook;
  collectionSlug?: string;
  mobile?: boolean;
}) {
  return (
    <BookCard
      title={book.title}
      authors={book.authors.map((name) => ({ name }))}
      href={getLibraryBookInfoHref(book.slug, {
        card: book,
        fromCollectionSlug: collectionSlug,
      })}
      libraryItemId={book.libraryItemId}
      progressLabel={`${Math.round(book.completionPercent)}%`}
      coverImageUrl={resolveApiAssetUrl(book.coverImageUrl)}
      mobile={mobile}
    />
  );
}
