import { useTranslations } from "next-intl";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { cn } from "@/lib/cn";

export function ReadyReaderProgress({
  completionPercent,
  currentPageIndex,
  pageCount,
}: {
  completionPercent: number;
  currentPageIndex: number;
  pageCount: number;
}) {
  const t = useTranslations("reader.progress");
  const { isPhone } = useReaderUi();
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-3 py-1",
        !isPhone && "sm:py-4",
      )}
    >
      <div className="flex flex-wrap items-center gap-3 font-ui text-[0.7rem] uppercase tracking-[0.16em] text-ink/45">
        <span>{t("percentComplete", { percent: completionPercent })}</span>
        <span>
          {t("pageOfInChapter", {
            current: Math.min(currentPageIndex + 1, pageCount),
            total: pageCount,
          })}
        </span>
      </div>
    </div>
  );
}
