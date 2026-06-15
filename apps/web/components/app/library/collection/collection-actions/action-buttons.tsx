import { useTranslations } from "next-intl";
import { EditIcon, TrashIcon } from "@/components/app/shared/app-icons";

type CollectionActionButtonsProps = {
  onDeleteClick: () => void;
  onEditClick?: () => void;
};

export function CollectionActionButtons({
  onDeleteClick,
  onEditClick,
}: CollectionActionButtonsProps) {
  const t = useTranslations("library.collectionActions");
  return (
    <div className="flex items-center gap-2 md:justify-end">
      {onEditClick ? (
        <button
          type="button"
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-control bg-soft-fill px-3 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ink transition hover:bg-soft-tone-fill"
          onClick={onEditClick}
        >
          <EditIcon className="size-3.5" />
          {t("edit")}
        </button>
      ) : null}
      <button
        type="button"
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-control bg-danger/10 px-3 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-danger transition hover:bg-danger/20"
        onClick={onDeleteClick}
      >
        <TrashIcon className="size-3.5" />
        {t("delete")}
      </button>
    </div>
  );
}
