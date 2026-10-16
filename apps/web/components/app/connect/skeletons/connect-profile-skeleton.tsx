export function ConnectProfileSkeleton() {
  return (
    <section className="min-w-0">
      <div className="mb-6 space-y-3">
        <div className="mx-auto h-3 w-32 rounded bg-paper-strong" />
        <div className="mx-auto h-10 w-2/3 rounded bg-paper-strong sm:h-12" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-12">
          <div className="space-y-3">
            <div className="h-4 w-32 rounded bg-paper-strong" />
            <div className="h-28 rounded-card bg-soft-fill" />
            <div className="h-4 w-48 rounded bg-paper-strong" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-7 w-12 rounded-full bg-paper-strong" />
            <div className="h-5 w-48 rounded bg-paper-strong" />
          </div>
          <div className="h-12 w-48 rounded-control bg-paper-strong" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-32 rounded bg-paper-strong" />
          <div className="flex items-center gap-4 rounded-card bg-soft-fill p-6">
            <div className="size-14 rounded-full bg-paper-strong" />
            <div className="h-6 w-40 rounded bg-paper-strong" />
          </div>
        </div>
      </div>
    </section>
  );
}
