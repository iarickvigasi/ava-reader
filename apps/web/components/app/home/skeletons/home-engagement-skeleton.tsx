export function HomeEngagementSkeleton() {
  return (
    <section className="grid gap-8 md:grid-cols-[0.32fr_0.58fr] md:items-start md:gap-8 lg:gap-10">
      <div className="relative hidden md:block">
        <div className="aspect-2/3 w-full max-w-80 rounded-cover bg-paper-strong" />
        <div className="absolute bottom-0 left-full top-0 ml-4 w-0.5 bg-soft-fill" />
      </div>
      <div className="min-w-0 space-y-6 md:space-y-8 md:pt-16">
        <div className="space-y-5 md:space-y-4">
          <div className="h-3 w-40 rounded bg-paper-strong" />
          <div className="space-y-3 py-1">
            <div className="h-10 w-full rounded bg-paper-strong sm:h-12 md:h-14" />
            <div className="h-10 w-5/6 rounded bg-paper-strong sm:h-12 md:h-14" />
            <div className="h-10 w-2/3 rounded bg-paper-strong sm:h-12 md:h-14" />
          </div>
          <div className="h-6 w-3/5 rounded bg-paper-strong sm:h-8" />
        </div>
        <div className="space-y-4 rounded-card bg-soft-fill px-5 py-6 md:hidden">
          <div className="h-3 w-32 rounded bg-paper-strong" />
          <div className="h-7 w-5/6 rounded bg-paper-strong" />
          <div className="h-3 w-40 rounded bg-paper-strong" />
        </div>
        <div className="hidden items-center gap-12 py-4 md:flex">
          <div className="space-y-2">
            <div className="h-9 w-16 rounded bg-paper-strong" />
            <div className="h-3 w-24 rounded bg-paper-strong" />
          </div>
          <div className="h-12 w-px bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-5/6 rounded bg-paper-strong" />
            <div className="h-3 w-32 rounded bg-paper-strong" />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="hidden h-12 w-56 max-w-[45%] rounded-control bg-paper-strong md:block" />
          <div className="h-12 w-full rounded-control bg-paper-strong sm:w-64 md:max-w-[50%]" />
        </div>
      </div>
    </section>
  );
}
