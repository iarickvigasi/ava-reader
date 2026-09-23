import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { cn } from "@/lib/cn";
import { BilingualStatus } from "../loading/bilingual-status";

export function BilingualFooter({
  pageIndex,
  completionPercent,
  error,
  alignmentFailed = false,
  offline,
  pending,
  retry,
  previousDisabled,
  nextDisabled,
  goToPreviousPage,
  goToNextPage,
}: {
  pageIndex: number;
  completionPercent: number;
  error: string | null;
  alignmentFailed?: boolean;
  offline: boolean;
  pending: boolean;
  retry: () => void;
  previousDisabled: boolean;
  nextDisabled: boolean;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
}) {
  const t = useTranslations("reader.bilingual");
  const progress = useTranslations("reader.progress");
  const { isPhone } = useReaderUi();
  return (
    <footer
      className={cn(
        // Reserve the retry button's height even when status is empty. Changing
        // the footer height invalidates pagination and can loop through loading.
        "flex h-12 shrink-0 items-center justify-between gap-2 py-1",
        !isPhone && "sm:h-18 sm:py-4",
      )}
    >
      <BilingualStatus
        error={error}
        alignmentFailed={alignmentFailed}
        offline={offline}
        pending={pending}
        retry={retry}
      />
      <div className="ml-auto flex shrink-0 items-center gap-1 font-ui text-[0.7rem] uppercase tracking-[0.16em] text-ink/45">
        <span className="mr-2">
          {progress("percentComplete", { percent: completionPercent })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="!min-h-6 !px-2"
          aria-label={t("previous")}
          onClick={goToPreviousPage}
          disabled={previousDisabled}
        >
          ←
        </Button>
        <span>{t("page", { page: pageIndex + 1 })}</span>
        <Button
          variant="ghost"
          size="sm"
          className="!min-h-6 !px-2"
          aria-label={t("next")}
          onClick={goToNextPage}
          disabled={nextDisabled}
        >
          →
        </Button>
      </div>
    </footer>
  );
}
