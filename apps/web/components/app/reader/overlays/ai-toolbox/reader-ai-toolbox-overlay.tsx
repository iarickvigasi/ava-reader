import { useTranslations } from "next-intl";
import { MobileCloseButton } from "../mobile-close-button";
import { PanelTitle } from "../panel-title";
import { useCloseOnEscape } from "../use-close-on-escape";
import { AiToolsSection } from "./ai-tools-section";
import { HighlightSection } from "./highlight-section";
import { SelectionSection } from "./selection-section";

type ReaderAiToolboxOverlayProps = {
  libraryItemId: string;
  onClose: () => void;
};

export function ReaderAiToolboxOverlay({
  libraryItemId,
  onClose,
}: ReaderAiToolboxOverlayProps) {
  useCloseOnEscape(onClose);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <AiToolboxBackdrop onClose={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full justify-end md:w-96r">
        <div className="relative h-full w-full max-w-104 md:w-96 md:max-w-96">
          <AiToolboxBackgroundLayer />
          <div className="relative z-10 flex h-full flex-col md:pt-24">
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col px-6 py-8 sm:px-8 md:animate-[reader-contents-enter_320ms_cubic-bezier(0.22,1,0.36,1)_140ms_both] md:px-8 md:py-0">
              <AiToolboxHeader onClose={onClose} />
              <AiToolboxSections libraryItemId={libraryItemId} />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function AiToolboxBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close AI toolbox panel"
      className="pointer-events-auto absolute inset-0 bg-transparent md:right-94"
      onClick={onClose}
    />
  );
}

function AiToolboxBackgroundLayer() {
  return (
    <div className="absolute inset-0 bg-linear-to-l from-paper-strong/88 via-paper/76 to-paper/0 backdrop-blur-[7px]" />
  );
}

function AiToolboxHeader({ onClose }: { onClose: () => void }) {
  const t = useTranslations("reader.aiToolbox");
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <PanelTitle>{t("title")}</PanelTitle>
      </div>
      <MobileCloseButton ariaLabel={t("closePanel")} onClose={onClose} />
    </div>
  );
}

function AiToolboxSections({ libraryItemId }: { libraryItemId: string }) {
  return (
    <div className="mt-8 flex min-h-0 flex-1 flex-col gap-6 overflow-auto pb-8 pr-1">
      <SelectionSection />
      <HighlightSection />
      <AiToolsSection libraryItemId={libraryItemId} />
    </div>
  );
}
