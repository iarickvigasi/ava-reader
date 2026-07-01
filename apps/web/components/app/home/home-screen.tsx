import type { HomePayload } from "@/lib/api-types";
import { CollectionsPanel } from "./sections/collections-panel";
import { CurrentEngagementSection } from "./sections/current-engagement/current-engagement-section";
import { DashboardFooter } from "./sections/dashboard-footer";
import { EmptyHomeState } from "./sections/empty-home-state";
import { FeaturedBooksSection } from "./sections/featured-books/featured-books-section";
import { FeedbackSection } from "./sections/feedback/feedback-section";
import { ListeningSection } from "./sections/listening/listening-section";
import {
  MasteryPanelWithDeltas,
  StatsPanelWithDeltas,
} from "./sections/home-stats-with-deltas";
import { QuoteSection } from "./sections/quote-section";
import { RecentAnnotationsPanel } from "./sections/recent-annotations-panel";

type HomeScreenProps = {
  home: HomePayload;
};

export function HomeScreen({ home }: HomeScreenProps) {
  const engagement =
    home.state === "POPULATED" ? home.currentEngagement : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-8 py-8 sm:gap-20 sm:px-6 sm:py-10 lg:gap-28 lg:px-10 lg:py-12">
      {engagement ? (
        <PopulatedHome engagement={engagement} home={home} />
      ) : (
        <EmptyHomeState home={home} />
      )}

      <QuoteSection />
      <FeaturedBooksSection entries={home.featuredCatalog.entries} />

      {engagement ? (
        <section className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <CollectionsPanel collections={home.collections.items} />
          <RecentAnnotationsPanel annotations={home.recentAnnotations.items} />
        </section>
      ) : null}

      <FeedbackSection />
      <DashboardFooter />
    </div>
  );
}

function PopulatedHome({
  engagement,
  home,
}: {
  engagement: NonNullable<HomePayload["currentEngagement"]>;
  home: HomePayload;
}) {
  return (
    <>
      <CurrentEngagementSection engagement={engagement} />

      {home.listening ? (
        <ListeningSection
          coverImageUrl={engagement.coverImageUrl}
          listening={home.listening}
        />
      ) : null}

      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        {/* WithDeltas wrappers augment the server payload with live
            offline deltas (unsynced sessions / pending highlights /
            locally-completed books) before handing them to the panels.
            The panels themselves are dumb and unchanged. */}
        <MasteryPanelWithDeltas home={home} />
        <StatsPanelWithDeltas home={home} />
      </section>
    </>
  );
}
