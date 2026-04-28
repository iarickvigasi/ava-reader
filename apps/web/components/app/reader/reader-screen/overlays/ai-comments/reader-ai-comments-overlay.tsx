import { useState } from "react";
import { SectionLabel } from "../section-label";
import { useCloseOnEscape } from "../use-close-on-escape";
import type { HighlightColor } from "../highlights/highlights-data";
import { AiToolsSection } from "./ai-tools-section";
import { HighlightSection } from "./highlight-section";
import { SelectionSection } from "./selection-section";

type ReaderAiCommentsOverlayProps = {
  libraryItemId: string;
  onClose: () => void;
  selectedText?: string;
};

export function ReaderAiCommentsOverlay({
  libraryItemId,
  onClose,
  selectedText,
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
              <AiCommentsHeader />
              <AiCommentsSections
                libraryItemId={libraryItemId}
                selectedColor={selectedColor}
                selectedText={selectedText ?? ""}
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
    <div className="absolute inset-0 bg-linear-to-l from-paper-strong to-paper-strong/80 shadow-[-10px_0_40px_rgba(31,27,24,0.05)] backdrop-blur-[2px]" />
  );
}

function AiCommentsHeader() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <SectionLabel>AI Comments</SectionLabel>
      </div>
    </div>
  );
}

function AiCommentsSections({
  libraryItemId,
  selectedColor,
  selectedText,
  onSelectColor,
}: {
  libraryItemId: string;
  selectedColor: HighlightColor | null;
  selectedText: string;
  onSelectColor: (color: HighlightColor) => void;
}) {
  return (
    <div className="mt-8 flex min-h-0 flex-1 flex-col gap-6 overflow-auto pb-8 pr-1">
      <SelectionSection selectedText={selectedText} />
      <HighlightSection
        selectedColor={selectedColor}
        onSelectColor={onSelectColor}
      />
      <AiToolsSection
        libraryItemId={libraryItemId}
        selectedText={selectedText}
      />
    </div>
  );
}
