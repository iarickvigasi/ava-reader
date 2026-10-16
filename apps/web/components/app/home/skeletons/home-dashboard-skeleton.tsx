import { HomeFeaturedSkeleton } from "./home-featured-skeleton";

export function HomeDashboardSkeleton() {
  return (
    <>
      <section className="space-y-8">
        <div className="h-3 w-40 rounded bg-paper-strong" />
        <div className="grid grid-cols-[42%_1fr] gap-6 rounded-card bg-soft-fill p-6 md:grid-cols-[192px_1fr]">
          <div className="aspect-square rounded-cover bg-paper-strong" />
          <div className="space-y-4">
            <div className="h-8 w-full rounded bg-paper-strong" />
            <div className="h-5 w-2/3 rounded bg-paper-strong" />
            <div className="hidden h-16 rounded-control bg-paper-strong md:block" />
          </div>
          <div className="col-span-2 h-16 rounded-control bg-paper-strong md:hidden" />
        </div>
      </section>
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="h-60 rounded-card bg-paper-strong" />
        <div className="grid grid-cols-3 gap-4 lg:grid-cols-1">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-20 rounded-card bg-paper-strong" />
          ))}
        </div>
      </section>
      <div className="space-y-4 py-6">
        <div className="mx-auto h-6 w-5/6 rounded bg-paper-strong" />
        <div className="mx-auto h-6 w-2/3 rounded bg-paper-strong" />
        <div className="mx-auto h-4 w-32 rounded bg-paper-strong" />
      </div>
      <HomeFeaturedSkeleton />
      <section className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="h-72 rounded-card bg-paper-strong" />
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-20 rounded-card bg-paper-strong" />
          ))}
        </div>
      </section>
      <section className="grid gap-6 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-40 rounded-card bg-paper-strong" />
        ))}
      </section>
      <section className="grid gap-16 lg:grid-cols-2">
        <div className="h-60 rounded-card bg-paper-strong" />
        <div className="h-60 rounded-card bg-paper-strong" />
      </section>
    </>
  );
}
