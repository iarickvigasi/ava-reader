type MobileCloseButtonProps = {
  ariaLabel: string;
  onClose: () => void;
};

export function MobileCloseButton({ ariaLabel, onClose }: MobileCloseButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-soft-tone-fill text-ink transition hover:bg-paper-strong md:hidden"
      onClick={onClose}
    >
      <span className="font-(--font-ui) text-lg leading-none">×</span>
    </button>
  );
}
