import { useTranslations } from "next-intl";

type EditCollectionModalProps = {
  collectionDescription: string;
  collectionName: string;
  error: null | string;
  isPending: boolean;
  onClose: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
};

export function EditCollectionModal({
  collectionDescription,
  collectionName,
  error,
  isPending,
  onClose,
  onDescriptionChange,
  onNameChange,
  onSubmit,
}: EditCollectionModalProps) {
  const t = useTranslations("library.collectionActions.editModal");
  return (
    <form
      className="relative w-full max-w-2xl rounded-[28px] bg-surface/95 p-5 shadow-(--shadow-card) backdrop-blur sm:p-6"
      onSubmit={onSubmit}
    >
      <p className="font-(--font-ui) text-[0.7rem] uppercase tracking-[0.15em] text-ink/50">
        {t("eyebrow")}
      </p>
      <h2 className="mt-2 font-display text-3xl leading-none text-title sm:text-[2rem]">
        {t("title")}
      </h2>

      <div className="mt-5 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-ink/55">
            {t("titleField")}
          </span>
          <input
            aria-label={t("titleAria")}
            className="h-11 w-full rounded-[11px] bg-paper-strong/90 px-3 text-[0.96rem] text-title outline-none placeholder:text-muted"
            disabled={isPending}
            onChange={(event) => onNameChange(event.target.value)}
            value={collectionName}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-ink/55">
            {t("descriptionField")}
          </span>
          <textarea
            aria-label={t("descriptionAria")}
            className="h-28 w-full resize-none rounded-[11px] bg-paper-strong/90 px-3 py-2.5 text-sm leading-6 text-copy outline-none placeholder:text-muted"
            disabled={isPending}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={t("descriptionPlaceholder")}
            value={collectionDescription}
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-[11px] bg-soft-fill px-4 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ink transition hover:bg-soft-tone-fill disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={onClose}
          type="button"
        >
          {t("cancel")}
        </button>
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-[11px] bg-brand-fill px-4 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-brand-foreground transition hover:bg-brand-fill-strong disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
