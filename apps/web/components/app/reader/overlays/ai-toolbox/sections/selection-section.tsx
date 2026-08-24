import { useTranslations } from "next-intl";
import {
  CheckIcon,
  CopyIcon,
  SpeakerIcon,
} from "@/components/app/shared/app-icons";
import { useReaderSelectionContext } from "../../../selection/reader-selection-context";
import { SectionLabel } from "../../section-label";
import { cn } from "@/lib/cn";
import { SelectionQuote } from "./selection-quote";
import { useCopySelection } from "./use-copy-selection";
import { useSelectionExpand } from "./use-selection-expand";

export function SelectionSection() {
  const t = useTranslations("reader.aiToolbox");
  const { text } = useReaderSelectionContext();
  const { isCopied, copySelection } = useCopySelection();
  const { isExpanded, toggleExpanded } = useSelectionExpand();
  const displayText = text ?? "";
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>{t("selection")}</SectionLabel>
      <div
        className={cn(
          "flex gap-3 rounded-control bg-soft-tone-fill px-4 py-3",
          // Icons ride the first line of a multi-line expanded fragment.
          isExpanded ? "items-start" : "items-center",
        )}
      >
        <button
          type="button"
          aria-label={t("selectionReadAloud")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink/70 transition hover:bg-paper-strong/70 hover:text-ink"
        >
          <SpeakerIcon className="size-4" />
        </button>
        <SelectionQuote
          text={displayText}
          isExpanded={isExpanded}
          onToggle={toggleExpanded}
        />
        <button
          type="button"
          aria-label={isCopied ? t("selectionCopied") : t("selectionCopy")}
          onClick={copySelection}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink/55 transition hover:bg-paper-strong/70 hover:text-ink"
        >
          {isCopied ? (
            <CheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </button>
        {/* Polite live region so the visual icon swap is also announced. */}
        <span role="status" className="sr-only">
          {isCopied ? t("selectionCopied") : ""}
        </span>
      </div>
    </section>
  );
}
