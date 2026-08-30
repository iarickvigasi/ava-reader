import { useTranslations } from "next-intl";
import type { LibraryPayload } from "@/lib/api-types";
import { LibrarySearchField } from "./header-search";
import { ImportNewBookButton } from "./import-new-book-button";
import { NewCollectionButton } from "./new-collection-button";
import { SummaryMetric } from "./summary-metric";

// Phone layout: one row per metric, led by the action that changes it. Both
// buttons sit in the grid's first column, so the longer label ("Import new
// book") sizes the track and the two come out the same width — two independent
// flex rows would leave their right edges ragged.
export function LibraryHeaderBarMobile({
  summary,
}: {
  summary: LibraryPayload["summary"];
}) {
  const t = useTranslations("library.header");
  return (
    <div className="flex flex-col gap-4 md:hidden">
      <LibrarySearchField />

      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-6">
        <NewCollectionButton className="w-full" />
        <SummaryMetric
          label={t("collectionsMetric")}
          value={summary.collectionsCount}
        />

        <ImportNewBookButton className="w-full" />
        <SummaryMetric label={t("booksMetric")} value={summary.booksCount} />
      </div>
    </div>
  );
}
