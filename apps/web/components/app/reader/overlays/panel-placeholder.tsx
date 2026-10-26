import type { ReactNode } from "react";

export function PanelPlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center pb-8">
      <p className="p-[20%] text-center font-ui text-[0.78rem] uppercase tracking-[0.16em] text-muted">
        {children}
      </p>
    </div>
  );
}
