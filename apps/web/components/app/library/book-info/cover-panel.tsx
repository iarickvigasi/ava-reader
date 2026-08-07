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
  return (
    <div className="relative mx-auto w-full max-w-80 md:max-w-96 lg:mx-0">
      {/* Offset backing layer — insets alone size it to the cover, so it keeps
          tracking the frame now that the frame hugs each cover's own ratio. */}
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
