import type { HomePayload } from "@/lib/api-types";
import { getReaderHref } from "@/lib/app-routes";
import { EngagementCover } from "./engagement-cover";
import { EngagementDesktopMeta } from "./engagement-desktop-meta";
import { EngagementHeading } from "./engagement-heading";
import { EngagementImportButtons } from "./engagement-import-buttons";
import { EngagementMobileCard } from "./engagement-mobile-card";
import { HomeResumeActions } from "./home-resume-actions";

type CurrentEngagement = NonNullable<HomePayload["currentEngagement"]>;

export function CurrentEngagementSection({
  engagement,
}: {
  engagement: CurrentEngagement;
}) {
  const readerHref = getReaderHref(engagement.id);

  return (
    <section className="grid gap-8 md:grid-cols-[0.32fr_0.58fr] md:items-start md:gap-8 lg:gap-10">
      <EngagementCover engagement={engagement} readerHref={readerHref} />

      <div className="space-y-6 md:space-y-8 md:pt-16">
        <EngagementHeading engagement={engagement} readerHref={readerHref} />
        <EngagementMobileCard engagement={engagement} readerHref={readerHref} />
        <EngagementDesktopMeta engagement={engagement} />
        <EngagementImportButtons />
        <HomeResumeActions readerHref={readerHref} />
      </div>
    </section>
  );
}
