"use client";

import { MetadataItem } from "@/components/app/shared/books/metadata-item";
import type { LibraryBookInfo } from "@/lib/api-types";
import { useBookMetadata } from "./use-book-metadata";

export function BookMetadata({ book }: { book: LibraryBookInfo }) {
  const entries = useBookMetadata(book);
  return (
    <section className="grid grid-cols-3 gap-x-6 gap-y-6 border-t border-line/30 pt-6 md:gap-x-10">
      {entries.map((entry) => (
        <MetadataItem key={entry.id} label={entry.label} value={entry.value} />
      ))}
    </section>
  );
}
