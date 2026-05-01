import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRightIcon } from "@/components/app/shared/app-icons";
import type { HomePayload } from "@/lib/api-types";

type CurrentEngagement = NonNullable<HomePayload["currentEngagement"]>;

const RAIL_MIN_PERCENT = 18;

export function EngagementMobileCard({
  engagement,
  readerHref,
}: {
  engagement: CurrentEngagement;
  readerHref: string;
}) {
  const t = useTranslations("home.engagement");
  const railHeightPercent = Math.min(
    Math.max(engagement.completionPercent, RAIL_MIN_PERCENT),
    100,
  );

  return (
    <div className="relative overflow-hidden rounded-md bg-soft-fill px-5 py-6 sm:grid sm:gap-5 sm:rounded-[22px] sm:p-6 sm:grid-cols-[auto_1px_1fr] sm:items-center md:hidden">
      <div className="absolute inset-y-0 left-0 w-0.5 bg-[#eae1db]">
        <div
          className="w-full bg-ink"
          style={{ height: `${railHeightPercent}%` }}
        />
      </div>
      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-olive">
          {t("nextMilestoneMobile")}
        </p>
        <p className="mt-3 font-display text-[1.35rem] leading-[1.35] text-title sm:text-2xl">
          {engagement.chapterLabel}
        </p>
        <Link
          href={readerHref}
          className="mt-4 inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink"
        >
          {t("resumeReading")}
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>
      <div className="hidden h-14 w-px bg-line sm:block" />
      <div className="hidden sm:block">
        <p className="text-4xl text-ink">{engagement.completionPercent}%</p>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive">
          {t("completed")}
        </p>
      </div>
    </div>
  );
}
