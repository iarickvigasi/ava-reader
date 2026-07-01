"use client";

// Shown when a route can't render because its data lives only on the server
// and we're offline (e.g. the admin catalog, or the home screen on a device
// that has never loaded it online). Explains the situation, points the user
// at what *does* work offline (their library + saved books), and offers a
// retry that re-runs the route once a connection is back.

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button, ButtonLink } from "@/components/ui/button";
import { useNetworkState } from "@/features/offline/net/use-network-state";

export type OfflineRouteKey = "admin" | "insights" | "home" | "generic";

type OfflineRouteFallbackProps = {
  routeKey: OfflineRouteKey;
};

export function OfflineRouteFallback({ routeKey }: OfflineRouteFallbackProps) {
  const t = useTranslations("offline.routeFallback");
  const online = useNetworkState();
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-full rounded-modal bg-paper p-8 shadow-(--shadow-card)">
        <span
          className="inline-flex items-center gap-2 rounded-full bg-soft-fill px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-copy-strong"
        >
          <span
            aria-hidden
            className={
              online
                ? "inline-block size-2 shrink-0 rounded-full bg-brand-fill"
                : "inline-block size-2 shrink-0 rounded-full bg-muted"
            }
          />
          {online ? t("statusOnline") : t("statusOffline")}
        </span>

        <h1 className="mt-5 font-reader text-[1.75rem] leading-[1.15] text-title">
          {t(`${routeKey}.title`)}
        </h1>
        <p className="mt-4 text-base leading-7 text-copy">
          {t(`${routeKey}.body`)}
        </p>

        <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href="/app/library" size="sm">
            {t("openLibrary")}
          </ButtonLink>
          <Button
            type="button"
            size="sm"
            variant="soft"
            // When online again, router.refresh() re-runs the server
            // component so the real data renders in place.
            onClick={() => router.refresh()}
            disabled={!online}
          >
            {t("retry")}
          </Button>
        </div>
      </div>
    </div>
  );
}
