import { useTranslations } from "next-intl";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import type { ReaderChapterPayload } from "@/lib/api-types";
import { ReaderPageButtons } from "./reader-page-buttons";
import { cn } from "@/lib/cn";

export function ReadyReaderProgress({
  completionPercent,
  currentPageIndex,
  pageCount,
  activeChapter,
  disabled,
  goToNextPage,
  goToPreviousPage,
}: {
  completionPercent: number;
  currentPageIndex: number;
  pageCount: number;
  activeChapter: ReaderChapterPayload;
  disabled: boolean;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
}) {
  const t = useTranslations("reader.progress");
  const { isPhone } = useReaderUi();
  return (
    <div
      className={cn(
        "gap-3 py-1",
        isPhone
          ? "flex flex-wrap items-center justify-end"
          : "grid h-18 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center sm:py-4",
      )}
    >
      {!isPhone && (
        <ReaderPageButtons
          hasPrevious={
            currentPageIndex > 0 || !!activeChapter.previousChapterId
          }
          hasNext={
            currentPageIndex < pageCount - 1 || !!activeChapter.nextChapterId
          }
          disabled={disabled}
          goToNextPage={goToNextPage}
          goToPreviousPage={goToPreviousPage}
        />
      )}
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 font-ui text-[0.7rem] uppercase tracking-[0.16em] text-ink/45",
          isPhone
            ? "ml-auto"
            : "col-start-2 row-start-1 justify-center text-center",
        )}
      >
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
