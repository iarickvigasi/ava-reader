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
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
};

export function StatsPanel({ stats }: { stats: Stats }) {
  const items = buildStatItems(stats);

  return (
    <>
      <section className="space-y-4 sm:hidden">
        <div className="space-y-4 border-y border-line/30 py-10">
          <SectionEyebrow>Library Metrics</SectionEyebrow>
          <div className="grid grid-cols-4 gap-2">
            {items.map((item) => (
              <div key={item.label} className="min-w-0 space-y-1 text-center">
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
          <Panel key={item.label} className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-4xl text-ink">{item.value}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-olive">
                  {item.label}
                </p>
              </div>
              <item.icon className="h-5 w-auto shrink-0 text-title" />
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

function buildStatItems(stats: Stats): StatItem[] {
  return [
    { label: "Books Read", value: stats.volumesRead, icon: StackBooksIcon },
    { label: "Highlights", value: stats.highlights, icon: HighlighterIcon },
    { label: "Hours Reading", value: stats.hoursReading, icon: ReadingTimeIcon },
    { label: "AI Comments", value: stats.aiComments, icon: SparkIcon },
  ];
}
