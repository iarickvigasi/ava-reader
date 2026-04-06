import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "soft" | "ghost";

const styles: Record<ButtonVariant, string> = {
  primary:
    "border border-brand-fill bg-brand-fill !text-white shadow-[var(--shadow-card)] hover:bg-brand-fill-strong",
  soft:
    "border border-transparent bg-soft-fill text-soft-foreground  hover:bg-white",
  ghost:
    "border border-line bg-transparent text-ink hover:bg-white/55",
};

type SharedProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: SharedProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      className={cn(
        "relative inline-flex min-h-13 items-center justify-center rounded-[14px] px-6 text-lg font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-55",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  className,
  variant = "primary",
  ...props
}: SharedProps & ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      className={cn(
        "relative inline-flex min-h-13 items-center justify-center rounded-[14px] px-6 text-lg font-medium transition duration-200",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
