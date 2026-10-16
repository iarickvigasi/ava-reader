import { PageSkeletonShell } from "@/components/app/shared/page-skeleton-shell";

export function ReaderStartupSkeleton() {
  return (
    <PageSkeletonShell>
      <div className="grid gap-8 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, column) => (
          <div key={column} className="space-y-5">
            {Array.from({ length: 15 }, (_, line) => (
              <div key={line} className="h-4 rounded bg-paper-strong" />
            ))}
          </div>
        ))}
      </div>
    </PageSkeletonShell>
  );
}
