import type { ReactNode } from "react";

export function PageSkeletonShell({ children }: { children: ReactNode }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading page"
      className="mx-auto min-h-dvh w-full max-w-6xl space-y-10 px-6 py-10 lg:px-10"
    >
      <div
        aria-hidden="true"
        className="space-y-10 animate-pulse motion-reduce:animate-none"
      >
        <div className="h-10 w-2/3 max-w-96 rounded-control bg-paper-strong" />
        {children}
      </div>
    </div>
  );
}
