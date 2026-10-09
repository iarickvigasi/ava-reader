"use client";

import { useTranslations } from "next-intl";
import { ExploreIcon } from "@/components/app/core/explore-icon";
import { useReaderDiscovery } from "@/features/offline/buckets/readers/use-reader-discovery";
import { ConnectReaderMasonry } from "./connect-reader-masonry";

export function ConnectReaderDiscovery() {
  const t = useTranslations("connect.discovery");
  const readers = useReaderDiscovery();
  return (
    <section aria-labelledby="reader-discovery-title" className="space-y-6">
      <h2
        id="reader-discovery-title"
        className="font-display text-3xl text-ink sm:text-4xl"
      >
        {t("title")}
      </h2>
      {readers === null ? (
        <div className="h-48 animate-pulse rounded-card bg-paper" />
      ) : readers.length ? (
        <ConnectReaderMasonry readers={readers} />
      ) : (
        <div className="flex flex-col items-center rounded-card bg-paper px-6 py-10 text-center sm:px-10 sm:py-14">
          <span className="flex size-14 items-center justify-center rounded-full bg-soft-fill text-ink">
            <ExploreIcon className="size-7" />
          </span>
          <h3 className="mt-6 font-display text-2xl text-title sm:text-3xl">
            {t("emptyTitle")}
          </h3>
          <p className="mt-3 max-w-xl text-lg leading-7 text-copy">
            {t("emptyBody")}
          </p>
        </div>
      )}
    </section>
  );
}
