// Pulse skeleton shown while the reader shell resolves its payload from Dexie
// or the network (ADR 4). Mirrors the reader's exact chrome (same canvas,
// sidebar offset, and column width as reader-screen.tsx / ready-reader.tsx)
// so the swap to the real screen doesn't shift layout.

export function ReaderShellSkeleton() {
  return (
    <div className="h-dvh bg-paper text-ink">
      <div className="mx-auto h-full max-w-375 overflow-hidden md:pl-20">
        <div className="px-4 pb-2 pt-2 sm:px-6 sm:pb-5 sm:pt-8 md:px-7 md:pt-8 lg:px-8">
          <section className="mx-auto flex h-full max-w-312 min-w-0 flex-col">
            <div className="hidden sm:block">
              <div className="h-7 w-72 animate-pulse rounded bg-paper-strong" />
            </div>
            <div className="mt-4 flex-1 space-y-4 px-3 py-2 sm:mt-8 sm:px-5 sm:py-6 md:px-6">
              {Array.from({ length: 9 }, (_, index) => (
                <div
                  key={index}
                  className="h-4 w-full animate-pulse rounded bg-paper-strong"
                  style={{ opacity: Math.max(0.2, 1 - index * 0.1) }}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
