import type { ReactNode } from "react";

type FeatureCardsProps = {
  label: ReactNode;
  cards: readonly {
    id: string;
    icon: ReactNode;
    title: ReactNode;
    description: ReactNode;
  }[];
};

export function FeatureCards({ label, cards }: FeatureCardsProps) {
  return (
    <div className="space-y-4">
      <p className="font-ui text-[0.675rem] font-bold uppercase tracking-[0.16em] text-olive sm:text-[0.625rem]">
        {label}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ id, icon, title, description }) => (
          <article
            key={id}
            className="flex flex-col items-start rounded-card bg-paper-strong p-6 sm:p-8"
          >
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-paper text-ink [[data-theme=dark]_&]:bg-soft-fill">
              <span className="inline-flex size-6 items-center justify-center">
                {icon}
              </span>
            </span>
            <h2 className="mt-6 font-display text-3xl leading-tight text-title">
              {title}
            </h2>
            <p className="mt-3 text-lg leading-7 text-copy">{description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
