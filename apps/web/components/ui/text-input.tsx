import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type TextInputProps = {
  label: string;
  inputClassName?: string;
  onChange: (value: string) => void;
  value: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">;

export function TextInput({
  label,
  inputClassName,
  onChange,
  value,
  ...props
}: TextInputProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm uppercase tracking-[0.22em] text-muted">
        {label}
      </span>
      <input
        className={cn(
          "w-full rounded-[14px] border border-line bg-paper px-4 py-3 text-lg text-copy-strong outline-none transition focus:border-line-strong focus:bg-white",
          inputClassName,
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}
