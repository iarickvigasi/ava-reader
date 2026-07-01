import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "soft" | "ghost" | "danger";
type ButtonSize = "md" | "sm";

// Shape + motion shared by every button. No border — definition comes from the
// variant's fill (see docs/styles.md). Keep each CSS property in one layer only;
// cn() is a plain join, not tailwind-merge, so duplicates would both emit.
const base =
  "relative inline-flex items-center justify-center rounded-control transition duration-200 disabled:cursor-not-allowed disabled:opacity-55";

const sizes: Record<ButtonSize, string> = {
  md: "min-h-13 px-6 text-lg font-medium",
  sm: "min-h-10 px-4 text-xs font-semibold uppercase tracking-[0.16em]",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-fill text-brand-foreground shadow-(--shadow-card) hover:bg-brand-fill-strong",
  soft: "bg-soft-fill text-soft-foreground hover:bg-soft-tone-fill",
  ghost: "bg-transparent text-ink hover:bg-soft-fill",
  danger: "bg-danger text-white hover:opacity-90",
};

type SharedProps = {
  children: ReactNode;
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className,
  size = "md",
  variant = "primary",
  ...props
}: SharedProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  className,
  size = "md",
  variant = "primary",
  ...props
}: SharedProps & ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    >
      {children}
    </Link>
  );
}
