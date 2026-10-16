import { ScreenContainer } from "@/components/ui/screen-container";
import { ConnectIntroductionSkeleton } from "./skeletons/connect-introduction-skeleton";
import { ConnectProfileSkeleton } from "./skeletons/connect-profile-skeleton";
import { ConnectDiscoverySkeleton } from "./skeletons/connect-discovery-skeleton";

export function ConnectScreenSkeleton() {
  return (
    <ScreenContainer className="gap-10 py-10 sm:gap-16 sm:py-16">
      <div aria-busy="true" aria-label="Loading page">
        <div
          aria-hidden="true"
          className="flex flex-col gap-10 animate-pulse motion-reduce:animate-none sm:gap-16"
        >
          <ConnectIntroductionSkeleton />
          <ConnectProfileSkeleton />
          <ConnectDiscoverySkeleton />
        </div>
      </div>
    </ScreenContainer>
  );
}
