import type { HomePayload } from "@/lib/api-types";

type Listening = NonNullable<HomePayload["listening"]>;

// Below `md` this block sits beside the cover in a column roughly 55% of the
// card's inner width — ~150px on a 390pt phone. The title font scales with the
// viewport so the same words fit on narrow and wide phones alike, and
// `hyphens-auto` (Tailwind emits the `-webkit-` prefix Safari needs, and
// `<html lang>` supplies the dictionary) breaks whatever still overruns.
// `min-w-0` lets the grid column shrink below its content: without it a long
// unbreakable word widens the column and squeezes the cover.
export function ListeningHeading({ listening }: { listening: Listening }) {
  return (
    <div className="min-w-0">
      <h2 className="line-clamp-5 hyphens-auto break-words font-display text-[length:clamp(1.5rem,7.5vw,2rem)] leading-[1.1] text-ink sm:text-4xl md:line-clamp-3">
        {listening.title}
      </h2>
      <p className="mt-1 text-sm italic tracking-[0.02em] text-plum sm:text-xl">
        {listening.authorLine}
      </p>
    </div>
  );
}
