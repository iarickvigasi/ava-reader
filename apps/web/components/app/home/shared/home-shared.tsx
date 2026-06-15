import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { NowListeningHeaderIcon } from "@/components/app/shared/app-icons";
import { cn } from "@/lib/cn";

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl bg-soft-fill", className)}>{children}</div>
  );
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.8rem] font-bold uppercase tracking-[0.2em] text-muted sm:text-xs sm:tracking-[0.24em]">
      {children}
    </p>
  );
}

export function SectionHeader({
  action,
  label,
}: {
  action?: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-line/10 pb-4 sm:border-0 sm:pb-0">
      <SectionEyebrow>{label}</SectionEyebrow>
      {action ?? null}
    </div>
  );
}

export function ActionCard({
  action,
  description,
  title,
}: {
  action: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-card bg-soft-fill p-6">
      <div className="flex h-full flex-col gap-5">
        <div className="space-y-3">
          <h2 className="font-display text-4xl leading-tight text-ink">{title}</h2>
          <p className="text-lg leading-8 text-title">{description}</p>
        </div>
        <div className="mt-auto">{action}</div>
      </div>
    </div>
  );
}

export function LinkAction({
  className,
  emphasis = false,
  href,
  label,
}: {
  className?: string;
  emphasis?: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-sm font-semibold uppercase tracking-[0.14em] transition",
        emphasis
          ? "bg-brand-fill text-brand-foreground shadow-(--shadow-card) hover:bg-brand-fill-strong"
          : "bg-white/40 text-ink hover:bg-white/50",
        className,
      )}
    >
      {label}
    </Link>
  );
}

export function SparkIconLink({ href }: { href: string }) {
  const t = useTranslations("home.shared");
  return (
    <Link
      href={href}
      className="text-ink transition hover:opacity-80"
      aria-label={t("openInsights")}
    >
      <NowListeningHeaderIcon className="h-[11.667px] w-auto" />
    </Link>
  );
}
