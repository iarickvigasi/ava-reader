import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  useTranslateTargetLang,
} from "@/components/app/preferences/use-translate-target-lang";
import { SparkIcon } from "@/components/app/shared/app-icons";
import { useReaderSelectionContext } from "../../screen/reader-selection-context";
import { useAiCommentsContext } from "../ai-comments/ai-comments-context";
import { EtymologyIcon, LightbulbIcon } from "./ai-toolbox-icons";
import { AiToolItem } from "./ai-tool-item";
import { type ToolKey, selectSavedComments } from "./saved-comments";
import { ToolSection } from "./tool-section";
import { TranslateToolItem } from "./translate-tool-item";

type AiToolsSectionProps = {
  libraryItemId: string;
};

export function AiToolsSection({ libraryItemId }: AiToolsSectionProps) {
  const t = useTranslations("reader.aiTools");
  const { text: selectedText, locator: selectedLocator } =
    useReaderSelectionContext();
  const { comments } = useAiCommentsContext();
  const [targetLang] = useTranslateTargetLang();

  const selection = (selectedText ?? "").trim();
  // Serialise once per selection. The server stores this string verbatim in
  // AiComment.locator so it can re-anchor the highlight on a future read.
  const locator = useMemo(
    () => (selectedLocator ? JSON.stringify(selectedLocator) : undefined),
    [selectedLocator],
  );
  const language = targetLang || DEFAULT_TRANSLATE_TARGET_LANG;

  // Keep the whole matched record per tool (body + status + error), not just
  // the body, so the panel can render queued / failed placeholders.
  const savedComments = useMemo(
    () => selectSavedComments(comments, selectedLocator ?? null),
    [comments, selectedLocator],
  );

  // Multi-open accordion: each tool has its own open/closed state. Opening
  // one does NOT collapse the others. On first sight of a selection we
  // auto-expand the tools that already have a saved result so the user
  // immediately sees their prior comments; subsequent toggles are user-driven.
  //
  // We adjust state during render (rather than in an effect) using the
  // "previous-prop" pattern documented at
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders —
  // React throws away the in-progress render and starts a new one, so this
  // doesn't trigger a cascading commit.
  const [openTools, setOpenTools] = useState<ReadonlySet<ToolKey>>(
    () => new Set(),
  );
  const [autoExpandedLocator, setAutoExpandedLocator] = useState<
    string | undefined
  >(undefined);
  if (locator !== autoExpandedLocator) {
    setAutoExpandedLocator(locator);
    const next = new Set<ToolKey>();
    for (const key of Object.keys(savedComments) as ToolKey[]) {
      next.add(key);
    }
    setOpenTools(next);
  }

  const toggle = (tool: ToolKey) => {
    setOpenTools((current) => {
      const next = new Set(current);
      if (next.has(tool)) {
        next.delete(tool);
      } else {
        next.add(tool);
      }
      return next;
    });
  };

  const common = { libraryItemId, selection, locator };

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
