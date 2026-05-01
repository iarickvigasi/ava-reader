import { useTranslations } from "next-intl";
import { ImportButton } from "@/components/app/shared/import-button";
import type { HomePayload } from "@/lib/api-types";
import { ActionCard, LinkAction, SectionEyebrow } from "../shared/home-shared";

type EmptyHomeStateProps = {
  home: HomePayload;
};

export function EmptyHomeState({ home }: EmptyHomeStateProps) {
  const t = useTranslations("home.empty");
  const hasFeaturedCatalog = home.featuredCatalog.entries.length > 0;

  return (
    <section className="grid gap-12 lg:grid-cols-[2fr_3fr] lg:items-center">
      <div className="space-y-6 pt-4">
        <SectionEyebrow>{t("greeting")}</SectionEyebrow>
        <h1 className="max-w-md font-display text-5xl leading-[1.05] tracking-[-0.04em] text-ink sm:text-6xl">
          {t("welcome")}
        </h1>
        <p className="max-w-md text-xl leading-8 text-title">{t("intro")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard
          title={t("import.title")}
          description={t("import.body")}
          action={
            <ImportButton
              variant="primary"
              label={t("import.action")}
              className="w-full"
            />
          }
        />
        <ActionCard
          title={t("explore.title")}
          description={
            hasFeaturedCatalog ? t("explore.body") : t("explore.comingSoon")
          }
          action={
            <LinkAction
              href="/app/explore"
              label={t("explore.action")}
              className="w-full"
            />
          }
        />
      </div>
    </section>
  );
}
