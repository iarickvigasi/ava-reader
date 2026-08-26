import { useTranslations } from "next-intl";
import { MobileCloseButton } from "../mobile-close-button";
import { PanelTitle } from "../panel-title";

type ContentsHeaderProps = {
  onClose: () => void;
};

export function ContentsHeader({ onClose }: ContentsHeaderProps) {
  const t = useTranslations("reader.contents");
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <PanelTitle>{t("title")}</PanelTitle>
      </div>
      <MobileCloseButton ariaLabel={t("closePanel")} onClose={onClose} />
    </div>
  );
}
