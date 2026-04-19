import Link from "next/link";
import type { ReactElement, SVGProps } from "react";
import { BookCover } from "@/components/app/shared/book-cover";
import {
  CheckIcon,
  ReaderDownloadIcon,
  ReaderLibraryIcon,
  ReaderListeningIcon,
  StackBooksIcon,
  TrashIcon,
} from "@/components/app/shared/app-icons";
import { Button, ButtonLink } from "@/components/ui/button";
import type { LibraryBookInfo } from "@/lib/api-types";
import { formatAuthors } from "@/lib/format-authors";

type LibraryBookInfoScreenProps = {
  backHref: string;
  book: LibraryBookInfo;
};

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

type MetadataEntry = {
  label: string;
  value: string;
};

const ESTIMATED_PAGES_PER_HOUR = 30;

export function LibraryBookInfoScreen({
  backHref,
  book,
}: LibraryBookInfoScreenProps) {
  const progressPercent = clampPercent(book.completionPercent);
  const backLabel = backHref.includes("/collections/")
    ? "Back to Collection"
    : "Back to Library";
  const metadata: MetadataEntry[] = [
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
  const collectionLabel =
    book.collections.length > 0
      ? `${book.collections.length} collection${book.collections.length === 1 ? "" : "s"}`
      : "Not assigned";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-6 md:pb-14 md:pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-12 md:space-y-16">
        <section className="space-y-6 md:space-y-8">
          <Link
            href={backHref}
            className="inline-flex text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-brand-fill hover:text-brand-fill-strong"
          >
            {backLabel}
          </Link>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-12">
            <div className="relative mx-auto w-full max-w-80 md:max-w-96 lg:mx-0">
              <div className="absolute inset-[10px_-10px_-10px_10px] aspect-2/3 rounded-sm bg-ink/6"  />
              <BookCover
                alt={`${book.title} cover`}
                className="relative aspect-2/3 w-full rounded-sm border-0 bg-paper-strong shadow-(--shadow-card)"
                src={book.coverImageDataUrl}
                title={book.title}
              />
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {buildBookTags(book).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[11px] bg-paper-strong px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink/80"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="space-y-2">
                  <h1 className="font-display text-[3.2rem] leading-[0.96] tracking-[-0.03em] text-title md:text-[4.6rem]">
                    {book.title}
                  </h1>
                  <p className="font-reader text-xl text-plum md:text-[1.75rem]">
                    {formatAuthors(book.authors)}
                  </p>
                </div>
              </div>

              <div className="grid w-full max-w-120 grid-cols-2 gap-3">
                <ButtonLink
                  href={`/app/read/${book.libraryItemId}`}
                  className="min-h-12 w-full gap-2 rounded-[10px] px-6 text-sm font-semibold uppercase tracking-[0.12em]"
                >
                  <StackBooksIcon className="size-4" />
                  Read
                </ButtonLink>
                <Button
                  type="button"
                  variant="soft"
                  className="min-h-12 w-full gap-2 rounded-[10px] px-6 text-sm font-semibold uppercase tracking-[0.12em]"
                >
                  <ReaderListeningIcon className="size-4" />
                  Listen
                </Button>
              </div>

              <section className="space-y-3 border-t border-line/45 py-5">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-[0.63rem] font-semibold uppercase tracking-[0.18em] text-muted">
                    Reading progress
                  </p>
                  <p className="font-reader text-lg text-ink">
                    {progressPercent}% completed
                  </p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand/70">
                  <div
                    className="h-full rounded-full bg-brand-fill transition-[width] duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-sm italic text-olive">
                  {buildProgressLabel(book)}
                </p>
              </section>

              <section className="grid grid-cols-3 gap-x-6 gap-y-6 border-t border-line/30 pt-6 md:gap-x-10">
                {metadata.map((entry) => (
                  <MetadataCell
                    key={entry.label}
                    label={entry.label}
                    value={entry.value}
                  />
                ))}
              </section>
            </div>
          </div>
        </section>

        <section className="grid gap-10 border-t border-line/30 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] lg:gap-12 lg:pt-14">
          <article className="space-y-6">
            <h2 className="font-display text-4xl leading-none text-title md:text-5xl">
              About this book
            </h2>
            <div className="space-y-5">
              {buildDescriptionParagraphs(book.description).map((paragraph) => (
                <p
                  key={paragraph}
                  className="max-w-3xl font-reader text-[1.12rem] leading-[1.65] text-copy"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </article>

          <aside className="space-y-4">
            <ActionCard
              description="PDF & EPUB"
              icon={ReaderDownloadIcon}
              title="Download Offline"
            />
            <ActionCard
              description="Set progress to 100%"
              icon={CheckIcon}
              title="Mark as Finished"
            />
            <ActionCard
              description={collectionLabel}
              icon={ReaderLibraryIcon}
              title="Manage Collections"
            />
            <ActionCard
              danger
              description="No action yet"
              icon={TrashIcon}
              title="Delete Book"
            />
          </aside>
        </section>
      </div>
    </div>
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

function ActionCard({
  danger = false,
  description,
  icon: Icon,
  title,
}: {
  danger?: boolean;
  description: string;
  icon: IconComponent;
  title: string;
}) {
  return (
    <button
      type="button"
      className="w-full rounded-[15px] bg-paper-strong/80 px-4 py-3 text-left transition hover:bg-paper-strong"
    >
      <span className="flex items-start gap-3">
        <span
          className={danger ? "pt-1 text-danger" : "pt-1 text-brand-fill"}
          aria-hidden
        >
          <Icon className="size-4.5" />
        </span>
        <span className="min-w-0">
          <span
            className={
              danger
                ? "block font-reader text-[1.55rem] leading-[1.1] text-danger"
                : "block font-reader text-[1.55rem] leading-[1.1] text-title"
            }
          >
            {title}
          </span>
          <span className="mt-1 block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">
            {description}
          </span>
        </span>
      </span>
    </button>
  );
}

function buildBookTags(book: LibraryBookInfo) {
  if (!Array.isArray(book.genres)) {
    return [];
  }

  return book.genres
    .map((genre) => genre.trim())
    .filter((genre) => genre.length > 0);
}

function buildProgressLabel(book: LibraryBookInfo) {
  if (book.chapterLabel && book.lastReadAt) {
    return `Last read: ${book.chapterLabel} - ${formatDate(book.lastReadAt)}`;
  }

  if (book.chapterLabel) {
    return `Last read: ${book.chapterLabel}`;
  }

  if (book.lastReadAt) {
    return `Last read: ${formatDate(book.lastReadAt)}`;
  }

  return "";
}

function buildDescriptionParagraphs(description: null | string) {
  const content = description?.trim();

  if (!content) {
    return [
      "This title is in your library. Detailed editorial notes are not available yet for this edition.",
    ];
  }

  return content
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function formatPrimaryFormat(format: LibraryBookInfo["primaryFormat"]) {
  if (format === "READER_PACKAGE") {
    return "Reader";
  }

  return format;
}

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatBookLanguage(language: null | string) {
  const formatted = formatOptionalBookLanguage(language);

  return formatted ?? "Unknown";
}

function formatOptionalBookLanguage(language: null | string) {
  const trimmed = language?.trim();

  if (!trimmed) {
    return null;
  }

  if (typeof Intl.DisplayNames === "undefined") {
    return trimmed;
  }

  try {
    const displayNames = new Intl.DisplayNames(undefined, {
      type: "language",
    });
    return displayNames.of(trimmed) ?? trimmed;
  } catch {
    return trimmed;
  }
}

function formatReadingTime(
  minutesRead: number,
  approximatePageCount: number | null,
) {
  const spentReadingTime = formatHours(Math.max(0, minutesRead) / 60);
  const estimatedReadingTime = formatEstimatedReadingHours(approximatePageCount);

  if (!estimatedReadingTime) {
    return spentReadingTime;
  }

  return `${spentReadingTime} / ${estimatedReadingTime}`;
}

function formatEstimatedReadingHours(approximatePageCount: number | null) {
  if (!approximatePageCount || approximatePageCount < 1) {
    return null;
  }

  return `${formatHours(approximatePageCount / ESTIMATED_PAGES_PER_HOUR)} estimated`;
}

function formatHours(hours: number) {
  return `${hours.toFixed(1)} h`;
}

function formatApproximatePageCount(approximatePageCount: number | null) {
  if (!approximatePageCount || approximatePageCount < 1) {
    return "Unknown";
  }

  return `~${approximatePageCount} page${approximatePageCount === 1 ? "" : "s"}`;
}

function clampPercent(percent: number) {
  if (percent < 0) {
    return 0;
  }

  if (percent > 100) {
    return 100;
  }

  return Math.round(percent);
}
