import { PageSkeletonShell } from "@/components/app/shared/page-skeleton-shell";

export function BookInfoStartupSkeleton() {
  return (
    <PageSkeletonShell>
      <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
        <div className="aspect-2/3 max-w-80 rounded-cover bg-paper-strong" />
        <div className="h-64 rounded-card bg-paper-strong" />
      </div>
      <div className="h-64 rounded-card bg-paper-strong" />
    </PageSkeletonShell>
  );
}
