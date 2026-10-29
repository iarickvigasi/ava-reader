import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function TextActionLink({
  className,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn(
        "text-[0.8rem] font-bold uppercase tracking-[0.12em] text-ink underline decoration-line-strong underline-offset-6 sm:text-sm",
        className,
      )}
    />
  );
}
