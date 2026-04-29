import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  HighlighterIcon,
  NowListeningHeaderIcon,
  QuoteMarkIcon,
  ReadingTimeIcon,
  SparkIcon,
  StackBooksIcon,
} from "@/components/app/shared/app-icons";
import { BookCover } from "@/components/app/shared/book-cover";
import { CatalogAddButton } from "@/components/app/home/catalog-add-button";
import { FeedbackForm } from "@/components/app/home/feedback-form";
import { LibraryImportButton } from "@/components/app/library/library-import-button";
import { ListeningControls } from "@/components/app/home/listening-controls";
import { HomeResumeActions } from "@/components/app/home/home-resume-actions";
import type { HomePayload } from "@/lib/api-types";
import { APP_LIBRARY_HREF } from "@/lib/app-routes";
import { cn } from "@/lib/cn";
import { formatAuthors } from "@/lib/format-authors";

type HomeScreenProps = {
  home: HomePayload;
};

export function HomeScreen({ home }: HomeScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-8 py-8 sm:gap-20 sm:px-6 sm:py-10 lg:gap-28 lg:px-10 lg:py-12">
      {home.state === "EMPTY" ? (
        <EmptyHomeState home={home} />
      ) : (
        <PopulatedHomeState home={home} />
      )}

      <QuoteSection />
      <FeaturedBooksSection entries={home.featuredCatalog.entries} />

      {home.state === "POPULATED" ? (
        <section className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <CollectionsPanel collections={home.collections.items} />
          <RecentAnnotationsPanel annotations={home.recentAnnotations.items} />
        </section>
      ) : null}

      <FeedbackSection />
      <DashboardFooter />
    </div>
  );
}

function EmptyHomeState({ home }: HomeScreenProps) {
  return (
    <section className="grid gap-12 lg:grid-cols-[2fr_3fr] lg:items-center">
      <div className="space-y-6 pt-4">
        <SectionEyebrow>Hello, friend</SectionEyebrow>
        <h1 className="max-w-md font-display text-5xl leading-[1.05] tracking-[-0.04em] text-ink sm:text-6xl">
          Welcome to AVA Reader
        </h1>
        <p className="max-w-md text-xl leading-8 text-title">
          Let&apos;s start your exploration. Choose a book to dive into and we&apos;ll
          shape the rest of the reader around it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard
          title="Import Your First Book"
          description="Bring your EPUB or PDF into a private library that follows you across devices."
          action={
            <LibraryImportButton
              variant="primary"
              label="Upload book"
              className="w-full"
            />
          }
        />
        <ActionCard
          title="Explore Public Domain Books"
          description={
            home.featuredCatalog.entries.length > 0
              ? "Start with a curated public-domain title and add it to your shelf in one tap."
              : "Public domain books catalog is in progress."
          }
          action={<LinkAction href="/app/explore" label="Browse Catalog" />}
        />
      </div>
    </section>
  );
}

