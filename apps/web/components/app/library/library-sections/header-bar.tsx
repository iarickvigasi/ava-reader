import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { LibraryPayload } from "@/lib/api-types";
import { SummaryMetric, SummaryMetricSkeleton } from "./summary-metric";

type LibraryHeaderBarProps = {
  summary: LibraryPayload["summary"];
};

export function LibraryHeaderBar({ summary }: LibraryHeaderBarProps) {
  const t = useTranslations("library.header");
  return (
    <section>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
        <label className="block md:w-88 md:max-w-88 md:shrink-0">
          <span className="sr-only">{t("searchAria")}</span>
          <input
            aria-label={t("searchAria")}
            className="h-10 w-full rounded-[10px] border border-line/10 bg-paper-strong/90 px-4 text-[0.82rem] uppercase tracking-[0.14em] text-title outline-none placeholder:text-[#9a938d]"
            placeholder={t("searchPlaceholder")}
            readOnly
            value=""
          />
        </label>

        <div className="flex items-center gap-5 sm:gap-8 md:gap-10">
          <SummaryMetric
            label={t("collectionsMetric")}
            value={summary.collectionsCount}
          />
          <SummaryMetric label={t("booksMetric")} value={summary.booksCount} />
        </div>

        <Button
          type="button"
          variant="primary"
          className="min-h-10 w-full rounded-[10px] px-4 text-[0.72rem] uppercase tracking-[0.14em] shadow-(--shadow-nav) md:ml-auto md:w-auto"
        >
          {t("newCollection")}
        </Button>
      </div>
    </section>
  );
}

export function LibraryHeaderBarSkeleton() {
  return (
    <section>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
        <div className="h-10 w-full animate-pulse rounded-[10px] bg-paper-strong md:w-88 md:max-w-88 md:shrink-0" />

        <div className="flex items-center gap-5 sm:gap-8 md:gap-10">
          <SummaryMetricSkeleton />
          <SummaryMetricSkeleton />
        </div>

        <div className="h-10 w-full animate-pulse rounded-[10px] bg-paper-strong md:ml-auto md:w-34" />
      </div>
    </section>
  );
}
