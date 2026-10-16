export function HomeFeaturedSkeleton() {
  return (
    <section className="space-y-6">
      <div className="h-3 w-40 rounded bg-paper-strong" />
      <div className="grid grid-cols-2 gap-4 md:gap-5">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="space-y-3 md:grid md:grid-cols-[120px_1fr] md:gap-5 md:space-y-0 md:rounded-card md:bg-soft-fill md:p-6"
          >
            <div className="aspect-2/3 w-full rounded-cover bg-paper-strong md:w-28" />
            <div className="space-y-4">
              <div className="h-7 rounded bg-paper-strong" />
              <div className="h-3 w-2/3 rounded bg-paper-strong" />
              <div className="hidden h-20 rounded bg-paper-strong md:block" />
              <div className="hidden h-10 w-32 rounded-control bg-paper-strong md:block" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
