// Shared by ordinary and bilingual paragraph flow. Keep typography identical.
export const HEADING_CLASS =
  "break-inside-avoid-column font-reader text-[calc(1.7rem*var(--reader-font-scale)*var(--reader-block-scale,1))] leading-[1.15] font-bold tracking-[-0.03em] text-ink sm:text-[calc(2.15rem*var(--reader-font-scale)*var(--reader-block-scale,1))]";
export const BLOCKQUOTE_CLASS =
  "border-l border-line/60 pl-5 font-reader text-[calc(1.18rem*var(--reader-font-scale)*var(--reader-block-scale,1))] leading-[1.9] italic text-ink/90 sm:text-[calc(1.3rem*var(--reader-font-scale)*var(--reader-block-scale,1))]";
// em padding keeps scaled ordered-list markers inside the column.
export const LIST_CLASS =
  "space-y-1 pl-[1.8em] font-reader text-[calc(1.12rem*var(--reader-font-scale)*var(--reader-block-scale,1))] leading-relaxed text-ink sm:text-[calc(1.28rem*var(--reader-font-scale)*var(--reader-block-scale,1))]";
export const PARAGRAPH_CLASS =
  "font-reader text-[calc(1.16rem*var(--reader-font-scale)*var(--reader-block-scale,1))] leading-loose tracking-[-0.01em] text-ink sm:text-[calc(1.34rem*var(--reader-font-scale)*var(--reader-block-scale,1))]";
