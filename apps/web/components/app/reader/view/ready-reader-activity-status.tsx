import { useTranslations } from "next-intl";

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
      <p className="font-ui text-xs uppercase tracking-[0.16em] text-ink/45">
        {t("restoringPage")}
      </p>
    );
  }

  if (isLoadingChapter) {
    return (
      <p className="font-ui text-xs uppercase tracking-[0.16em] text-ink/45">
        {t("loadingChapter")}
      </p>
    );
  }

  if (isRefreshingWindow) {
    return (
      <p className="font-ui text-xs uppercase tracking-[0.16em] text-ink/35">
        {t("preloadingChapter")}
      </p>
    );
  }

  return null;
}
