import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ChevronDownIcon } from "./preferences-icons";

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-ui text-[0.78rem] uppercase tracking-[0.14em] text-title/85">
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

export type SelectFieldOption = {
  value: string;
  label: string;
};

export function SelectField({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel?: string;
  onChange?: (next: string) => void;
  options?: SelectFieldOption[];
  value: string;
}) {
  if (options && onChange) {
    const hasValue = options.some((opt) => opt.value === value);
    return (
      <div className="relative h-9.5 w-full">
        <select
          aria-label={ariaLabel}
          value={hasValue ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer appearance-none rounded-lg bg-soft-tone-fill px-3 pr-9 font-reader text-base text-copy-strong transition hover:bg-soft-tone-fill/80"
        >
          {!hasValue && (
            <option value="" disabled>
              {value || "Select…"}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink/60" />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="flex h-9.5 w-full items-center justify-between gap-2 rounded-lg bg-soft-tone-fill px-3 font-reader text-base text-copy-strong transition hover:bg-soft-tone-fill/80"
    >
      <span className="truncate">{value}</span>
      <ChevronDownIcon className="size-4 shrink-0 text-ink/60" />
    </button>
  );
}

export function NumberField(props: Omit<ComponentPropsWithoutRef<"input">, "type">) {
  return (
    <input
      {...props}
      type="number"
      inputMode="numeric"
      className="h-9.5 w-full min-w-0 rounded-lg bg-soft-tone-fill px-3 font-reader text-base text-copy-strong transition hover:bg-soft-tone-fill/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-fill aria-invalid:outline-2 aria-invalid:outline-danger"
    />
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
