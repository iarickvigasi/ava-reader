import {
  ReadListenActions,
  READ_ACTION_CLASS_NAME,
} from "@/components/app/shared/books/read-listen-actions";
import { StackBooksIcon } from "@/components/app/shared/app-icons";
import { useTranslations } from "next-intl";
import { useCatalogRead } from "@/features/explore/use-catalog-read";
import { Button } from "@/components/ui/button";
import { PendingLabel } from "@/components/app/shared/pending-label";

export function CatalogReadButton({
  entryId,
  draft,
}: {
  entryId: string;
  draft?: { editionId: string; checksum: string };
}) {
  const t = useTranslations("explore");
  const { read, pending, error } = useCatalogRead(entryId, draft);
  return (
    <div className="w-full max-w-120 space-y-2">
      <ReadListenActions
        readAction={
          <Button
            className={READ_ACTION_CLASS_NAME}
            disabled={pending}
            onClick={() => void read()}
          >
            <PendingLabel pending={pending} pendingText={t("openingBook")}>
              <StackBooksIcon className="size-4" />
              {t("read")}
            </PendingLabel>
          </Button>
        }
      />
      {error && (
        <p role="alert" className="text-sm text-muted">
          {t("readingFailed")}
        </p>
      )}
    </div>
  );
}
