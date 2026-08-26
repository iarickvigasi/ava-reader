import { ReadBookLink } from "@/components/app/core/read-book-link";
import { BookCover } from "@/components/app/shared/book-cover";
import { resolveApiAssetUrl } from "@/lib/api";
import { getReaderHref } from "@/lib/app-routes";

type BookCoverPanelProps = {
  coverImageUrl: null | string;
  // The book-info screen passes this to make the cover a second Read button
  // (same reader target, same offline missing-book interception). The route's
  // loading skeleton has no libraryItemId yet and stays inert like the rest
  // of the skeleton, so the prop is optional.
  readerLink?: { libraryItemId: string; slug: string };
  title: string;
};

export function BookCoverPanel({
  coverImageUrl,
  readerLink,
  title,
}: BookCoverPanelProps) {
  // `relative` keeps the cover painting above the backing layer, from inside
  // the link wrapper too.
  const cover = (
    <BookCover
      alt={`${title} cover`}
      className="relative w-full shadow-(--shadow-card)"
      src={resolveApiAssetUrl(coverImageUrl)}
      title={title}
    />
  );

  // `self-start` is load-bearing: this panel is a grid item, and a stretched one
  // would be as tall as the details column — which the backing layer below
  // inherits from it. Shrink-wrapping keeps the wrapper at cover height.
  return (
    <div className="relative mx-auto w-full max-w-80 self-start md:max-w-96 lg:mx-0">
      {/* Offset backing layer — sized by its insets alone, so it tracks the
          cover whatever ratio the artwork turns out to be. */}
      <div className="absolute inset-[10px_-10px_-10px_10px] rounded-cover bg-ink/6" />
      {readerLink ? (
        <ReadBookLink
          href={getReaderHref(readerLink.slug)}
          libraryItemId={readerLink.libraryItemId}
          aria-label={`Open ${title}`}
          className="block"
        >
          {cover}
        </ReadBookLink>
      ) : (
        cover
      )}
    </div>
  );
}
