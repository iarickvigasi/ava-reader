"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PendingLabel } from "@/components/app/shared/pending-label";
import { Button, ButtonLink } from "@/components/ui/button";
import type { OfflineRouteKey } from "./offline-route-fallback";

export type UnavailableKind = "offline" | "apiUnavailable" | "authUnavailable" | "unavailable" | "notFound";

export function UnavailablePage({ kind, routeKey = "generic" }: {
  kind: UnavailableKind;
  routeKey?: OfflineRouteKey;
}) {
  const t = useTranslations("unavailablePage");
  const offline = useTranslations("offline.routeFallback");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canRetry = kind !== "notFound" && kind !== "offline";

  return (
    <section className="mx-auto flex min-h-[70vh] w-full max-w-5xl flex-col justify-center px-6 py-16 sm:px-12" aria-labelledby="unavailable-title">
      <div className="max-w-2xl">
        <div aria-hidden="true" className="mb-8 flex size-20 items-center justify-center rounded-card bg-soft-fill text-title">
          {kind === "notFound" ? <span className="font-display text-4xl">404</span> : (
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {kind === "offline" ? <><path d="M7 15a21 21 0 0 1 26 0M12 21a13 13 0 0 1 16 0M17 27a5 5 0 0 1 6 0M5 5l30 30" /><circle cx="20" cy="32" r="1" /></> : <><rect x="8" y="6" width="24" height="11" rx="3" /><path d="M13 11h1M19 11h8M8 27v-2a3 3 0 0 1 3-3h12M13 28h1M29 23v7M29 35h.01" /></>}
            </svg>
          )}
        </div>
        <p className="font-ui text-xs uppercase tracking-[0.16em] text-muted">{t(`${kind}.label`)}</p>
        <h1 id="unavailable-title" className="mt-4 font-display text-5xl leading-tight tracking-[-0.03em] text-title sm:text-6xl">{t(`${kind}.title`)}</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-copy">{kind === "offline" ? offline(`${routeKey}.body`) : t(`${kind}.body`)}</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          {canRetry && <Button disabled={pending} onClick={() => startTransition(() => router.refresh())}><PendingLabel pending={pending} pendingText={t("retrying")}>{t("retry")}</PendingLabel></Button>}
          <ButtonLink href={kind === "notFound" ? "/app" : "/app/library"} variant={canRetry ? "soft" : "primary"}>{t(kind === "notFound" ? "home" : "library")}</ButtonLink>
        </div>
        <p className="mt-10 max-w-xl border-t border-line pt-5 text-sm leading-6 text-muted">{t(`${kind}.hint`)}</p>
      </div>
    </section>
  );
}
