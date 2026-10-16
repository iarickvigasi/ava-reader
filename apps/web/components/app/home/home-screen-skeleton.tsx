import { HomeEngagementSkeleton } from "./skeletons/home-engagement-skeleton";
import { HomeDashboardSkeleton } from "./skeletons/home-dashboard-skeleton";

export function HomeScreenSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading page"
      className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-8 py-8 sm:gap-20 sm:px-6 sm:py-10 lg:gap-28 lg:px-10 lg:py-12"
    >
      <div
        aria-hidden="true"
        className="flex flex-col gap-16 animate-pulse motion-reduce:animate-none sm:gap-20 lg:gap-28"
      >
        <HomeEngagementSkeleton />
        <HomeDashboardSkeleton />
      </div>
    </div>
  );
}
