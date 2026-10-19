import { useTranslations } from "next-intl";
import type { PdfMetadataDraft } from "@/lib/api-types/pdf-metadata";

const fieldClass =
  "w-full rounded-control bg-paper-strong px-3 py-2 text-ink outline-none focus-visible:ring-2 focus-visible:ring-line-strong";
export function PdfMetadataFields({
  draft,
  onChange,
  disabled,
}: {
  draft: PdfMetadataDraft;
  onChange: (draft: PdfMetadataDraft) => void;
  disabled: boolean;
}) {
  const t = useTranslations("pdfImport.metadata");
  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span>{t("title")}</span>
        <input
          autoFocus
          required
          maxLength={1000}
          className={fieldClass}
          disabled={disabled}
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
      </label>
      <label className="block space-y-1">
        <span>{t("authors")}</span>
        <textarea
          rows={3}
          maxLength={100099}
          className={fieldClass}
          disabled={disabled}
          value={draft.authors}
          onChange={(e) => onChange({ ...draft, authors: e.target.value })}
        />
        <span className="block text-xs text-muted">{t("authorsHint")}</span>
      </label>
      <label className="block space-y-1">
        <span>{t("language")}</span>
        <input
          maxLength={35}
          className={fieldClass}
          disabled={disabled}
          value={draft.language}
          onChange={(e) => onChange({ ...draft, language: e.target.value })}
        />
        <span className="block text-xs text-muted">{t("languageHint")}</span>
      </label>
    </div>
  );
}
