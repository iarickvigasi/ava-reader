import { useTranslations } from "next-intl";
import { useCatalogRead } from "@/features/explore/use-catalog-read";
import { Button } from "@/components/ui/button";
import { PendingLabel } from "@/components/app/shared/pending-label";

export function CatalogReadButton({ entryId }: { entryId: string }) {
  const t = useTranslations("explore");
  const { read, pending, error } = useCatalogRead(entryId);
  return (
    <div className="space-y-2">
      <Button disabled={pending} onClick={() => void read()}>
        <PendingLabel pending={pending} pendingText={t("openingBook")}>
          {t("read")}
        </PendingLabel>
      </Button>
      {error && (
        <p role="alert" className="text-sm text-muted">
          {t("readingFailed")}
        </p>
      )}
    </div>
  );
}
