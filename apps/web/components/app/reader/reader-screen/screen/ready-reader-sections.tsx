import { useTranslations } from "next-intl";
import type { ReaderChapterPayload } from "@/lib/api-types";
import type { ReadyReaderPayload } from "../shared/types";
import { formatReaderHeaderParts } from "../shared/utils";

export function ReadyReaderHeader({
  activeChapter,
  payload,
}: {
  activeChapter: ReaderChapterPayload;
  payload: ReadyReaderPayload;
}) {
  const { title, author, chapter } = formatReaderHeaderParts(payload, activeChapter);

  return (
    <header className="min-w-0 flex-1 pt-1">
      <h1 className="min-w-0 flex items-center gap-1 font-(--font-ui) text-[1.05rem] leading-none tracking-[0.01em] text-title sm:text-[1.2rem]">

        <span className="min-w-0 truncate max-w-[25ch]">
          {title}
        </span>

        <span className="shrink-0">,</span>

        <span className="min-w-0 truncate">
          {author}
        </span>

        <span className="shrink-0">–</span>

        <span className="shrink-0 whitespace-nowrap">
          {chapter}
        </span>
      </h1>
    </header>
  );
}

export function ReadyReaderActivityStatus({
  isBootstrapping,
  isLoadingChapter,
  isRefreshingWindow,
}: {
  isBootstrapping: boolean;
  isLoadingChapter: boolean;
  isRefreshingWindow: boolean;
}) {
  const t = useTranslations("reader.activity");
  if (isBootstrapping) {
    return (
      <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/45">
        {t("restoringPage")}
      </p>
    );
  }

  if (isLoadingChapter) {
    return (
      <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/45">
        {t("loadingChapter")}
      </p>
    );
  }

  if (isRefreshingWindow) {
    return (
      <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/35">
        {t("preloadingChapter")}
      </p>
    );
  }

  return null;
}

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
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 pb-4">
      <div className="flex flex-wrap items-center gap-3 font-(--font-ui) text-[0.7rem] uppercase tracking-[0.16em] text-ink/45">
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
