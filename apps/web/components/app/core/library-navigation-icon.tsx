export function LibraryNavigationIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        backgroundColor: "currentColor",
        mask: "url('/icons/navigation/library.svg') center / contain no-repeat",
      }}
    />
  );
}
