import type { ReactNode } from "react";
import { AppShell } from "@/components/app/core/app-shell";
import { MissingAuthConfiguration } from "@/components/auth/missing-auth-configuration";
import { CurrentUserHydrator } from "@/features/offline/buckets/me";
import type { CurrentUserPayload } from "@/lib/api-types";
import { fetchServerApiTolerant } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.CLERK_SECRET_KEY
  ) {
    return <MissingAuthConfiguration />;
  }

  // Tolerate an unreachable API (offline). A null return means we render
  // with `currentUser = null`; AppShell recovers the last-known user from
  // Dexie via the cache. Real HTTP errors (auth redirect, 5xx) still bubble.
  const currentUser = await fetchServerApiTolerant<CurrentUserPayload>(
    "/api/me",
    { returnBackUrl: "/app" },
  );

  return (
    <>
      <CurrentUserHydrator initial={currentUser} />
      <AppShell currentUser={currentUser}>{children}</AppShell>
    </>
  );
}
