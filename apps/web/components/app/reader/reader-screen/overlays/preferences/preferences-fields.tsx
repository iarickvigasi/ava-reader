import type { ReactNode } from "react";
import { ChevronDownIcon } from "./preferences-icons";

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-(--font-ui) text-[0.78rem] uppercase tracking-[0.14em] text-title/85">
      {children}
    </span>
  );
}

export function FieldRow({
  children,
  label,
}: {
  children: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 items-center">
        <FieldLabel>{label}</FieldLabel>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function StackedField({
  children,
  label,
}: {
  children: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

export function SelectField({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="flex h-9.5 w-full items-center justify-between gap-2 rounded-lg bg-soft-tone-fill px-3 font-(--font-reader) text-base text-copy-strong transition hover:bg-soft-tone-fill/80"
    >
      <span className="truncate">{value}</span>
      <ChevronDownIcon className="size-4 shrink-0 text-ink/60" />
    </button>
  );
}

export function NumberField({ value }: { value: string }) {
  return (
    <div className="flex h-9.5 w-full items-center rounded-lg bg-soft-tone-fill px-3 font-(--font-reader) text-base text-copy-strong hover:bg-soft-tone-fill/80">
      <span className="truncate">{value}</span>
    </div>
  );
}

export function IconControlButton({
  ariaLabel,
  ariaPressed,
  children,
  onClick,
}: {
  ariaLabel: string;
  ariaPressed?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onClick={onClick}
      className="inline-flex h-9 items-center justify-center rounded-md bg-soft-tone-fill px-3 text-title/80 transition hover:bg-soft-tone-fill/80 hover:text-title"
    >
      {children}
    </button>
  );
}
