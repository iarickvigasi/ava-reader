"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppNavigation } from "@/components/app/app-navigation";
import type { CurrentUserPayload } from "@/lib/api-types";
import { cn } from "@/lib/cn";

type AppShellProps = {
  children: ReactNode;
  currentUser: CurrentUserPayload;
};

export function AppShell({ children, currentUser }: AppShellProps) {
  const pathname = usePathname();
  const isReaderRoute = pathname.startsWith("/app/read/");

  return (
    <div className="min-h-screen">
      <AppNavigation currentUser={currentUser} />
      <div className={cn(!isReaderRoute && "pb-24 md:pb-10")}>{children}</div>
    </div>
  );
}
