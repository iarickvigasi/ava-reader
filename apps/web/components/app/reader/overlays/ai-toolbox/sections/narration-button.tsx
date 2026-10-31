import type { ReaderBookPayload, ReaderChapterPayload } from "@/lib/api-types";
import { useTranslations } from "next-intl";
import { useSelectionNarration } from "./use-selection-narration";
import { NarrationControl } from "./narration-control";

export function NarrationButton({
  libraryItemId,
  book,
  chapters,
}: {
  libraryItemId: string;
  book: ReaderBookPayload;
  chapters: ReaderChapterPayload[];
}) {
  const t = useTranslations("reader.aiToolbox");
  const narration = useSelectionNarration(libraryItemId, book, chapters);
  return (
    <NarrationControl {...narration} idleLabel={t("selectionReadAloud")} />
  );
}
