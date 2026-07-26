import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-ui text-[0.68rem] uppercase tracking-[0.18em] text-ink/45">
      {children}
    </p>
  );
}
