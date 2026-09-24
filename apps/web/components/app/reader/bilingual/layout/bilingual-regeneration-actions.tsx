import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PendingLabel } from "@/components/app/shared/pending-label";

export function BilingualRegenerationActions({
  generation,
  redoDisabled,
  pending,
  redoTranslation,
  redoPairs,
}: {
  generation: { translation: boolean; pairs: boolean };
  redoDisabled: boolean;
  pending: boolean;
  redoTranslation: () => void;
  redoPairs: () => void;
}) {
  const t = useTranslations("reader.bilingual");
  return (
    <div className="flex w-full shrink-0 items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={redoDisabled || generation.translation}
        onClick={redoTranslation}
      >
        <PendingLabel
          pending={generation.translation}
          pendingText={t("redoTranslationBusy")}
        >
          {t("redoTranslation")}
        </PendingLabel>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={redoDisabled || pending || generation.pairs}
        onClick={redoPairs}
      >
        <PendingLabel
          pending={generation.pairs}
          pendingText={t("redoPairsBusy")}
        >
          {t("redoPairs")}
        </PendingLabel>
      </Button>
    </div>
  );
}
