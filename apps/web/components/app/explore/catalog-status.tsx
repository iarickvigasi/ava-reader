import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function CatalogStatus({
  error,
  loading,
  retry,
}: {
  error: boolean;
  stale: boolean;
  loading: boolean;
  retry: () => void;
}) {
  const t = useTranslations("explore");
  if (!error && !loading) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 text-sm text-muted"
    >
      {loading ? t("loading") : t("unavailable")}
      {error && (
        <Button size="sm" variant="soft" onClick={retry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
