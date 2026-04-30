import type { LibraryBookInfo } from "@/lib/api-types";
import {
  formatApproximatePageCount,
  formatBookLanguage,
  formatDate,
  formatPrimaryFormat,
  formatReadingTime,
} from "./formatters";

type BookMetadataProps = {
  book: LibraryBookInfo;
};

type MetadataEntry = {
  label: string;
  value: string;
};

export function BookMetadata({ book }: BookMetadataProps) {
  const entries: MetadataEntry[] = [
    {
      label: "Language",
      value: formatBookLanguage(book.language),
    },
    {
      label: "Format",
      value: formatPrimaryFormat(book.primaryFormat),
    },
    {
      label: "In library since",
      value: formatDate(book.addedAt),
    },
    {
      label: "Published",
      value: book.publishedYear ? `${book.publishedYear}` : "Unknown",
    },
    {
      label: "Reading time",
      value: formatReadingTime(book.minutesRead, book.approximatePageCount),
    },
    {
      label: "Page count",
      value: formatApproximatePageCount(book.approximatePageCount),
    },
  ];

  return (
    <section className="grid grid-cols-3 gap-x-6 gap-y-6 border-t border-line/30 pt-6 md:gap-x-10">
      {entries.map((entry) => (
        <MetadataCell
          key={entry.label}
          label={entry.label}
          value={entry.value}
        />
      ))}
    </section>
  );
}

function MetadataCell({ label, value }: MetadataEntry) {
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
