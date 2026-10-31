export function ToolRetryButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center rounded-full bg-paper-strong/70 px-3 py-1.5 font-ui text-[0.7rem] uppercase tracking-[0.16em] text-ink transition hover:bg-paper-strong"
    >
      {label}
    </button>
  );
}
