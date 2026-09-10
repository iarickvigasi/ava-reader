import { useId } from "react";
import {
  normalizeCollectionText,
  collectionFieldErrors,
} from "../../shared/collection-input";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

type EditCollectionModalProps = {
  mode?: "create" | "edit";
  offline?: boolean;
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
  mode = "edit",
  offline = false,
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
  const create = useTranslations("library.collectionActions.createModal");
  const errors = useTranslations("library.collectionActions.errors");
  const id = useId();
  const fields = collectionFieldErrors(collectionName, collectionDescription);
  return (
    <form
      className="relative w-full max-w-2xl rounded-modal bg-surface/95 p-5 shadow-(--shadow-card) backdrop-blur sm:p-6"
      aria-labelledby={`${id}-title`}
      noValidate
      onSubmit={onSubmit}
    >
      <p className="font-ui text-[0.7rem] uppercase tracking-[0.15em] text-ink/50">
        {t("eyebrow")}
      </p>
      <h2
        id={`${id}-title`}
        className="mt-2 font-reader text-[1.75rem] leading-[1.1] text-title"
      >
        {mode === "create" ? create("title") : t("title")}
      </h2>

      <div className="mt-5 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-ink/55">
            {t("titleField")}
          </span>
          <input
            autoFocus
            required
            autoCapitalize="sentences"
            aria-invalid={Boolean(collectionName && fields.name)}
            aria-describedby={
              collectionName && fields.name ? `${id}-name-error` : undefined
            }
            onBlur={() => onNameChange(normalizeCollectionText(collectionName))}
            aria-label={t("titleAria")}
            className="h-11 w-full rounded-control bg-paper-strong/90 px-3 text-[0.96rem] text-title outline-none transition focus-visible:ring-2 focus-visible:ring-line-strong placeholder:text-muted"
            disabled={isPending}
            onChange={(event) => onNameChange(event.target.value)}
            value={collectionName}
          />
          {collectionName && fields.name ? (
            <span id={`${id}-name-error`} className="block text-sm text-danger">
              {errors(fields.name)}
            </span>
          ) : null}
        </label>

        <label className="block space-y-1.5">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-ink/55">
            {t("descriptionField")} {t("optional")}
          </span>
          <textarea
            autoCapitalize="sentences"
            aria-invalid={Boolean(fields.description)}
            aria-describedby={
              fields.description ? `${id}-description-error` : undefined
            }
            onBlur={() =>
              onDescriptionChange(
                normalizeCollectionText(collectionDescription),
              )
            }
            aria-label={t("descriptionAria")}
            className="h-28 w-full resize-none rounded-control bg-paper-strong/90 px-3 py-2.5 text-sm leading-6 text-copy outline-none transition focus-visible:ring-2 focus-visible:ring-line-strong placeholder:text-muted"
            disabled={isPending}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={t("descriptionPlaceholder")}
            value={collectionDescription}
          />
          {fields.description ? (
            <span
              id={`${id}-description-error`}
              className="block text-sm text-danger"
            >
              {errors(fields.description)}
            </span>
          ) : null}
        </label>
      </div>

      {offline || error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {offline ? errors("createOffline") : error}
        </p>
      ) : null}

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
          disabled={
            isPending || offline || Boolean(fields.name || fields.description)
          }
          type="submit"
        >
          {mode === "create"
            ? isPending
              ? create("creating")
              : create("create")
            : isPending
              ? t("saving")
              : t("save")}
        </Button>
      </div>
    </form>
  );
}
