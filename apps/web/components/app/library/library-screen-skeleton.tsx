import { LibraryScreenShell } from "./library-screen-shell";
import { LibraryHeader } from "./library-sections/library-header";
import { LibraryFeaturesSection } from "./library-sections/library-features-section";
import { LibraryHeaderBarSkeleton } from "./library-sections/header-bar";
import { CollectionSectionSkeleton } from "./library-sections/collection-section";

export function LibraryScreenSkeleton() {
  return (
    <LibraryScreenShell>
      <LibraryHeader />
      <LibraryFeaturesSection />
      <LibraryHeaderBarSkeleton />

      <div className="space-y-12 md:space-y-14">
        {Array.from({ length: 3 }, (_, index) => (
          <CollectionSectionSkeleton key={index} />
        ))}
      </div>
    </LibraryScreenShell>
  );
}
