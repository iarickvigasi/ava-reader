import { useTranslations } from "next-intl";
import { PanelTitle } from "../panel-title";
import { useCloseOnEscape } from "../use-close-on-escape";
import { BilingualSection } from "./bilingual-section";
import { ListeningSection } from "./listening-section";
import { ReadingSection } from "./reading-section";

type ReaderPreferencesOverlayProps = {
  fontScale: number;
  onClose: () => void;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
};

export function ReaderPreferencesOverlay({
  fontScale,
  onClose,
  onDecreaseFont,
  onIncreaseFont,
}: ReaderPreferencesOverlayProps) {
  const t = useTranslations("preferences");
  useCloseOnEscape(onClose);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <PreferencesBackdrop onClose={onClose} closeLabel={t("closePanel")} />
      <aside className="absolute inset-y-0 left-0 flex w-full justify-start md:w-94">
        <div className="relative h-full w-full max-w-[24rem] md:w-94 md:max-w-94">
          <PreferencesBackgroundLayer />
          <div className="relative z-10 flex h-full flex-col md:pt-24">
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col px-6 py-8 sm:px-8 md:animate-[reader-contents-enter_320ms_cubic-bezier(0.22,1,0.36,1)_140ms_both] md:px-8 md:py-0">
              <PreferencesHeader title={t("title")} />
              <PreferencesSections
                fontScale={fontScale}
                onDecreaseFont={onDecreaseFont}
                onIncreaseFont={onIncreaseFont}
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function PreferencesBackdrop({
  closeLabel,
  onClose,
}: {
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={closeLabel}
      className="pointer-events-auto absolute inset-0 bg-transparent md:left-94"
      onClick={onClose}
    />
  );
}

function PreferencesBackgroundLayer() {
  return (
    <div className="absolute inset-0 border-r border-line/35 bg-linear-to-r from-paper-strong/88 via-paper/78 to-paper/50 shadow-[10px_0_40px_rgba(31,27,24,0.05)] backdrop-blur-[7px] md:hidden" />
  );
}

function PreferencesHeader({ title }: { title: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <PanelTitle>{title}</PanelTitle>
      </div>
    </div>
  );
}

function PreferencesSections({
  fontScale,
  onDecreaseFont,
  onIncreaseFont,
}: {
  fontScale: number;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
}) {
  return (
    <div className="mt-8 min-h-0 flex-1 space-y-12 overflow-auto pb-8 pr-2">
      <ReadingSection
        fontScale={fontScale}
        onDecreaseFont={onDecreaseFont}
        onIncreaseFont={onIncreaseFont}
      />
      <BilingualSection />
      <ListeningSection />
    </div>
  );
}
