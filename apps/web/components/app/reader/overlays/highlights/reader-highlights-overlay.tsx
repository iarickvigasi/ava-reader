import { useTranslations } from "next-intl";
import type { ReaderTocNode } from "@/lib/api-types";
import { MobileCloseButton } from "../mobile-close-button";
import { PanelTitle } from "../panel-title";
import { useCloseOnEscape } from "../use-close-on-escape";
import { HighlightsSections } from "./highlights-sections";

type ReaderHighlightsOverlayProps = {
  toc: ReaderTocNode[];
  onClose: () => void;
  onSelectHighlight?: (highlightId: string) => void;
};

export function ReaderHighlightsOverlay({
  toc,
  onClose,
  onSelectHighlight,
}: ReaderHighlightsOverlayProps) {
  useCloseOnEscape(onClose);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <HighlightsBackdrop onClose={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-full justify-start md:w-94">
        <div className="relative h-full w-full max-w-[24rem] md:w-94 md:max-w-94">
          <HighlightsBackgroundLayer />
          <div className="relative z-10 flex h-full flex-col md:pt-24">
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col px-6 py-8 sm:px-8 md:animate-[reader-contents-enter_320ms_cubic-bezier(0.22,1,0.36,1)_140ms_both] md:px-8 md:py-0">
              <HighlightsHeader onClose={onClose} />
              <HighlightsSections
                toc={toc}
                onSelectHighlight={onSelectHighlight}
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function HighlightsBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close highlights panel"
      className="pointer-events-auto absolute inset-0 bg-transparent md:left-94"
      onClick={onClose}
    />
  );
}

function HighlightsBackgroundLayer() {
  return (
    <div className="absolute inset-0 border-r border-line/35 bg-linear-to-r from-paper-strong/88 via-paper/78 to-paper/50 shadow-[10px_0_40px_rgba(31,27,24,0.05)] backdrop-blur-[7px] md:hidden" />
  );
}

function HighlightsHeader({ onClose }: { onClose: () => void }) {
  const t = useTranslations("reader.highlights");
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <PanelTitle>{t("title")}</PanelTitle>
      </div>
      <MobileCloseButton ariaLabel={t("closePanel")} onClose={onClose} />
    </div>
  );
}
