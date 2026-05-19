import { useTranslations } from "next-intl";
import type { ComponentType, SVGProps } from "react";
import {
  HighlighterIcon,
  ReadingTimeIcon,
  SparkIcon,
  StackBooksIcon,
} from "@/components/app/shared/app-icons";
import type { HomePayload } from "@/lib/api-types";
import { Panel, SectionEyebrow } from "../shared/home-shared";

type Stats = HomePayload["stats"];

type StatItem = {
  id: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName?: string;
  label: string;
  value: number;
};

export function StatsPanel({ stats }: { stats: Stats }) {
  const t = useTranslations("home.stats");
  const items = buildStatItems(stats, t);

  return (
    <>
      <section className="space-y-4 sm:hidden">
        <div className="space-y-4 border-y border-line/30 py-10">
          <SectionEyebrow>{t("title")}</SectionEyebrow>
          <div className="grid grid-cols-4 gap-2">
            {items.map((item) => (
              <div key={item.id} className="min-w-0 space-y-1 text-center">
                <p className="text-[1.35rem] leading-none text-ink">{item.value}</p>
                <p className="text-[0.5rem] leading-tight font-semibold uppercase tracking-widest text-olive">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="hidden gap-4 sm:grid">
        {items.map((item) => (
          <Panel key={item.id} className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-4xl text-ink">{item.value}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-olive">
                  {item.label}
                </p>
              </div>
              <item.icon
                className={`h-5 w-auto shrink-0 text-title${item.iconClassName ? ` ${item.iconClassName}` : ""}`}
              />
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

function buildStatItems(
  stats: Stats,
  t: (key: string) => string,
): StatItem[] {
  return [
    { id: "booksRead", label: t("booksRead"), value: stats.volumesRead, icon: StackBooksIcon },
    { id: "highlights", label: t("highlights"), value: stats.highlights, icon: HighlighterIcon },
    {
      id: "hoursReading",
      label: t("hoursReading"),
      value: stats.hoursReading,
      icon: ReadingTimeIcon,
      iconClassName: "scale-125",
    },
    {
      id: "aiComments",
      label: t("aiComments"),
      value: stats.aiComments,
      icon: SparkIcon,
      iconClassName: "scale-125",
    },
  ];
}
