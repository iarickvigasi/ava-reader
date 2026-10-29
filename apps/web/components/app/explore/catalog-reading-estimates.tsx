import { useTranslations } from "next-intl";
import type { ReadingDetails } from "@/features/explore/use-reading-details";
import { estimatedReadingHours } from "@/lib/estimated-reading-hours";
import { useBookInfoFormatters } from "@/components/app/library/book-info/formatters";
import { MetadataItem } from "@/components/app/shared/books/metadata-item";
export function CatalogReadingEstimates({
  estimates,
}: {
  estimates: ReadingDetails | null;
}) {
  const labels = useTranslations("library.bookInfo.metadata");
  const t = useTranslations("library.bookInfo.formatters");
  const fmt = useBookInfoFormatters();
  const pages = estimates?.approximatePageCount ?? null;
  const body = estimates?.approximateBodyPageCount ?? pages;
  const readingTime =
    body && body > 0
      ? t("estimated", {
          hours: t("hours", { value: estimatedReadingHours(body).toFixed(1) }),
        })
      : t("unknown");
  return (
    <section className="grid grid-cols-2 gap-x-12 gap-y-10">
      <MetadataItem label={labels("readingTime")} value={readingTime} />
      <MetadataItem
        label={labels("pageCount")}
        value={fmt.formatApproximatePageCount(pages)}
      />
    </section>
  );
}
