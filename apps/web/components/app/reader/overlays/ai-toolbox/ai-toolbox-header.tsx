import { useTranslations } from "next-intl";
import { MobileCloseButton } from "../mobile-close-button";
import { PanelTitle } from "../panel-title";

export function AiToolboxHeader({ onClose }: { onClose: () => void }) {
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
