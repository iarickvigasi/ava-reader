import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

type DeleteCollectionModalProps = {
  collectionName: string;
  error: null | string;
  isPending: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
};

export function DeleteCollectionModal({
  collectionName,
  error,
  isPending,
  onClose,
  onConfirmDelete,
}: DeleteCollectionModalProps) {
  const t = useTranslations("library.collectionActions.deleteModal");
  return (
    <div className="relative w-full max-w-md rounded-modal bg-surface/95 p-5 shadow-(--shadow-card) backdrop-blur sm:p-6">
      <p className="font-ui text-[0.7rem] uppercase tracking-[0.15em] text-danger/80">
        {t("eyebrow")}
      </p>
      <h2 className="mt-2 font-reader text-[1.75rem] leading-[1.1] text-title">
        {t("title")}
      </h2>
      <p className="mt-4 text-base leading-7 text-copy">
        {t.rich("body", {
          name: collectionName,
          emphasis: (chunks) => (
            <span className="font-medium text-title">{chunks}</span>
          ),
        })}
      </p>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="soft"
          disabled={isPending}
          onClick={onClose}
          type="button"
        >
          {t("cancel")}
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={isPending}
          onClick={onConfirmDelete}
          type="button"
        >
          {isPending ? t("deleting") : t("confirm")}
        </Button>
      </div>
    </div>
  );
}
