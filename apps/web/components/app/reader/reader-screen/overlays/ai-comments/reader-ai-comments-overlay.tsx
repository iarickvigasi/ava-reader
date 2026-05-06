import { useTranslations } from "next-intl";
import { useState } from "react";
import { MobileCloseButton } from "../mobile-close-button";
import { PanelTitle } from "../panel-title";
import { useCloseOnEscape } from "../use-close-on-escape";
import type { HighlightColor } from "../highlights/highlights-data";
import { AiToolsSection } from "./ai-tools-section";
import { HighlightSection } from "./highlight-section";
import { SelectionSection } from "./selection-section";

type ReaderAiCommentsOverlayProps = {
  libraryItemId: string;
  onClose: () => void;
};

export function ReaderAiCommentsOverlay({
  libraryItemId,
  onClose,
}: ReaderAiCommentsOverlayProps) {
  useCloseOnEscape(onClose);
  const [selectedColor, setSelectedColor] = useState<HighlightColor | null>(
    "apricot",
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <AiCommentsBackdrop onClose={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full justify-end md:w-96r">
        <div className="relative h-full w-full max-w-104 md:w-96 md:max-w-96">
          <AiCommentsBackgroundLayer />
          <div className="relative z-10 flex h-full flex-col md:pt-24">
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col px-6 py-8 sm:px-8 md:animate-[reader-contents-enter_320ms_cubic-bezier(0.22,1,0.36,1)_140ms_both] md:px-8 md:py-0">
              <AiCommentsHeader onClose={onClose} />
              <AiCommentsSections
                libraryItemId={libraryItemId}
                selectedColor={selectedColor}
                onSelectColor={setSelectedColor}
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function AiCommentsBackdrop({ onClose }: { onClose: () => void }) {
  // The clickable region covers the area to the LEFT of the panel (the part
  // of the screen the panel does not occupy)
  return (
    <button
      type="button"
      aria-label="Close AI comments panel"
      className="pointer-events-auto absolute inset-0 bg-transparent md:right-94"
      onClick={onClose}
    />
  );
}

function AiCommentsBackgroundLayer() {
  return (
    <div className="absolute inset-0 bg-linear-to-l from-paper-strong/88 via-paper/76 to-paper/0 backdrop-blur-[7px]" />
  );
}

function AiCommentsHeader({ onClose }: { onClose: () => void }) {
  const t = useTranslations("reader.aiComments");
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <PanelTitle>{t("title")}</PanelTitle>
      </div>
      <MobileCloseButton ariaLabel={t("closePanel")} onClose={onClose} />
    </div>
  );
}

function AiCommentsSections({
  libraryItemId,
  selectedColor,
  onSelectColor,
}: {
  libraryItemId: string;
  selectedColor: HighlightColor | null;
  onSelectColor: (color: HighlightColor) => void;
}) {
  return (
    <div className="mt-8 flex min-h-0 flex-1 flex-col gap-6 overflow-auto pb-8 pr-1">
      <SelectionSection />
      <HighlightSection
        selectedColor={selectedColor}
        onSelectColor={onSelectColor}
      />
      <AiToolsSection libraryItemId={libraryItemId} />
    </div>
  );
}
