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
  return (
    <div className="relative w-full max-w-md rounded-[28px] border border-line/65 bg-surface/95 p-5 shadow-(--shadow-card) backdrop-blur sm:p-6">
      <p className="font-(--font-ui) text-[0.7rem] uppercase tracking-[0.15em] text-danger/80">
        Collection
      </p>
      <h2 className="mt-2 font-display text-3xl leading-none text-title sm:text-[2rem]">
        Delete collection?
      </h2>
      <p className="mt-4 text-base leading-7 text-copy">
        This will permanently remove{" "}
        <span className="font-medium text-title">{collectionName}</span> and
        its collection memberships.
      </p>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-[11px] border border-line bg-white/45 px-4 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ink transition hover:bg-white/75 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-[11px] border border-danger/70 bg-danger px-4 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={onConfirmDelete}
          type="button"
        >
          {isPending ? "Deleting..." : "Confirm delete"}
        </button>
      </div>
    </div>
  );
}
