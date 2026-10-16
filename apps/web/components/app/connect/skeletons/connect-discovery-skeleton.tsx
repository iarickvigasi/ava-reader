export function ConnectDiscoverySkeleton() {
  return (
    <section className="space-y-6">
      <div className="h-9 w-72 max-w-full rounded bg-paper-strong sm:h-10" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-5 rounded-card bg-soft-fill p-6">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-full bg-paper-strong" />
              <div className="h-5 w-32 rounded bg-paper-strong" />
            </div>
            <div className="space-y-3">
              <div className="h-4 rounded bg-paper-strong" />
              <div className="h-4 rounded bg-paper-strong" />
              <div className="h-4 w-2/3 rounded bg-paper-strong" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
