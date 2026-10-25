import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/app/shared/error-state";

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
  if (loading)
    return (
      <p role="status" className="text-sm text-muted">
        {t("loading")}
      </p>
    );
  if (!error) return null;
  return (
    <ErrorState
      message={t("unavailable")}
      retryLabel={t("retry")}
      retry={retry}
    />
  );
}
