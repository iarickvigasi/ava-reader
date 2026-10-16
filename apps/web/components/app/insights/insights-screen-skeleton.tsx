import { PageSkeletonShell } from "@/components/app/shared/page-skeleton-shell";

export function InsightsScreenSkeleton() {
  return (
    <PageSkeletonShell>
      <div className="h-64 rounded-modal bg-paper-strong" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-48 rounded-card bg-paper-strong" />
        ))}
      </div>
    </PageSkeletonShell>
  );
}
