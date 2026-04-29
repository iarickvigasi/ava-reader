import {
  ChartIcon,
  HighlighterIcon,
  ReadingTimeIcon,
  StackBooksIcon,
} from "@/components/app/shared/app-icons";
import { ButtonLink } from "@/components/ui/button";

const metricsPreview = [
  {
    helper: "This week",
    icon: ReadingTimeIcon,
    label: "Reading Time",
    value: "4h 32m",
  },
  {
    helper: "Across active books",
    icon: HighlighterIcon,
    label: "Highlights",
    value: "19",
  },
  {
    helper: "Sessions tracked",
    icon: StackBooksIcon,
    label: "Books Opened",
    value: "6",
  },
] as const;

export function InsightsPlaceholderPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-10">
      <section className="rounded-[28px] bg-surface px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl space-y-5">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-muted">
            <ChartIcon className="size-4" />
            Insights
          </p>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">
            Insights will deepen after the reader ships
          </h1>
          <p className="text-lg leading-8 text-copy">
            Home already surfaces reading progress and recent activity. The
            dedicated Insights screen will package those signals into trend
            views built for reflection and planning.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink href="/app" variant="soft">
              Back to Home
            </ButtonLink>
            <ButtonLink href="/app/library">Go to Library</ButtonLink>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {metricsPreview.map((metric) => {
          const Icon = metric.icon;

          return (
            <article
              key={metric.label}
              className="rounded-3xl border border-line/60 bg-paper-strong/70 px-5 py-5"
            >
              <p className="inline-flex size-10 items-center justify-center rounded-2xl bg-soft-fill text-ink">
                <Icon className="size-5" />
              </p>
              <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-olive">
                {metric.label}
              </p>
              <p className="mt-2 font-display text-[2.25rem] leading-none text-title">
                {metric.value}
              </p>
              <p className="mt-2 text-sm text-copy">{metric.helper}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
