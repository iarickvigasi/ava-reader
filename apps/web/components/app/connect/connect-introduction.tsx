"use client";

import { useTranslations } from "next-intl";
import {
  ExploreIcon,
  ReaderShareIcon,
  ReaderNotesIcon,
} from "@/components/app/shared/app-icons";

const features = [
  { id: "people", icon: ExploreIcon },
  { id: "share", icon: ReaderShareIcon },
  { id: "conversation", icon: ReaderNotesIcon },
] as const;

export function ConnectIntroduction() {
  const t = useTranslations("connect");
  return (
    <section
      aria-labelledby="connect-title"
      className="space-y-8 sm:space-y-10"
    >
      <div className="max-w-3xl space-y-5">
        <p className="inline-flex items-center gap-3 font-ui text-xs uppercase tracking-[0.16em] text-muted">
          <ReaderShareIcon aria-hidden="true" className="size-5 text-ink" />
          {t("eyebrow")}
        </p>
        <h1
          id="connect-title"
          className="font-display text-4xl text-ink sm:text-5xl"
        >
          {t("title")}
        </h1>
        <p className="max-w-2xl text-xl leading-8 text-copy sm:text-2xl sm:leading-9">
          {t("body")}
        </p>
      </div>
      <div className="space-y-4">
        <p className="font-ui text-xs uppercase tracking-[0.16em] text-olive">
          {t("comingSoon")}
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map(({ id, icon: Icon }) => (
            <article
              key={id}
              className="flex flex-col items-start rounded-card bg-paper-strong p-6 sm:p-8"
            >
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-soft-fill text-ink">
                <Icon aria-hidden="true" className="size-6" />
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
