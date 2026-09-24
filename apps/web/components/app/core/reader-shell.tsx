import type { ReactNode } from "react";

export function ReaderShell({
  navigation,
  children,
}: {
  navigation: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {navigation}
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  );
}
