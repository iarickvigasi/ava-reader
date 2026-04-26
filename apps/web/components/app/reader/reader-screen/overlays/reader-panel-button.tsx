import { ChartIcon } from "@/components/app/shared/app-icons";

export function ReaderPanelButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line/50 bg-white/70 px-4 font-ui text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink shadow-[0_14px_34px_rgba(31,27,24,0.08)] transition hover:bg-white"
      onClick={onOpen}
    >
      <ChartIcon className="size-4" />
      Reader panel
    </button>
  );
}
