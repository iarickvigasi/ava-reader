import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon, BookmarkIcon, QuoteMarkIcon } from "@/components/app/app-icons";
import { CatalogAddButton } from "@/components/app/catalog-add-button";
import { FeedbackForm } from "@/components/app/feedback-form";
import { LibraryImportButton } from "@/components/app/library-import-button";
import type { HomePayload } from "@/lib/api-types";
import { cn } from "@/lib/cn";

type HomeScreenProps = {
  home: HomePayload;
};

export function HomeScreen({ home }: HomeScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-8 sm:px-6 sm:py-10 lg:gap-28 lg:px-10 lg:py-12">
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
    <section className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
      <div className="space-y-6 pt-4">
        <SectionEyebrow>Welcome</SectionEyebrow>
        <h1 className="max-w-md font-display text-5xl leading-[1.05] tracking-[-0.04em] text-ink sm:text-6xl">
          Welcome to AVA Reader
        </h1>
        <p className="max-w-md text-xl leading-8 text-title">
          Let’s start your exploration. Choose a book to dive into and we’ll
          shape the rest of the reader around it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard
          title="Import Your First Book"
          description="Bring your EPUB or PDF into a private library that follows you across devices."
          tone="primary"
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
              : "Your public catalog is still empty. Add the first public-domain title from the internal admin route."
          }
          tone="soft"
          action={
            <LinkAction href="/app/explore" label="Browse Catalog" />
          }
        />
      </div>
    </section>
  );
}

