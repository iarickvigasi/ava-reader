"use client";

import { useTranslations } from "next-intl";
import { ExploreIcon } from "@/components/app/core/explore-icon";
import { ConnectNavigationIcon } from "@/components/app/core/connect-navigation-icon";
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
      <div className="space-y-4">
        <p className="font-ui text-[0.675rem] font-bold uppercase tracking-[0.16em] text-olive sm:text-[0.625rem]">
          {t("comingSoon")}
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map(({ id, icon: Icon, iconSize }) => (
            <article
              key={id}
              className="flex flex-col items-start rounded-card bg-paper-strong p-6 sm:p-8"
            >
              <span className="connect-feature-icon inline-flex size-12 items-center justify-center rounded-full bg-soft-fill text-ink">
                <span className="inline-flex size-6 items-center justify-center">
                  <Icon aria-hidden="true" className={iconSize} />
                </span>
              </span>
              <h2 className="mt-6 font-display text-3xl leading-tight text-title">
                {t(`features.${id}.title`)}
              </h2>
              <p className="mt-3 text-lg leading-7 text-copy">
                {t(`features.${id}.body`)}
              </p>
            </article>
          ))}
        </div>
      </div>
      <div className="rounded-shell bg-soft-fill px-6 py-6 sm:px-8">
        <h2 className="font-display text-3xl text-ink">{t("privacyTitle")}</h2>
        <p className="mt-2 max-w-3xl text-lg leading-7 text-copy">
          {t("privacyBody")}
        </p>
      </div>
    </section>
  );
}
