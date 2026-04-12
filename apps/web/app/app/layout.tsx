import type { ReactNode } from "react";
import { AppShell } from "@/components/app/core/app-shell";
import { MissingAuthConfiguration } from "@/components/auth/missing-auth-configuration";
import type { CurrentUserPayload } from "@/lib/api-types";
import { fetchServerApi } from "@/lib/server-api";

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

  const currentUser = await fetchServerApi<CurrentUserPayload>("/api/me", {
    returnBackUrl: "/app",
  });

  return <AppShell currentUser={currentUser}>{children}</AppShell>;
}
