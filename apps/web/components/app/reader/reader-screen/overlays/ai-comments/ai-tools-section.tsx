import { useState } from "react";
import {
  ReaderTranslationIcon,
  SparkIcon,
  SpeakerIcon,
} from "@/components/app/shared/app-icons";
import { EtymologyIcon, LightbulbIcon } from "./ai-comments-icons";
import { ToolSection } from "./tool-section";

type ToolKey = "translate" | "etymology" | "explain";

export function AiToolsSection() {
  // Single-open accordion: only one tool body is expanded at a time. This keeps
  // the long sidebar from scrolling forever and matches the Figma where only
  // Translate is open.
  const [openTool, setOpenTool] = useState<ToolKey | null>("translate");

  const toggle = (tool: ToolKey) => {
    setOpenTool((current) => (current === tool ? null : tool));
  };

  return (
    <div className="flex flex-col gap-4">
      <ToolSection
        icon={<ReaderTranslationIcon className="size-4" />}
        label="Translate"
        isExpanded={openTool === "translate"}
        onToggle={() => toggle("translate")}
      >
        <TranslatePreview
          languageLabel="French (Français)"
          translatedText={'"...nous affectent si profondément."'}
        />
      </ToolSection>

      <ToolSection
        icon={<EtymologyIcon className="size-4" />}
        label="Etymology"
        isExpanded={openTool === "etymology"}
        onToggle={() => toggle("etymology")}
      />

      <ToolSection
        icon={<LightbulbIcon className="size-4" />}
        label="Explain"
        isExpanded={openTool === "explain"}
        onToggle={() => toggle("explain")}
      />

      <ToolSection
        variant="link"
        icon={<SparkIcon className="size-4" />}
        label="Ask AI"
      />
    </div>
  );
}

function TranslatePreview({
  languageLabel,
  translatedText,
}: {
  languageLabel: string;
  translatedText: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-(--font-ui) text-[0.78rem] uppercase tracking-[0.14em] text-ink/70">
        {languageLabel}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Read translation aloud"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink/70 transition hover:bg-paper-strong/70 hover:text-ink"
        >
          <SpeakerIcon className="size-4" />
        </button>
        <p className="min-w-0 flex-1 font-(--font-display) text-[1.05rem] leading-[1.4] text-ink">
          {translatedText}
        </p>
      </div>
    </div>
  );
}
