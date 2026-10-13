import { useTranslations } from "next-intl";
import {
  ReaderListeningIcon,
  ReaderShareIcon,
  UploadIcon,
} from "@/components/app/shared/app-icons";
import { FeatureCards } from "@/components/app/shared/feature-cards";

const features = [
  { id: "narration", icon: ReaderListeningIcon },
  { id: "formats", icon: UploadIcon },
  { id: "together", icon: ReaderShareIcon },
] as const;

export function LibraryFeaturesSection() {
  const t = useTranslations("library.features");

  return (
    <FeatureCards
      label={t("label")}
      cards={features.map(({ id, icon: Icon }) => ({
        id,
        icon: <Icon aria-hidden="true" className="size-6" />,
        title: t(`${id}.title`),
        description: t(`${id}.body`),
      }))}
    />
  );
}
