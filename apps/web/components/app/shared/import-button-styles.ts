// Visual layers for <ImportButton>. Size owns min-height, padding, font-size and
// weight on purpose: cn() is a plain join, not tailwind-merge (styles.md), so a
// call site passing its own min-h/px/text-* through className would emit both
// and leave CSS order to pick the winner. Choosing a size is the supported way.

export type ImportButtonSize = "lg" | "md";
export type ImportButtonVariant = "primary" | "soft" | "ghost" | "icon";

export const importButtonBase =
  "inline-flex items-center justify-center gap-2 rounded-control uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-60";

export const importButtonSizes: Record<ImportButtonSize, string> = {
  // lg mirrors <Button size="md"> geometry (min-h-13, px-6, font-medium) so an
  // import control can sit level with one — the library header pairs the two.
  lg: "min-h-13 px-6 py-3 text-[0.72rem] font-medium",
  md: "min-h-12 px-4 py-3 text-sm font-semibold",
};

export const importButtonVariants: Record<ImportButtonVariant, string> = {
  ghost: "bg-white/40 text-ink hover:bg-white/70",
  icon: "size-11 rounded-control bg-white/55 text-ink hover:bg-white",
  primary:
    "bg-brand-fill text-brand-foreground shadow-(--shadow-card) hover:bg-brand-fill-strong",
  soft: "bg-soft-fill text-soft-foreground hover:bg-soft-tone-fill",
};
