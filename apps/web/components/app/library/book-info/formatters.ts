import type { LibraryBookInfo } from "@/lib/api-types";

const ESTIMATED_PAGES_PER_HOUR = 30;

export function clampPercent(percent: number) {
  if (percent < 0) {
    return 0;
  }

  if (percent > 100) {
    return 100;
  }

  return Math.round(percent);
}

export function formatPrimaryFormat(format: LibraryBookInfo["primaryFormat"]) {
  if (format === "READER_PACKAGE") {
    return "Reader";
  }

  return format;
}

export function formatDate(value: string) {
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

export function formatBookLanguage(language: null | string) {
  return resolveLanguageDisplayName(language) ?? "Unknown";
}

function resolveLanguageDisplayName(language: null | string) {
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

export function formatReadingTime(
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

export function formatApproximatePageCount(
  approximatePageCount: number | null,
) {
  if (!approximatePageCount || approximatePageCount < 1) {
    return "Unknown";
  }

  return `~${approximatePageCount} page${approximatePageCount === 1 ? "" : "s"}`;
}

export function formatCollectionLabel(collectionCount: number) {
  if (collectionCount === 0) {
    return "Not assigned";
  }

  return `${collectionCount} collection${collectionCount === 1 ? "" : "s"}`;
}

export function buildBookTags(book: LibraryBookInfo) {
  if (!Array.isArray(book.genres)) {
    return [];
  }

  return book.genres
    .map((genre) => genre.trim())
    .filter((genre) => genre.length > 0);
}

export function buildProgressLabel(book: LibraryBookInfo) {
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

export function buildDescriptionParagraphs(description: null | string) {
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
