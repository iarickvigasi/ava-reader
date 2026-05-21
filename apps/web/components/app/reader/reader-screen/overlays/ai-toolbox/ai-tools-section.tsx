import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  useTranslateTargetLang,
} from "@/components/app/preferences/use-translate-target-lang";
import { SparkIcon } from "@/components/app/shared/app-icons";
import { useReaderSelectionContext } from "../../screen/reader-selection-context";
import { EtymologyIcon, LightbulbIcon } from "./ai-toolbox-icons";
import { AiToolItem } from "./ai-tool-item";
import { ToolSection } from "./tool-section";
import { TranslateToolItem } from "./translate-tool-item";

type ToolKey = "translate" | "etymology" | "explain";

type AiToolsSectionProps = {
  libraryItemId: string;
};

export function AiToolsSection({ libraryItemId }: AiToolsSectionProps) {
  const t = useTranslations("reader.aiTools");
  const { text: selectedText, locator: selectedLocator } =
    useReaderSelectionContext();
  // Multi-open accordion: each tool has its own open/closed state and opening
  // one does NOT collapse the others. Sections only close when the user clicks
  // them again or when the whole panel is dismissed (this component unmounts
  // then, so the state resets naturally on next open).
  const [openTools, setOpenTools] = useState<ReadonlySet<ToolKey>>(
    () => new Set(),
  );
  const [targetLang] = useTranslateTargetLang();

  const selection = (selectedText ?? "").trim();
  // Serialise once per selection. The server stores this string verbatim in
  // AiComment.locator so it can re-anchor the highlight on a future read.
  const locator = useMemo(
    () => (selectedLocator ? JSON.stringify(selectedLocator) : undefined),
    [selectedLocator],
  );
  const language = targetLang || DEFAULT_TRANSLATE_TARGET_LANG;

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
      />
      <AiToolItem
        {...common}
        kind="etymology"
        icon={<EtymologyIcon className="size-4" />}
        label={t("etymology")}
        isOpen={openTools.has("etymology")}
        onToggle={() => toggle("etymology")}
      />
      <AiToolItem
        {...common}
        kind="explain"
        icon={<LightbulbIcon className="size-4" />}
        label={t("explain")}
        isOpen={openTools.has("explain")}
        onToggle={() => toggle("explain")}
      />
      <ToolSection
        variant="link"
        icon={<SparkIcon className="size-4" />}
        label={t("askAi")}
      />
    </div>
  );
}
