import type { ReactElement, SVGProps } from "react";

export type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

type ActionCardProps = {
  danger?: boolean;
  description: string;
  icon: IconComponent;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function ActionCard({
  danger = false,
  description,
  icon: Icon,
  title,
  onClick,
  disabled = false,
}: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-control bg-paper-strong/80 px-4 py-3 text-left transition hover:bg-paper-strong disabled:cursor-default disabled:hover:bg-paper-strong/80"
    >
      <span className="flex items-start gap-3">
        <span
          className={danger ? "pt-1 text-danger" : "pt-1 text-brand-fill"}
          aria-hidden
        >
          <Icon className="size-4.5" />
        </span>
        <span className="min-w-0">
          <span
            className={
              danger
                ? "block font-reader text-[1.55rem] leading-[1.1] text-danger"
                : "block font-reader text-[1.55rem] leading-[1.1] text-title"
            }
          >
            {title}
          </span>
          <span className="mt-1 block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">
            {description}
          </span>
        </span>
      </span>
    </button>
  );
}
