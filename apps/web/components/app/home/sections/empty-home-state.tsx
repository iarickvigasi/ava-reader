import { ImportButton } from "@/components/app/library/import-button";
import type { HomePayload } from "@/lib/api-types";
import { ActionCard, LinkAction, SectionEyebrow } from "../shared/home-shared";

type EmptyHomeStateProps = {
  home: HomePayload;
};

export function EmptyHomeState({ home }: EmptyHomeStateProps) {
  const hasFeaturedCatalog = home.featuredCatalog.entries.length > 0;

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
            <ImportButton
              variant="primary"
              label="Upload book"
              className="w-full"
            />
          }
        />
        <ActionCard
          title="Explore Public Domain Books"
          description={
            hasFeaturedCatalog
              ? "Start with a curated public-domain title and add it to your shelf in one tap."
              : "Public domain books catalog is in progress."
          }
          action={
            <LinkAction
              href="/app/explore"
              label="Browse Catalog"
              className="w-full"
            />
          }
        />
      </div>
    </section>
  );
}