function PopulatedHomeState({ home }: HomeScreenProps) {
  if (!home.currentEngagement) {
    return <EmptyHomeState home={home} />;
  }

  const readerHref = getReaderHref(home.currentEngagement.id);

  return (
    <>
      <section className="grid gap-8 md:grid-cols-[0.32fr_0.58fr] md:items-start md:gap-8 lg:gap-10">
        <div className="relative hidden md:block">
          <div className="absolute bottom-0 left-full top-0 ml-4 w-0.5 bg-soft-fill">
            <div
              className="w-full bg-brand-fill"
              style={{
                height: `${Math.min(Math.max(home.currentEngagement.completionPercent, 2), 100)}%`,
              }}
            />
          </div>
          <Link
            href={readerHref}
            aria-label={`Open ${home.currentEngagement.title}`}
            className="block"
          >
            <BookCover
              alt={`${home.currentEngagement.title} cover`}
              className="mx-auto aspect-[0.72] w-full max-w-72 rounded-xs shadow-(--shadow-card) md:mx-0 md:max-w-80"
              src={home.currentEngagement.coverImageDataUrl}
              title={home.currentEngagement.title}
            />
          </Link>
        </div>

        <div className="space-y-6 md:space-y-8 md:pt-16">
          <div className="space-y-5 md:space-y-4">
            <SectionEyebrow>Currently Engaged</SectionEyebrow>
            <Link href={readerHref} className="block w-fit">
              <h1 className="max-w-2xl font-display text-[3rem] leading-[1.05] tracking-[-0.05em] text-ink transition hover:opacity-80 sm:text-6xl sm:leading-[1.04] md:max-w-none md:text-[3.5rem] md:leading-[1.1] md:tracking-[-0.02em]">
                {home.currentEngagement.title}
              </h1>
            </Link>
            <div className="flex items-center gap-4 text-sm uppercase tracking-[0.08em] text-muted sm:flex-col sm:items-start sm:gap-2 sm:text-base sm:normal-case sm:tracking-normal md:block">
              <p className="text-lg italic normal-case tracking-normal text-plum sm:text-2xl">
                {formatAuthors(home.currentEngagement.authors)}
              </p>
              <span className="h-px w-12 bg-line sm:hidden" />
              <p className="font-semibold text-copy sm:text-xs sm:uppercase sm:tracking-[0.18em] md:hidden">
                {home.currentEngagement.completionPercent}% Completed
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-md bg-soft-fill px-5 py-6 sm:grid sm:gap-5 sm:rounded-[22px] sm:p-6 sm:grid-cols-[auto_1px_1fr] sm:items-center md:hidden">
            <div className="absolute inset-y-0 left-0 w-0.5 bg-[#eae1db]">
              <div
                className="w-full bg-ink"
                style={{
                  height: `${Math.min(Math.max(home.currentEngagement.completionPercent, 18), 100)}%`,
                }}
              />
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-olive">
                Next milestone
              </p>
              <p className="mt-3 font-display text-[1.35rem] leading-[1.35] text-title sm:text-2xl">
                {home.currentEngagement.chapterLabel}
              </p>
              <Link
                href={readerHref}
                className="mt-4 inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink"
              >
                Resume Reading
                <ArrowRightIcon className="size-3.5" />
              </Link>
            </div>
            <div className="hidden h-14 w-px bg-line sm:block" />
            <div className="hidden sm:block">
              <p className="text-4xl text-ink">
                {home.currentEngagement.completionPercent}%
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive">
                Completed
              </p>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="flex items-center gap-12 py-4">
              <div className="space-y-0.5">
                <p className="text-[2.25rem] leading-none text-ink">
                  {home.currentEngagement.completionPercent}%
                </p>
                <p className="text-[0.85rem] uppercase tracking-[0.08em] text-olive">
                  Completed
                </p>
              </div>

              <div className="h-12 w-px bg-black/10" />

              <div className="space-y-1">
                <p className="font-display text-2xl leading-[1.05] text-title">
                  {home.currentEngagement.chapterLabel}
                </p>
                <p className="text-[0.75rem] uppercase tracking-widest text-olive">
                  Next Milestone
                </p>
              </div>
            </div>
          </div>

          <div className="sm:hidden">
            <LibraryImportButton
              variant="soft"
              label="Import another book"
              className="w-full justify-center"
            />
          </div>

          <div className="hidden sm:flex sm:flex-row sm:items-center sm:gap-3 md:hidden">
            <LibraryImportButton variant="soft" label="Import another book" />
          </div>

          <HomeResumeActions readerHref={readerHref} />
        </div>
      </section>

      {home.listening ? (
        <section className="space-y-8">
          <SectionHeader
            label="Now Listening"
            action={<SparkIconLink href="" />}
          />
          <div className="rounded-lg bg-soft-fill px-6 py-6 sm:rounded-3xl sm:px-8">
            <div className="grid gap-6 md:grid-cols-[192px_1fr] md:items-center">
              <BookCover
                alt={`${home.listening.title} listening placeholder`}
                className="aspect-square w-32 rounded-xs shadow-(--shadow-card) sm:w-40"
                src={home.currentEngagement.coverImageDataUrl}
                title={home.listening.title}
              />
              <div className="space-y-4">
                <div>
                  <h2 className="max-w-52 font-display text-[2rem] leading-[1.1] text-ink sm:max-w-none sm:text-4xl">
                    {home.listening.title}
                  </h2>
                  <p className="mt-1 text-sm italic tracking-[0.02em] text-plum sm:text-xl">
                    {home.listening.authorLine}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-copy">
                    <span>15:20</span>
                    <span>42:10</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line/20 sm:h-2">
                    <div
                      className="h-full rounded-full bg-ink"
                      style={{ width: `${Math.max(home.listening.progressPercent, 8)}%` }}
                    />
                  </div>
                </div>
                <ListeningControls />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <MasteryPanel mastery={home.mastery} />
        <StatsPanel stats={home.stats} />
      </section>
    </>
  );
}

function getReaderHref(libraryItemId: string) {
  return `/app/read/${libraryItemId}`;
}

function MasteryPanel({ mastery }: { mastery: HomePayload["mastery"] }) {
  const goalMinutes = Math.max(mastery.dailyGoalMinutes, 1);
  const maxMinutes = Math.max(...mastery.days.map((day) => day.minutes), goalMinutes);
  const goalBarHeightPercent = 72;
  const todayKey = mastery.days.at(-1)?.key;
  const getBarHeightPercent = (minutes: number) => {
    const safeMinutes = Math.max(minutes, 0);

    if (safeMinutes <= goalMinutes) {
      return (safeMinutes / goalMinutes) * goalBarHeightPercent;
    }

    if (maxMinutes <= goalMinutes) {
      return goalBarHeightPercent;
    }

    const overflowRatio = (safeMinutes - goalMinutes) / (maxMinutes - goalMinutes);
    return goalBarHeightPercent + overflowRatio * (100 - goalBarHeightPercent);
  };

  return (
    <>
      <section className="space-y-6 sm:hidden">
        <SectionHeader
          label="Daily Mastery"
          action={
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink">
              {mastery.todayMinutes} / {mastery.dailyGoalMinutes} MIN
            </span>
          }
        />
        <div className="space-y-5">
          <div className="flex h-28 items-end gap-1">
            {mastery.days.map((day) => (
              <div
                key={day.key}
                className="grid h-full min-w-0 flex-1 grid-rows-[1fr_auto] items-end gap-1"
              >
                <div className="relative flex h-full w-full items-end rounded-sm bg-transparent">
                  <div
                    className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line/45"
                    style={{ bottom: `${goalBarHeightPercent}%` }}
                  />
                  <div
                    className={cn(
                      "relative z-10 w-full rounded-t-xs transition",
                      day.key === todayKey
                        ? "bg-brand-fill"
                        : day.goalMet
                          ? "bg-ink"
                          : "bg-sand",
                    )}
                    style={{
                      height: `${getBarHeightPercent(day.minutes)}%`,
                    }}
                  />
                </div>
                <div className="space-y-0.5 text-center">
                  <p className="text-[0.58rem] uppercase tracking-[0.12em] text-muted">
                    {day.dayLabel}
                  </p>
                  <p className="text-[0.7rem] text-copy">{day.minutes}m</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center font-display text-xl italic text-title">
            {mastery.remainingMinutes > 0
              ? `${mastery.remainingMinutes} minutes to reach your daily goal`
              : "Daily goal met. Keep the momentum going."}
          </p>
        </div>
      </section>

      <Panel className="hidden p-8 sm:block">
        <div className="flex h-full min-h-80 flex-col">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h2 className="text-[1.9rem] uppercase tracking-[0.04em] text-copy">
                Daily Mastery
              </h2>
              <p className="text-xl italic text-title">
                {mastery.remainingMinutes > 0
                  ? `${mastery.remainingMinutes} minutes to reach your daily goal`
                  : "Daily goal met. Keep the momentum going."}
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl text-ink">
                {mastery.todayMinutes}/{mastery.dailyGoalMinutes}
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                Min today
              </p>
            </div>
          </div>

          <div className="mt-8 min-h-0 flex-1">
            <div className="flex h-full items-end gap-2">
              {mastery.days.map((day) => (
                <div
                  key={day.key}
                  className="grid h-full min-w-0 flex-1 grid-rows-[1fr_auto] items-end gap-3"
                >
                  <div className="relative flex h-full w-full items-end rounded-sm bg-transparent">
                    <div
                      className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line/45"
                      style={{ bottom: `${goalBarHeightPercent}%` }}
                    />
                    <div
                      className={cn(
                        "relative z-10 w-full rounded-t-sm transition",
                        day.key === todayKey
                          ? "bg-brand-fill"
                          : day.goalMet
                            ? "bg-ink"
                            : "bg-sand",
                      )}
                      style={{
                        height: `${getBarHeightPercent(day.minutes)}%`,
                      }}
                    />
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted">
                      {day.dayLabel}
                    </p>
                    <p className="text-sm text-copy">{day.minutes}m</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}

function StatsPanel({ stats }: { stats: HomePayload["stats"] }) {
  const items = [
    { label: "Books Read", value: stats.volumesRead, icon: StackBooksIcon },
    { label: "Highlights", value: stats.highlights, icon: HighlighterIcon },
    { label: "Hours Reading", value: stats.hoursReading, icon: ReadingTimeIcon },
    { label: "AI Comments", value: stats.aiComments, icon: SparkIcon },
  ];

  return (
    <>
      <section className="space-y-4 sm:hidden">
        <div className="space-y-4 border-y border-line/30 py-10">
          <SectionEyebrow>Library Metrics</SectionEyebrow>
          <div className="grid grid-cols-4 gap-2">
            {items.map((item) => (
              <div key={item.label} className="min-w-0 space-y-1 text-center">
                <p className="text-[1.35rem] leading-none text-ink">{item.value}</p>
                <p className="text-[0.5rem] leading-tight font-semibold uppercase tracking-widest text-olive">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="hidden gap-4 sm:grid">
        {items.map((item) => (
          <Panel key={item.label} className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-4xl text-ink">{item.value}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-olive">
                  {item.label}
                </p>
              </div>
              <item.icon className="h-5 w-auto shrink-0 text-title" />
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

function QuoteSection() {
  return (
    <section className="flex flex-col items-center gap-5 px-2 text-center sm:gap-6">
      <QuoteMarkIcon className="h-4 w-auto text-plum sm:h-4.5" />
      <blockquote className="max-w-[18rem] font-display text-[1.8rem] leading-[1.35] text-title sm:max-w-3xl sm:text-[2.5rem]">
        &quot;Reading is a conversation. All books talk. But a good book listens as
        well.&quot;
      </blockquote>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-plum">
        Mark Haddon
      </p>
    </section>
  );
}

function FeaturedBooksSection({
  entries,
}: {
  entries: HomePayload["featuredCatalog"]["entries"];
}) {
  return (
    <section className="space-y-6">
      <SectionHeader
        label="Explore"
        action={
          <Link
            href="/app/explore"
            className="text-[0.8rem] font-bold uppercase tracking-[0.12em] text-ink underline decoration-line-strong underline-offset-6 sm:text-sm"
          >
            Open all
          </Link>
        }
      />

      {entries.length === 0 ? (
        <Panel className="p-6 sm:p-8">
          <p className="max-w-xl text-lg leading-8 text-copy">
            Public domain books catalog is in progress.
          </p>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:hidden">
            {entries.slice(0, 2).map((entry) => (
              <div key={entry.id} className="space-y-3">
                <BookCover
                  alt={`${entry.title} cover`}
                  className="aspect-[0.72] w-full rounded-xs"
                  src={entry.coverImageDataUrl}
                  title={entry.title}
                />
                <div className="space-y-1">
                  <h3 className="font-display text-lg leading-none text-title">
                    {entry.title}
                  </h3>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-plum">
                    {formatAuthors(entry.authors)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden gap-5 md:grid md:grid-cols-2">
            {entries.map((entry) => (
              <Panel
                key={entry.id}
                className="grid gap-5 p-5 sm:grid-cols-[120px_1fr] sm:items-start sm:p-6"
              >
                <BookCover
                  alt={`${entry.title} cover`}
                  className="aspect-[0.76] w-28"
                  src={entry.coverImageDataUrl}
                  title={entry.title}
                />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-display text-3xl leading-none text-title">
                      {entry.title}
                    </h3>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-plum">
                      {formatAuthors(entry.authors)}
                    </p>
                  </div>
                  <p className="text-base leading-7 text-copy">
                    {entry.description ??
                      "A curated public-domain title ready to add to your library."}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-line/60 bg-white/55 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-olive">
                      {entry.primaryFormat}
                    </span>
                    <CatalogAddButton entryId={entry.id} />
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CollectionsPanel({
  collections,
}: {
  collections: HomePayload["collections"]["items"];
}) {
  return (
    <section className="space-y-6">
      <SectionHeader
        label="Collections"
        action={
          <Link
            href={APP_LIBRARY_HREF}
            className="text-[0.8rem] font-bold uppercase tracking-[0.12em] text-ink underline decoration-line-strong underline-offset-6 sm:text-sm"
          >
            Open all
          </Link>
        }
      />

      <div className="space-y-2">
        {collections.length === 0 ? (
          <Panel className="p-6">
            <p className="text-base leading-7 text-copy">
              Collections will appear after you import books or add them from
              the public catalog.
            </p>
          </Panel>
        ) : (
          collections.map((collection) => (
            <Link
              key={collection.id}
              href={APP_LIBRARY_HREF}
              className="flex items-center justify-between border-b border-line/40 py-4 transition hover:text-ink sm:py-5"
            >
              <div className="space-y-1">
                <p className="font-display text-[1.28rem] text-title sm:text-[1.7rem]">
                  {collection.name}
                </p>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-olive sm:text-xs">
                  {collection.itemCount} items • {collection.unreadCount} unread
                </p>
              </div>
              <ArrowRightIcon className="size-4 text-muted sm:size-5" />
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function RecentAnnotationsPanel({
  annotations,
}: {
  annotations: HomePayload["recentAnnotations"]["items"];
}) {
  const annotation = annotations[0];

  return (
    <section className="space-y-6">
      <SectionHeader label="Recent Annotations" />

      <Panel className="rounded-sm p-5 sm:rounded-3xl sm:p-8">
        {annotation ? (
          <div className="space-y-6">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink sm:text-xs">
              From: {annotation.bookTitle}
            </p>
            <blockquote className="text-base leading-7 text-title sm:text-[1.35rem] sm:leading-9">
              “{annotation.excerpt}”
            </blockquote>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                Highlighter: {annotation.colorLabel}
              </p>
              <Link
                href="/app/insights"
                className="text-xs font-bold uppercase tracking-[0.16em] text-ink"
              >
                View full notebook
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-base leading-7 text-copy">
            Annotations will begin appearing here once you create highlights.
          </p>
        )}
      </Panel>
    </section>
  );
}

function FeedbackSection() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 sm:gap-10">
      <div className="space-y-3 text-center">
        <p className="text-[0.8rem] font-bold uppercase tracking-[0.2em] text-muted sm:text-xs sm:tracking-[0.24em]">
          Continuous Evolution
        </p>
        <h2 className="font-display text-[2rem] leading-[1.15] tracking-[-0.03em] text-ink sm:text-5xl">
          Tell what you&apos;d like us to improve or fix
        </h2>
      </div>
      <FeedbackForm />
    </section>
  );
}

function DashboardFooter() {
  return (
    <footer className="border-t border-line/40 pt-8 text-[0.62rem] uppercase tracking-[0.22em] text-muted sm:text-xs">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p>© AVA Reader • Designed for immersive reading • 2026</p>
        <div className="flex gap-6">
          <Link href="/">Privacy</Link>
          <Link href="/">Terms</Link>
          <Link href="/">Contact</Link>
        </div>
      </div>
    </footer>
  );
}

function ActionCard({
  action,
  description,
  title,
}: {
  action: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-[22px] p-6",
        "bg-soft-fill",
      )}
    >
      <div className="flex h-full flex-col gap-5">
        <div className="space-y-3">
          <h2 className="font-display text-4xl leading-tight text-ink">{title}</h2>
          <p className="text-lg leading-8 text-title">{description}</p>
        </div>
        <div className="mt-auto">{action}</div>
      </div>
    </div>
  );
}

function LinkAction({
  emphasis = false,
  href,
  label,
}: {
  emphasis?: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-5 text-sm font-semibold uppercase tracking-[0.14em] transition",
        emphasis
          ? "border border-brand-fill bg-brand-fill text-brand-foreground shadow-(--shadow-card) hover:bg-brand-fill-strong"
          : "bg-white/40 text-ink hover:bg-white/50",
      )}
    >
      {label}
    </Link>
  );
}

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-soft-fill",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.8rem] font-bold uppercase tracking-[0.2em] text-muted sm:text-xs sm:tracking-[0.24em]">
      {children}
    </p>
  );
}

function SectionHeader({
  action,
  label,
}: {
  action?: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-line/10 pb-4 sm:border-0 sm:pb-0">
      <SectionEyebrow>{label}</SectionEyebrow>
      {action ?? null}
    </div>
  );
}

function SparkIconLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="text-[#264B5F] transition hover:opacity-80"
      aria-label="Open insights"
    >
      <NowListeningHeaderIcon className="h-[11.667px] w-auto" />
    </Link>
  );
}
