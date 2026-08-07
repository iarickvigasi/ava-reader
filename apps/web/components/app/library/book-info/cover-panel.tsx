import { BookCover } from "@/components/app/shared/book-cover";
import { resolveApiAssetUrl } from "@/lib/api";

type BookCoverPanelProps = {
  coverImageUrl: null | string;
  title: string;
};

export function BookCoverPanel({
  coverImageUrl,
  title,
}: BookCoverPanelProps) {
  // `self-start` is load-bearing: this panel is a grid item, and a stretched one
  // would be as tall as the details column — which the backing layer below
  // inherits from it. Shrink-wrapping keeps the wrapper at cover height.
  return (
    <div className="relative mx-auto w-full max-w-80 self-start md:max-w-96 lg:mx-0">
      {/* Offset backing layer — sized by its insets alone, so it tracks the
          cover whatever ratio the artwork turns out to be. */}
      <div className="absolute inset-[10px_-10px_-10px_10px] rounded-cover bg-ink/6" />
      <BookCover
        alt={`${title} cover`}
        className="relative w-full shadow-(--shadow-card)"
        src={resolveApiAssetUrl(coverImageUrl)}
        title={title}
      />
    </div>
  );
}
