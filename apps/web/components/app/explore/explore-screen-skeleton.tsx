import { PageSkeletonShell } from "@/components/app/shared/page-skeleton-shell";

export function ExploreScreenSkeleton() {
  return (
    <PageSkeletonShell>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-4">
            <div className="aspect-2/3 rounded-cover bg-paper-strong" />
            <div className="h-8 rounded-control bg-paper-strong" />
            <div className="h-4 w-2/3 rounded bg-paper-strong" />
          </div>
        ))}
      </div>
    </PageSkeletonShell>
  );
}
