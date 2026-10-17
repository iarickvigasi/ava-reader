import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ReaderImageFailure({
  alt,
  loading,
  retry,
  compact = false,
}: {
  alt: string | null;
  loading: boolean;
  retry?: () => Promise<boolean>;
  compact?: boolean;
}) {
  const t = useTranslations("reader");
  return (
    <div
      data-reader-ui
      contentEditable={false}
      className={
        compact
          ? "absolute inset-0 flex select-none items-center justify-center rounded-control bg-surface text-muted"
          : "absolute inset-0 flex select-none flex-col items-center justify-center gap-2 overflow-auto rounded-control bg-surface px-2 text-center font-ui text-sm text-muted"
      }
    >
      <span role="img" aria-label={alt || t("imageFailure")} />
      <span role="status" className={compact ? "sr-only" : undefined}>
        {t("imageFailure")}
      </span>
      {retry && (
        <Button
          size="sm"
          variant="ghost"
          disabled={loading}
          aria-label={t("imageRetry")}
          title={t("imageFailure")}
          style={
            compact
              ? { minHeight: 0, padding: 0, width: "100%", height: "100%" }
              : undefined
          }
          onClick={async (event) => {
            const figure = event.currentTarget.closest("figure");
            if (await retry())
              requestAnimationFrame(() => {
                if (figure?.isConnected) {
                  figure.tabIndex = -1;
                  figure.focus({ preventScroll: true });
                }
              });
          }}
        >
          {compact ? (
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
            >
              <rect x="2" y="2" width="12" height="12" rx="2" />
              <path d="m4 4 8 8m0-8-8 8" />
            </svg>
          ) : (
            t("imageRetry")
          )}
        </Button>
      )}
    </div>
  );
}
