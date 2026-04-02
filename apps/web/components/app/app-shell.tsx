import type { ReactNode } from "react";
import { AppNavigation } from "@/components/app/app-navigation";
import type { CurrentUserPayload } from "@/lib/api-types";

type AppShellProps = {
  children: ReactNode;
  currentUser: CurrentUserPayload;
};

export function AppShell({ children, currentUser }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <AppNavigation currentUser={currentUser} />
      <div className="pb-24 md:pb-10">{children}</div>
    </div>
  );
}
