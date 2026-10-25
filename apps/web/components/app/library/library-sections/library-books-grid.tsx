"use client";

import { useTranslations } from "next-intl";
import type { LibraryCollectionBook } from "@/lib/api-types/library";
import { useProgressiveBooks } from "@/features/library/use-progressive-books";
import { Button } from "@/components/ui/button";
import { LibraryBookCard } from "../shared/book-card";

export function LibraryBooksGrid({
  books = [],
}: {
  books?: LibraryCollectionBook[];
}) {
  const t = useTranslations("library.collection");
  const { visible, hasMore, showMore } = useProgressiveBooks(books);
  if (!books.length) return null;
  return (
    <section className="space-y-6" aria-label={t("generalBooks")}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-8 xl:grid-cols-4">
        {visible.map((book) => (
          <LibraryBookCard key={book.libraryItemId} book={book} />
        ))}
      </div>
      {hasMore && (
        <Button variant="soft" onClick={showMore}>
          {t("showMore")}
        </Button>
      )}
    </section>
  );
}
