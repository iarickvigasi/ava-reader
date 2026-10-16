import { PageSkeletonShell } from "@/components/app/shared/page-skeleton-shell";

export function CatalogScreenSkeleton() {
  return (
    <PageSkeletonShell>
      <div className="flex gap-4">
        <div className="h-12 flex-1 rounded-control bg-paper-strong" />
        <div className="h-12 w-32 rounded-control bg-paper-strong" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-20 rounded-card bg-paper-strong" />
        ))}
      </div>
    </PageSkeletonShell>
  );
}
