import type { HomePayload } from "@/lib/api-types";

type CurrentEngagement = NonNullable<HomePayload["currentEngagement"]>;

export function EngagementDesktopMeta({
  engagement,
}: {
  engagement: CurrentEngagement;
}) {
  return (
    <div className="hidden md:block">
      <div className="flex items-center gap-12 py-4">
        <div className="space-y-0.5">
          <p className="text-[2.25rem] leading-none text-ink">
            {engagement.completionPercent}%
          </p>
          <p className="text-[0.85rem] uppercase tracking-[0.08em] text-olive">
            Completed
          </p>
        </div>

        <div className="h-12 w-px bg-black/10" />

        <div className="space-y-1">
          <p className="font-display text-2xl leading-[1.05] text-title">
            {engagement.chapterLabel}
          </p>
          <p className="text-[0.75rem] uppercase tracking-widest text-olive">
            Next Milestone
          </p>
        </div>
      </div>
    </div>
  );
}
