import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  useTranslateTargetLang,
} from "@/components/app/preferences/use-translate-target-lang";
import { SparkIcon } from "@/components/app/shared/app-icons";
import type { ReaderBookPayload, ReaderChapterPayload } from "@/lib/api-types";
import { useReaderSelectionContext } from "../../selection/reader-selection-context";
import { useAiCommentsContext } from "../ai-comments/ai-comments-context";
import { EtymologyIcon, LightbulbIcon } from "./ai-toolbox-icons";
import { AiToolItem } from "./ai-tool-item";
import { selectSavedComments } from "./saved-comments";
import { ToolSection } from "./tool-section";
import { TranslateToolItem } from "./translate-tool-item";
import { useToolAccordion } from "./use-tool-accordion";
import { useToolRequestFields } from "./use-tool-request-fields";

type AiToolsSectionProps = {
  libraryItemId: string;
  book: ReaderBookPayload;
  chapters: ReaderChapterPayload[];
};

export function AiToolsSection({
  libraryItemId,
  book,
  chapters,
}: AiToolsSectionProps) {
  const t = useTranslations("reader.aiTools");
  const { locator: selectedLocator } = useReaderSelectionContext();
  const { comments } = useAiCommentsContext();
  const [targetLang] = useTranslateTargetLang();

  const request = useToolRequestFields(book, chapters);
  // Keep the whole matched record per tool (body + status + error), not just
  // the body, so the panel can render queued / failed placeholders.
  const savedComments = useMemo(
    () => selectSavedComments(comments, selectedLocator ?? null),
    [comments, selectedLocator],
  );
  const { openTools, toggle } = useToolAccordion(request.locator, savedComments);

  const language = targetLang || DEFAULT_TRANSLATE_TARGET_LANG;
  const common = { libraryItemId, ...request };

  return (
    <div className="flex flex-col gap-4">
      <TranslateToolItem
        {...common}
        label={t("translate")}
        language={language}
        isOpen={openTools.has("translate")}
        onToggle={() => toggle("translate")}
        saved={savedComments.translate}
      />
      <AiToolItem
        {...common}
        kind="etymology"
        icon={<EtymologyIcon className="size-4" />}
        label={t("etymology")}
        isOpen={openTools.has("etymology")}
        onToggle={() => toggle("etymology")}
        saved={savedComments.etymology}
      />
      <AiToolItem
        {...common}
        kind="explain"
        icon={<LightbulbIcon className="size-4" />}
        label={t("explain")}
        isOpen={openTools.has("explain")}
        onToggle={() => toggle("explain")}
        saved={savedComments.explain}
      />
      <ToolSection
        variant="link"
        icon={<SparkIcon className="size-4" />}
        label={t("askAi")}
      />
    </div>
  );
}
