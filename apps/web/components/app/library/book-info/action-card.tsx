import type { ReactElement, SVGProps } from "react";
import { cn } from "@/lib/cn";

export type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

type ActionCardProps = {
  description: string;
  icon: IconComponent;
  title: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
} & (
  | { danger: true; variant?: never }
  | { danger?: false; variant?: "default" | "admin" }
);

const variants = {
  default: {
    background:
      "bg-paper-strong/80 hover:bg-paper-strong disabled:hover:bg-paper-strong/80",
    icon: "text-brand-fill",
    title: "text-title",
  },
  danger: {
    background:
      "bg-paper-strong/80 hover:bg-paper-strong disabled:hover:bg-paper-strong/80",
    icon: "text-danger",
    title: "text-danger",
  },
  admin: {
    background: "bg-plum/10 hover:bg-plum/15 disabled:hover:bg-plum/10",
    icon: "text-plum",
    title: "text-plum",
  },
};

export function ActionCard({
  danger = false,
  variant = "default",
  description,
  icon: Icon,
  title,
  onClick,
  disabled = false,
}: ActionCardProps) {
  const appearance = variants[danger ? "danger" : variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-control px-4 py-3 text-left transition disabled:cursor-default",
        appearance.background,
      )}
    >
      <span className="flex items-center gap-3">
        <span className={cn("flex", appearance.icon)} aria-hidden>
          <Icon className="size-4.5" />
        </span>
        <span className="min-w-0">
          <span
            className={cn(
              "block font-reader text-[1.55rem] leading-[1.1]",
              appearance.title,
            )}
          >
            {title}
          </span>
          <span className="mt-1 block font-ui text-[0.62rem] font-normal uppercase tracking-[0.16em] text-muted">
            {description}
          </span>
        </span>
      </span>
    </button>
  );
}
