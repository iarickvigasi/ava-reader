"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ClerkNav } from "@/components/auth/clerk-nav";

type SiteFrameProps = {
  children: ReactNode;
};

export function SiteFrame({ children }: SiteFrameProps) {
  const pathname = usePathname();
  const isAppRoute = pathname.startsWith("/app");

  return (
    <div className="flex min-h-full flex-col">
      {isAppRoute ? null : <ClerkNav />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
