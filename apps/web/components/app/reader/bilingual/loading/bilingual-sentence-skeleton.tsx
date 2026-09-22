export function BilingualSentenceSkeleton({ text }: { text: string }) {
  return (
    <span
      aria-hidden="true"
      data-bilingual-skeleton
      className="select-none rounded bg-paper-strong text-transparent box-decoration-clone motion-safe:animate-pulse"
    >
      {text.trim()}
    </span>
  );
}
