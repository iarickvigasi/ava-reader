export function ExploreIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        backgroundColor: "currentColor",
        mask: "url('/icons/navigation/explore.svg') center / contain no-repeat",
      }}
    />
  );
}