function PopulatedHomeState({ home }: HomeScreenProps) {
  if (!home.currentEngagement) {
    return <EmptyHomeState home={home} />;
  }

  return (
    <>
      <section className="grid gap-10 lg:grid-cols-[0.4fr_0.6fr] lg:items-start">
        <BookCover
          alt={`${home.currentEngagement.title} cover`}
          className="mx-auto aspect-[0.72] w-full max-w-68 shadow-(--shadow-card) lg:mx-0 lg:max-w-84"
          src={home.currentEngagement.coverImageDataUrl}
          title={home.currentEngagement.title}
        />

        <div className="space-y-7 lg:pt-12">
          <div className="space-y-4">
            <SectionEyebrow>Currently Engaged</SectionEyebrow>
            <h1 className="max-w-2xl font-display text-5xl leading-[1.04] tracking-[-0.04em] text-ink sm:text-6xl">
              {home.currentEngagement.title}
            </h1>
            <p className="text-2xl italic text-plum">
              {home.currentEngagement.author ?? "Unknown author"}
            </p>
          </div>

          <div className="grid gap-5 rounded-[22px] border border-line/50 bg-white/45 p-6 shadow-(--shadow-soft) sm:grid-cols-[auto_1px_1fr] sm:items-center">
            <div>
              <p className="text-4xl text-ink">
                {home.currentEngagement.completionPercent}%
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive">
                Completed
              </p>
            </div>
            <div className="hidden h-14 w-px bg-line sm:block" />
            <div>
              <p className="font-display text-2xl text-title">
                {home.currentEngagement.chapterLabel}
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive">
                Next milestone
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <LinkAction href="/app" label="Resume Reading" emphasis />
            <LibraryImportButton variant="soft" label="Import another book" />
          </div>
        </div>
      </section>

      {home.listening ? (
        <section className="rounded-3xl border border-line/50 bg-soft-fill px-6 py-6 shadow-(--shadow-soft) sm:px-8">
          <div className="grid gap-6 md:grid-cols-[192px_1fr] md:items-center">
            <BookCover
              alt={`${home.listening.title} listening placeholder`}
              className="aspect-square w-40"
              src={home.currentEngagement.coverImageDataUrl}
              title={home.listening.title}
            />
            <div className="space-y-4">
              <SectionEyebrow>Now Listening</SectionEyebrow>
              <div>
                <h2 className="font-display text-4xl text-ink">
                  {home.listening.title}
                </h2>
                <p className="text-xl italic text-plum">{home.listening.authorLine}</p>
              </div>
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-line/40">
                  <div
                    className="h-full rounded-full bg-ink"
                    style={{ width: `${Math.max(home.listening.progressPercent, 8)}%` }}
                  />
                </div>
                <p className="text-sm text-muted">
                  Visual placeholder only. Audio playback arrives in a later
                  phase.
                </p>
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

function MasteryPanel({ mastery }: { mastery: HomePayload["mastery"] }) {
  const maxMinutes = Math.max(
    mastery.dailyGoalMinutes,
    ...mastery.days.map((day) => day.minutes),
    1,
  );

  return (
    <Panel className="p-6 sm:p-8">
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

      <div className="mt-8">
        <div className="flex h-52 items-end gap-2">
          {mastery.days.map((day) => (
            <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-3">
              <div className="flex h-44 w-full items-end rounded-sm bg-transparent">
                <div
                  className={cn(
                    "w-full rounded-t-sm transition",
                    day.goalMet ? "bg-ink" : "bg-sand",
                  )}
                  style={{
                    height: `${Math.max((day.minutes / maxMinutes) * 100, 10)}%`,
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
    </Panel>
  );
}

function StatsPanel({ stats }: { stats: HomePayload["stats"] }) {
  const items = [
    { label: "Volumes Read", value: stats.volumesRead },
    { label: "Highlights", value: stats.highlights },
    { label: "Hours Reading", value: stats.hoursReading },
  ];

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <Panel key={item.label} className="flex items-center justify-between gap-4 p-6">
          <div>
            <p className="text-4xl text-ink">{item.value}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-olive">
              {item.label}
            </p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-full border border-line/60 bg-white/60">
            <BookmarkIcon className="size-4 text-plum" />
          </div>
        </Panel>
      ))}
    </div>
  );
}

function QuoteSection() {
  return (
    <section className="flex flex-col items-center gap-6 px-2 text-center">
      <QuoteMarkIcon className="size-6 text-plum" />
      <blockquote className="max-w-3xl font-display text-[2rem] leading-[1.35] text-title sm:text-[2.5rem]">
        &quot;Reading is a conversation. All books talk. But a good book
        listens as well.&quot;
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
    <section className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <SectionEyebrow>Explore</SectionEyebrow>
        <Link
          href="/app/explore"
          className="text-sm font-bold uppercase tracking-[0.12em] text-ink underline decoration-line-strong underline-offset-6"
        >
          Browse all
        </Link>
      </div>

      {entries.length === 0 ? (
        <Panel className="p-6 sm:p-8">
          <p className="max-w-xl text-lg leading-8 text-copy">
            Your admin catalog is still empty. Use the internal admin route to
            publish the first public-domain title, then this section will start
            surfacing featured books automatically.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
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
                    {entry.author ?? "Unknown author"}
                  </p>
                </div>
                <p className="text-base leading-7 text-copy">
                  {entry.description ?? "A curated public-domain title ready to add to your library."}
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
      <div className="flex items-end justify-between gap-4">
        <SectionEyebrow>Collections</SectionEyebrow>
        <Link
          href="/app/explore"
          className="text-sm font-bold uppercase tracking-[0.12em] text-ink underline decoration-line-strong underline-offset-6"
        >
          Browse all
        </Link>
      </div>

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
              href="/app/explore"
              className="flex items-center justify-between border-b border-line/50 py-5 transition hover:text-ink"
            >
              <div className="space-y-1">
                <p className="font-display text-[1.7rem] text-title">
                  {collection.name}
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-olive">
                  {collection.itemCount} items • {collection.unreadCount} unread
                </p>
              </div>
              <ArrowRightIcon className="size-5 text-muted" />
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
      <div className="flex items-end justify-between gap-4">
        <SectionEyebrow>Recent Annotations</SectionEyebrow>
      </div>

      <Panel className="p-6 sm:p-8">
        {annotation ? (
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink">
              From: {annotation.bookTitle}
            </p>
            <blockquote className="text-lg leading-9 text-title sm:text-[1.35rem]">
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
            Annotations will begin appearing here once the reader and
            highlighting flows land in the next phase.
          </p>
        )}
      </Panel>
    </section>
  );
}

function FeedbackSection() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <div className="space-y-3 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-olive">
          Continuous Evolution
        </p>
        <h2 className="font-display text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">
          Tell what you’d like us to improve or fix
        </h2>
      </div>
      <FeedbackForm />
    </section>
  );
}

function DashboardFooter() {
  return (
    <footer className="border-t border-line/40 pt-8 text-xs uppercase tracking-[0.22em] text-muted">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
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
  tone,
}: {
  action: ReactNode;
  description: string;
  title: string;
  tone: "primary" | "soft";
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-[22px]  p-6 shadow-(--shadow-soft)",
        tone === "primary" ? "bg-soft-fill" : "bg-soft-tone-fill",
      )}
    >
      <div className="flex h-full flex-col gap-5">
        <div className="space-y-3">
          <h2 className="font-display text-4xl leading-tight text-ink">
            {title}
          </h2>
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
          : "border border-line bg-white/40 text-ink hover:bg-white/70",
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
        "rounded-3xl border border-line/50 bg-white/40 shadow-(--shadow-soft)",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted">
      {children}
    </p>
  );
}

function BookCover({
  alt,
  className,
  src,
  title,
}: {
  alt: string;
  className?: string;
  src: string | null;
  title: string;
}) {
  if (src) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-md border border-line/40 bg-white/60",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={alt} className="size-full object-cover" src={src} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-end overflow-hidden rounded-md border border-line/40 bg-[linear-gradient(180deg,#efe1d5_0%,#d9cabc_100%)] p-4 shadow-(--shadow-soft)",
        className,
      )}
    >
      <div className="max-w-44">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-olive">
          AVA Reader
        </p>
        <p className="mt-2 font-display text-2xl leading-tight text-title">
          {title}
        </p>
      </div>
    </div>
  );
}
