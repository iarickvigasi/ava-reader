import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useScrollLoad } from "@/features/explore/use-scroll-load";

export function CatalogFeedPrevious({
  available,
  busy,
  error,
  stale,
  load,
}: {
  available: boolean;
  busy: boolean;
  error: boolean;
  stale: boolean;
  load: () => void;
}) {
  const t = useTranslations("explore");
  const ref = useScrollLoad(load, available && !busy && !error && !stale);
  return (
    <div ref={ref} className="flex justify-center">
      {available && (
        <Button variant="soft" size="sm" disabled={busy} onClick={load}>
          {t("loadEarlier")}
        </Button>
      )}
    </div>
  );
}
