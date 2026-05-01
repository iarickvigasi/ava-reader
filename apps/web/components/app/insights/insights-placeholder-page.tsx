import { useTranslations } from "next-intl";
import {
  ChartIcon,
  HighlighterIcon,
  ReadingTimeIcon,
  StackBooksIcon,
} from "@/components/app/shared/app-icons";
import { ButtonLink } from "@/components/ui/button";

const metricsPreview = [
  {
    id: "readingTime",
    icon: ReadingTimeIcon,
    value: "4h 32m",
  },
  {
    id: "highlights",
    icon: HighlighterIcon,
    value: "19",
  },
  {
    id: "booksOpened",
    icon: StackBooksIcon,
    value: "6",
  },
] as const;

export function InsightsPlaceholderPage() {
  const t = useTranslations("insights");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-10">
      <section className="rounded-[28px] bg-surface px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl space-y-5">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-muted">
            <ChartIcon className="size-4" />
            {t("eyebrow")}
          </p>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">
            {t("title")}
          </h1>
          <p className="text-lg leading-8 text-copy">{t("body")}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink href="/app" variant="soft">
              {t("backToHome")}
            </ButtonLink>
            <ButtonLink href="/app/library">{t("goToLibrary")}</ButtonLink>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {metricsPreview.map((metric) => {
          const Icon = metric.icon;

          return (
            <article
              key={metric.id}
              className="rounded-3xl border border-line/60 bg-paper-strong/70 px-5 py-5"
            >
              <p className="inline-flex size-10 items-center justify-center rounded-2xl bg-soft-fill text-ink">
                <Icon className="size-5" />
              </p>
              <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-olive">
                {t(`metrics.${metric.id}.label`)}
              </p>
              <p className="mt-2 font-display text-[2.25rem] leading-none text-title">
                {metric.value}
              </p>
              <p className="mt-2 text-sm text-copy">
                {t(`metrics.${metric.id}.helper`)}
              </p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
