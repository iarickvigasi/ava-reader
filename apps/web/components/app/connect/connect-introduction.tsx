"use client";

import { useTranslations } from "next-intl";
import { ExploreIcon } from "@/components/app/core/explore-icon";
import { ConnectNavigationIcon } from "@/components/app/core/connect-navigation-icon";
import { FeatureCards } from "@/components/app/shared/feature-cards";
import { PageHeader } from "@/components/app/shared/page-header";
import { ConversationIcon } from "./conversation-icon";

const features = [
  { id: "people", icon: ExploreIcon, iconSize: "size-5" },
  { id: "share", icon: ConnectNavigationIcon, iconSize: "size-6" },
  { id: "conversation", icon: ConversationIcon, iconSize: "size-6" },
] as const;

export function ConnectIntroduction() {
  const t = useTranslations("connect");
  return (
    <section
      aria-labelledby="connect-title"
      className="space-y-8 sm:space-y-10"
    >
      <PageHeader
        icon={ConnectNavigationIcon}
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("body")}
        titleId="connect-title"
      />
      <FeatureCards
        label={t("comingSoon")}
        cards={features.map(({ id, icon: Icon, iconSize }) => ({
          id,
          icon: <Icon aria-hidden="true" className={iconSize} />,
          title: t(`features.${id}.title`),
          description: t(`features.${id}.body`),
        }))}
      />
      <div className="rounded-shell bg-soft-fill px-6 py-6 sm:px-8">
        <h2 className="font-display text-3xl text-ink">{t("privacyTitle")}</h2>
        <p className="mt-2 max-w-3xl text-lg leading-7 text-copy">
          {t("privacyBody")}
        </p>
      </div>
    </section>
  );
}
