"use client";

import { useTranslations } from "next-intl";
import type { LibraryBookInfo } from "@/lib/api-types";
import { useComposedBookMinutesRead } from "@/features/offline/stats";
import { useBookInfoFormatters } from "./formatters";

type MetadataEntry = {
  id: string;
  label: string;
  value: string;
};

export function useBookMetadata(book: LibraryBookInfo): MetadataEntry[] {
  const t = useTranslations("library.bookInfo.metadata");
  const fmt = useBookInfoFormatters();
  // Add local reading time not yet covered by this book's server snapshot.
  const minutesRead = useComposedBookMinutesRead(
    book.libraryItemId,
    book.minutesRead,
    book.readingSnapshot,
  );
  return [
    {
      id: "language",
      label: t("language"),
      value: fmt.formatBookLanguage(book.language),
    },
    {
      id: "format",
      label: t("format"),
      value: fmt.formatPrimaryFormat(book.primaryFormat),
    },
    {
      id: "inLibrarySince",
      label: t("inLibrarySince"),
      value: fmt.formatDate(book.addedAt),
    },
    {
      id: "published",
      label: t("published"),
      value: book.publishedYear ? `${book.publishedYear}` : t("unknown"),
    },
    {
      id: "readingTime",
      // Estimate from body pages; the page count below includes the whole book.
      label: t("readingTime"),
      value: fmt.formatReadingTime(
        minutesRead,
        book.approximateBodyPageCount ?? book.approximatePageCount,
      ),
    },
    {
      id: "pageCount",
      label: t("pageCount"),
      value: fmt.formatApproximatePageCount(book.approximatePageCount),
    },
  ];
}
