import { useTranslations } from "next-intl";
import type { LibraryBookInfo } from "@/lib/api-types";
import { useBookInfoFormatters } from "./formatters";

type BookMetadataProps = {
  book: LibraryBookInfo;
};

type MetadataEntry = {
  id: string;
  label: string;
  value: string;
};

export function BookMetadata({ book }: BookMetadataProps) {
  const t = useTranslations("library.bookInfo.metadata");
  const fmt = useBookInfoFormatters();
  const entries: MetadataEntry[] = [
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
      label: t("readingTime"),
      value: fmt.formatReadingTime(book.minutesRead, book.approximatePageCount),
    },
    {
      id: "pageCount",
      label: t("pageCount"),
      value: fmt.formatApproximatePageCount(book.approximatePageCount),
    },
  ];

  return (
    <section className="grid grid-cols-3 gap-x-6 gap-y-6 border-t border-line/30 pt-6 md:gap-x-10">
      {entries.map((entry) => (
        <MetadataCell
          key={entry.id}
          label={entry.label}
          value={entry.value}
        />
      ))}
    </section>
  );
}

function MetadataCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">
        {label}
      </p>
      <p className="mt-1.5 font-reader text-lg leading-7 text-copy-strong">
        {value}
      </p>
    </div>
  );
}
