import { ScreenContainer } from "@/components/ui/screen-container";

export function CatalogBookSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading book details">
      <ScreenContainer className="py-10 sm:py-16">
        <div
          aria-hidden="true"
          className="space-y-10 animate-pulse motion-reduce:animate-none"
        >
          <div className="h-3 w-28 rounded bg-paper-strong" />
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-16">
            <div className="mx-auto aspect-2/3 w-full max-w-80 rounded-cover bg-paper-strong md:max-w-96 lg:mx-0" />
            <div className="space-y-7">
              <div className="flex gap-2">
                <div className="h-8 w-28 rounded-full bg-paper-strong" />
                <div className="h-8 w-24 rounded-full bg-paper-strong" />
              </div>
              <div className="space-y-3">
                <div className="h-14 w-full rounded bg-paper-strong" />
                <div className="h-14 w-3/4 rounded bg-paper-strong" />
              </div>
              <div className="h-8 w-1/2 rounded bg-paper-strong" />
              <div className="h-12 w-48 rounded-control bg-paper-strong" />
              <div className="grid grid-cols-3 gap-5">
                {[0, 1, 2].map((key) => (
                  <div key={key} className="space-y-3">
                    <div className="h-3 w-2/3 rounded bg-paper-strong" />
                    <div className="h-6 rounded bg-paper-strong" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScreenContainer>
    </div>
  );
}
