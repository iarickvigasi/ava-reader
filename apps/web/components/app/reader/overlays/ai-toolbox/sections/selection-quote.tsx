import { cn } from "@/lib/cn";

type SelectionQuoteProps = {
  text: string;
  isExpanded: boolean;
  onToggle: () => void;
};

// The strip's quote line (spec 3, Behaviour 7): a toggle button showing one
// truncated line collapsed and the full wrapped fragment expanded. The quote
// text itself is the accessible name; aria-expanded carries the state.
export function SelectionQuote({
  text,
  isExpanded,
  onToggle,
}: SelectionQuoteProps) {
  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      onClick={onToggle}
      className={cn(
        "min-w-0 flex-1 cursor-pointer text-left font-display text-[1.05rem] leading-[1.4] text-ink",
        isExpanded ? "break-words" : "truncate",
      )}
    >
      {`“${text}”`}
    </button>
  );
}
