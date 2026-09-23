import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function BilingualStatus({
  error,
  offline,
  pending,
  retry,
}: {
  error: string | null;
  offline: boolean;
  pending: boolean;
  retry: () => void;
}) {
  const t = useTranslations("reader.bilingual");
  if (!pending && !error) return null;
  if (!offline && !error)
    return (
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
    );
  return (
    <div
      className="flex min-w-0 items-center gap-2 text-xs text-muted"
      role="status"
    >
      <span className="truncate" title={error ?? undefined}>
        {offline ? t("offline") : error ? t("failed") : t("loading")}
      </span>
      {error && !offline ? (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 whitespace-nowrap"
          onClick={retry}
        >
          {t("retry")}
        </Button>
      ) : null}
    </div>
  );
}
