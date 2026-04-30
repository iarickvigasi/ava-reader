import Link from "next/link";
import type { HomePayload } from "@/lib/api-types";
import { formatAuthors } from "@/lib/format-authors";
import { SectionEyebrow } from "../../shared/home-shared";

type CurrentEngagement = NonNullable<HomePayload["currentEngagement"]>;

export function EngagementHeading({
  engagement,
  readerHref,
}: {
  engagement: CurrentEngagement;
  readerHref: string;
}) {
  return (
    <div className="space-y-5 md:space-y-4">
      <SectionEyebrow>Currently Engaged</SectionEyebrow>
      <Link href={readerHref} className="block w-fit">
        <h1 className="max-w-2xl font-display text-[3rem] leading-[1.05] tracking-[-0.05em] text-ink transition hover:opacity-80 sm:text-6xl sm:leading-[1.04] md:max-w-none md:text-[3.5rem] md:leading-[1.1] md:tracking-[-0.02em]">
          {engagement.title}
        </h1>
      </Link>
      <div className="flex items-center gap-4 text-sm uppercase tracking-[0.08em] text-muted sm:flex-col sm:items-start sm:gap-2 sm:text-base sm:normal-case sm:tracking-normal md:block">
        <p className="text-lg italic normal-case tracking-normal text-plum sm:text-2xl">
          {formatAuthors(engagement.authors)}
        </p>
        <span className="h-px w-12 bg-line sm:hidden" />
        <p className="font-semibold text-copy sm:text-xs sm:uppercase sm:tracking-[0.18em] md:hidden">
          {engagement.completionPercent}% Completed
        </p>
      </div>
    </div>
  );
}
