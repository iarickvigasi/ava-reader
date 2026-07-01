import type { ReactNode } from "react";

export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-ui text-[1rem] uppercase tracking-[0.18em] text-title/85">
      {children}
    </h2>
  );
}
