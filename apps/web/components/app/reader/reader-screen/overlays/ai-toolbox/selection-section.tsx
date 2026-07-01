import { useTranslations } from "next-intl";
import { CopyIcon, SpeakerIcon } from "@/components/app/shared/app-icons";
import { useReaderSelectionContext } from "../../screen/reader-selection-context";
import { SectionLabel } from "../section-label";

export function SelectionSection() {
  const t = useTranslations("reader.aiToolbox");
  const { text } = useReaderSelectionContext();
  const displayText = text ?? "";
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>{t("selection")}</SectionLabel>
      <div className="flex items-center gap-3 rounded-control bg-soft-tone-fill px-4 py-3">
        <button
          type="button"
          aria-label={t("selectionReadAloud")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink/70 transition hover:bg-paper-strong/70 hover:text-ink"
        >
          <SpeakerIcon className="size-4" />
        </button>
        <p className="min-w-0 flex-1 truncate font-display text-[1.05rem] leading-[1.4] text-ink">
          {`“${displayText}”`}
        </p>
        <button
          type="button"
          aria-label={t("selectionCopy")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink/55 transition hover:bg-paper-strong/70 hover:text-ink"
        >
          <CopyIcon className="size-4" />
        </button>
      </div>
    </section>
  );
}
