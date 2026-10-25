import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useScrollLoad } from "@/features/explore/use-scroll-load";

export function CatalogFeedFooter({
  hasNext,
  hasItems,
  busy,
  error,
  stale,
  loadMore,
}: {
  hasNext: boolean;
  hasItems: boolean;
  busy: boolean;
  error: boolean;
  stale: boolean;
  loadMore: () => void;
}) {
  const t = useTranslations("explore");
  const sentinelRef = useScrollLoad(
    loadMore,
    hasNext && !busy && !error && !stale,
  );
  return (
    <div
      ref={sentinelRef}
      className="flex min-h-10 justify-center"
      aria-live="polite"
    >
      {busy && (
        <p role="status" className="text-sm text-muted">
          {t("loading")}
        </p>
      )}
      {hasNext && !busy && !error && (
        <Button
          size="sm"
          variant="soft"
          disabled={busy || error}
          onClick={loadMore}
        >
          {t("loadMore")}
        </Button>
      )}
      {hasItems && !hasNext && !busy && !error && (
        <p className="text-sm text-muted">{t("endOfResults")}</p>
      )}
    </div>
  );
}
