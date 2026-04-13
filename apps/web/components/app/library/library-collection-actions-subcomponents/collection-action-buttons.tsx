import { EditIcon, TrashIcon } from "@/components/app/shared/app-icons";

type CollectionActionButtonsProps = {
  onDeleteClick: () => void;
  onEditClick: () => void;
};

export function CollectionActionButtons({
  onDeleteClick,
  onEditClick,
}: CollectionActionButtonsProps) {
  return (
    <div className="flex items-center gap-2 md:justify-end">
      <button
        type="button"
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[10px] border border-line bg-white/45 px-3 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ink transition hover:bg-white/75"
        onClick={onEditClick}
      >
        <EditIcon className="size-3.5" />
        Edit
      </button>
      <button
        type="button"
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[10px] border border-danger/35 bg-danger/10 px-3 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-danger transition hover:bg-danger/20"
        onClick={onDeleteClick}
      >
        <TrashIcon className="size-3.5" />
        Delete
      </button>
    </div>
  );
}
