import { BookCover } from "@/components/app/shared/book-cover";

type BookCoverPanelProps = {
  coverImageDataUrl: null | string;
  title: string;
};

export function BookCoverPanel({
  coverImageDataUrl,
  title,
}: BookCoverPanelProps) {
  return (
    <div className="relative mx-auto w-full max-w-80 md:max-w-96 lg:mx-0">
      <div className="absolute inset-[10px_-10px_-10px_10px] aspect-2/3 rounded-sm bg-ink/6" />
      <BookCover
        alt={`${title} cover`}
        className="relative aspect-2/3 w-full rounded-sm border-0 bg-paper-strong shadow-(--shadow-card)"
        src={coverImageDataUrl}
        title={title}
      />
    </div>
  );
}
