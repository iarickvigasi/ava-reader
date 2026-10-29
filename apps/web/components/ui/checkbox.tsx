import type { InputHTMLAttributes } from "react";
import { CheckBoldIcon } from "@/components/app/library/book-info/check-bold-icon";
export function Checkbox(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">,
) {
  return (
    <span className="relative inline-flex size-7 shrink-0 align-middle">
      <input
        {...props}
        type="checkbox"
        className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className="flex size-full items-center justify-center rounded-lg border border-line-strong bg-paper text-transparent transition peer-checked:border-brand-fill peer-checked:bg-brand-fill peer-checked:text-brand-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-line-strong peer-focus-visible:ring-offset-2 peer-disabled:opacity-55"
      >
        <CheckBoldIcon className="size-4" />
      </span>
    </span>
  );
}
