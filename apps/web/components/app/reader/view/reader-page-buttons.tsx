import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ReaderPageButtons({
  hasPrevious,
  hasNext,
  disabled,
  goToPreviousPage,
  goToNextPage,
}: {
  hasPrevious: boolean;
  hasNext: boolean;
  disabled: boolean;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
}) {
  const t = useTranslations("reader.bilingual");
  return (
    <div className="contents font-ui">
      <div className="col-start-1 row-start-1 flex justify-start">
        {hasPrevious && (
          <Button
            type="button"
            variant="ghost"
            className="text-title/85! hover:!bg-transparent"
            size="sm"
            disabled={disabled}
            onClick={goToPreviousPage}
          >
            <span aria-hidden="true" className="mr-2">
              ←
            </span>
            {t("previous")}
          </Button>
        )}
      </div>
      <div className="col-start-3 row-start-1 flex justify-end">
        {hasNext && (
          <Button
            type="button"
            variant="ghost"
            className="text-title/85! hover:!bg-transparent"
            size="sm"
            disabled={disabled}
            onClick={goToNextPage}
          >
            {t("next")}
            <span aria-hidden="true" className="ml-2">
              →
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}
