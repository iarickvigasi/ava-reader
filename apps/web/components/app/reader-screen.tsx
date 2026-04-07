import Link from "next/link";
import type { HomePayload } from "@/lib/api-types";
import { cn } from "@/lib/cn";

const readerEnglishParagraphs = [
  "One of the most surprising features of architecture is its capacity to conjure up a certain mood. We can walk into a building and feel a sudden sense of calm, or conversely, a mounting anxiety.",
  "It is difficult to say why a certain arrangement of windows or the choice of stone for a floor should affect us so deeply. And yet, we are constantly responding to the spaces we inhabit, measuring our own internal states against the proportions of the rooms where we spend our days.",
  "There is a common assumption that we are essentially the same people wherever we go, that our personalities are portable. But architecture suggests otherwise. It implies that we are, to a greater extent than we might like to admit, the playthings of our environment.",
] as const;

const readerTranslationParagraphs = [
  "It is difficult to say why a certain arrangement of windows or the choice of stone for a floor should affect us so deeply. And yet, we are constantly responding to the spaces we inhabit, measuring our own internal states against the proportions of the rooms where we spend our days.",
  "One of the most surprising features of architecture is its capacity to conjure up a certain mood. We can walk into a building and feel a sudden sense of calm, or conversely, a mounting anxiety.",
  "One of the most surprising features of architecture is its capacity to conjure up a certain mood. We can walk into a building and feel a sudden sense of calm, or conversely, a mounting anxiety.",
] as const;

type ReaderScreenProps = {
  currentEngagement: NonNullable<HomePayload["currentEngagement"]>;
};

export function ReaderScreen({ currentEngagement }: ReaderScreenProps) {
  return (
    <div className="bg-paper text-ink">
      <div className="mx-auto min-h-screen max-w-[1440px] md:pl-[88px]">
        <div className="grid min-h-screen md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
          <section className="px-6 pb-16 pt-24 sm:px-10 md:px-12 md:pt-[4.1rem] lg:px-16">
            <div className="mx-auto max-w-[33.125rem]">
              <ReaderHeader currentEngagement={currentEngagement} />
              <ReaderArticle
                className="mt-12 md:mt-16"
                paragraphs={readerEnglishParagraphs}
              />
            </div>
          </section>

          <div className="hidden md:block md:bg-[rgba(194,199,204,0.2)]" />

          <section className="border-t border-line/30 px-6 pb-16 pt-12 sm:px-10 md:border-t-0 md:px-12 md:pt-[4.75rem] lg:px-16">
            <div className="mx-auto max-w-[35.5rem] opacity-90">
              <ReaderArticle paragraphs={readerTranslationParagraphs} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ReaderHeader({
  currentEngagement,
}: {
  currentEngagement: NonNullable<HomePayload["currentEngagement"]>;
}) {
  return (
    <header>
      <div className="max-w-[24.5rem]">
        <h1 className="font-[var(--font-reader)] text-[3.25rem] leading-[0.95] font-bold tracking-[-0.075rem] text-ink sm:text-[4.25rem]">
          {currentEngagement.title}
        </h1>
      </div>
      <p className="mt-5 font-[var(--font-ui)] text-[0.72rem] uppercase tracking-[0.2em] text-ink/45">
        {formatReaderSubline(currentEngagement)}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3 md:hidden">
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center rounded-[12px] border border-line bg-soft-fill px-4 font-[var(--font-ui)] text-xs font-medium uppercase tracking-[0.16em] text-ink transition hover:bg-paper-strong"
        >
          Back to library
        </Link>
        <p className="font-[var(--font-ui)] text-xs uppercase tracking-[0.16em] text-ink/45">
          {currentEngagement.completionPercent}% complete
        </p>
      </div>
    </header>
  );
}

function ReaderArticle({
  className,
  paragraphs,
}: {
  className?: string;
  paragraphs: readonly string[];
}) {
  return (
    <article className={cn("space-y-11 md:space-y-12", className)}>
      {paragraphs.map((paragraph, index) => (
        <p
          key={`${index}-${paragraph.slice(0, 18)}`}
          className="font-[var(--font-reader)] text-[1.7rem] leading-[1.95] tracking-[-0.01em] text-ink max-[479px]:text-[1.35rem] md:text-[2rem] md:leading-[2.2]"
        >
          {paragraph}
        </p>
      ))}
    </article>
  );
}

function formatReaderSubline(
  currentEngagement: NonNullable<HomePayload["currentEngagement"]>,
) {
  const chapter = currentEngagement.chapterLabel.toUpperCase();

  if (currentEngagement.author) {
    return `${currentEngagement.author.toUpperCase()} — ${chapter}`;
  }

  return chapter;
}
