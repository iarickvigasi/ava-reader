import { useTranslations } from "next-intl";
import {
  ReaderTranslationIcon,
  SparkIcon,
  StackBooksIcon,
} from "@/components/app/shared/app-icons";
import { FeatureCards } from "@/components/app/shared/feature-cards";

const features = [
  { id: "understand", icon: SparkIcon },
  { id: "languages", icon: ReaderTranslationIcon },
  { id: "habit", icon: StackBooksIcon },
] as const;

export function HomeFeaturesSection() {
  const t = useTranslations("home.features");

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
