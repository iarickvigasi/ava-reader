import { FeatureCards } from "@/components/app/shared/feature-cards";

export function ConnectIntroductionSkeleton() {
  return (
    <section className="space-y-8 sm:space-y-10">
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="size-4 rounded bg-paper-strong" />
          <div className="h-3 w-24 rounded bg-paper-strong" />
        </div>
        <div className="h-10 w-full rounded bg-paper-strong sm:h-12" />
        <div className="max-w-2xl space-y-4 py-2">
          <div className="h-5 rounded bg-paper-strong sm:h-6" />
          <div className="h-5 rounded bg-paper-strong sm:h-6" />
          <div className="h-5 w-2/3 rounded bg-paper-strong sm:h-6" />
        </div>
      </div>
      <FeatureCards
        label={<span className="block h-3 w-24 rounded bg-paper-strong" />}
        cards={Array.from({ length: 3 }, (_, index) => ({
          id: String(index),
          icon: <span className="size-6 rounded-full bg-paper-strong" />,
          title: (
            <span className="block space-y-3">
              <span className="block h-7 w-48 max-w-full rounded bg-paper" />
              <span className="block h-7 w-36 max-w-full rounded bg-paper" />
            </span>
          ),
          description: (
            <span className="block space-y-4 py-1">
              {Array.from({ length: 5 }, (_, line) => (
                <span
                  key={line}
                  className="block h-3 w-full rounded bg-paper"
                />
              ))}
            </span>
          ),
        }))}
      />
      <div className="space-y-3 rounded-shell bg-soft-fill px-6 py-6 sm:px-8">
        <div className="h-8 w-64 max-w-full rounded bg-paper-strong" />
        <div className="h-5 max-w-3xl rounded bg-paper-strong" />
        <div className="h-5 max-w-2xl rounded bg-paper-strong" />
      </div>
    </section>
  );
}
