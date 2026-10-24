import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function BookTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "wrap-anywhere font-display text-[3.2rem] leading-[0.96] tracking-[-0.03em] text-title md:text-[4.6rem]",
        className,
      )}
    >
      {children}
    </h1>
  );
}
