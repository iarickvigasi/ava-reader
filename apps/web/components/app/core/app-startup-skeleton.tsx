"use client";

import { usePathname } from "next/navigation";
import { AppNavigation } from "./app-navigation";
import { AppPageSkeleton } from "./app-page-skeleton";

// Public chrome is safe before account selection; user controls and sync stay gated.
export function AppStartupSkeleton() {
  const pathname = usePathname();
  if (pathname.startsWith("/app/read/")) return <AppPageSkeleton />;
  return (
    <div className="min-h-screen">
      <AppNavigation currentUser={null} startup />
      <div className="pb-24 md:pb-10">
        <AppPageSkeleton />
      </div>
    </div>
  );
}
