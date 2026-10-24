export function CatalogEditionsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading editions">
      <div
        aria-hidden="true"
        className="grid gap-5 animate-pulse motion-reduce:animate-none lg:grid-cols-2"
      >
        {[0, 1].map((key) => (
          <div
            key={key}
            className="space-y-5 rounded-card bg-paper-strong/60 p-5"
          >
            <div className="h-7 w-3/4 rounded bg-paper-strong" />
            <div className="grid grid-cols-3 gap-5">
              {[0, 1, 2].map((item) => (
                <div key={item} className="space-y-3">
                  <div className="h-3 w-2/3 rounded bg-paper-strong" />
                  <div className="h-6 rounded bg-paper-strong" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
