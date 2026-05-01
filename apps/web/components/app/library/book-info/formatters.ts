import { useLocale, useTranslations } from "next-intl";
import type { LibraryBookInfo } from "@/lib/api-types";

const ESTIMATED_PAGES_PER_HOUR = 30;

// Pure helpers — no user-facing strings, safe to call anywhere.

export function clampPercent(percent: number) {
  if (percent < 0) {
    return 0;
  }

  if (percent > 100) {
    return 100;
  }

  return Math.round(percent);
}

export function buildBookTags(book: LibraryBookInfo) {
  if (!Array.isArray(book.genres)) {
    return [];
  }

  return book.genres
    .map((genre) => genre.trim())
    .filter((genre) => genre.length > 0);
}

export function buildDescriptionParagraphs(
  description: null | string,
  fallback: string,
) {
  const content = description?.trim();

  if (!content) {
    return [fallback];
  }

  return content
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

// Locale-aware formatters. Bind a single instance per render with this hook
// so callers don't pass the translator into every call.

export function useBookInfoFormatters() {
  const t = useTranslations("library.bookInfo.formatters");
  const locale = useLocale();

  const formatHours = (hours: number) =>
    t("hours", { value: hours.toFixed(1) });

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return t("unknown");
    }
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(parsed);
  };

  const formatBookLanguage = (language: null | string) => {
    const trimmed = language?.trim();
    if (!trimmed) {
      return t("unknown");
    }
    if (typeof Intl.DisplayNames === "undefined") {
      return trimmed;
    }
    try {
      const displayNames = new Intl.DisplayNames(locale, {
        type: "language",
      });
      return displayNames.of(trimmed) ?? trimmed;
    } catch {
      return trimmed;
    }
  };

  const formatPrimaryFormat = (format: LibraryBookInfo["primaryFormat"]) =>
    format === "READER_PACKAGE" ? t("readerFormat") : format;

  const formatReadingTime = (
    minutesRead: number,
    approximatePageCount: number | null,
  ) => {
    const spent = formatHours(Math.max(0, minutesRead) / 60);

    if (!approximatePageCount || approximatePageCount < 1) {
      return spent;
    }

    const estimated = t("estimated", {
      hours: formatHours(approximatePageCount / ESTIMATED_PAGES_PER_HOUR),
    });
    return `${spent} / ${estimated}`;
  };

  const formatApproximatePageCount = (
    approximatePageCount: number | null,
  ) => {
    if (!approximatePageCount || approximatePageCount < 1) {
      return t("unknown");
    }
    return t("approxPages", { count: approximatePageCount });
  };

  const formatCollectionLabel = (collectionCount: number) => {
    if (collectionCount === 0) {
      return t("notAssigned");
    }
    return t("collectionsCount", { count: collectionCount });
  };

  const buildProgressLabel = (book: LibraryBookInfo) => {
    if (book.chapterLabel && book.lastReadAt) {
      return t("lastReadWithChapter", {
        chapter: book.chapterLabel,
        date: formatDate(book.lastReadAt),
      });
    }

    if (book.chapterLabel) {
      return t("lastReadChapterOnly", { chapter: book.chapterLabel });
    }

    if (book.lastReadAt) {
      return t("lastReadDateOnly", { date: formatDate(book.lastReadAt) });
    }

    return "";
  };

  const descriptionFallback = () => t("descriptionFallback");

  return {
    formatApproximatePageCount,
    formatBookLanguage,
    formatCollectionLabel,
    formatDate,
    formatPrimaryFormat,
    formatReadingTime,
    buildProgressLabel,
    descriptionFallback,
  };
}
