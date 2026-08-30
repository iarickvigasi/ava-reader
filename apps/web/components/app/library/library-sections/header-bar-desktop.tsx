import { useTranslations } from "next-intl";
import type { LibraryPayload } from "@/lib/api-types";
import { LibrarySearchField } from "./header-search";
import { ImportNewBookButton } from "./import-new-book-button";
import { NewCollectionButton } from "./new-collection-button";
import { SummaryMetric } from "./summary-metric";

// One bar from md up: search, both metrics, then the actions right-aligned with
// the primary one last.
export function LibraryHeaderBarDesktop({
  summary,
}: {
  summary: LibraryPayload["summary"];
}) {
  const t = useTranslations("library.header");
  return (
    <div className="hidden md:flex md:items-center md:gap-8">
      <LibrarySearchField className="md:w-88 md:max-w-88 md:shrink-0" />

      <div className="flex items-center gap-10">
        <SummaryMetric
          label={t("collectionsMetric")}
          value={summary.collectionsCount}
        />
        <SummaryMetric label={t("booksMetric")} value={summary.booksCount} />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <ImportNewBookButton />
        <NewCollectionButton />
      </div>
    </div>
  );
}
