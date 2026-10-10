import type { ReaderBlock } from "@/lib/api-types";
import { ReaderContentLink } from "./reader-content-link";
import { useReaderMeasurement } from "./reader-measurement-context";
import { useReaderImage } from "./use-reader-image";
import { ReaderImageFailure } from "./reader-image-failure";

export function ReaderImageContent({
  block,
  maxHeight,
  sourceLink = true,
}: {
  block: Extract<ReaderBlock, { kind: "image" }>;
  maxHeight?: number;
  sourceLink?: boolean;
}) {
  const measurement = useReaderMeasurement(),
    image = useReaderImage(block);
  const placeholder = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${block.width ?? 320}" height="${block.height ?? 200}"/>`)}`;
  const rendered = (
    // The same intrinsic dimensions reserve geometry before/after real retry.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={image.attempt}
      src={image.missing ? placeholder : image.src}
      alt={image.missing ? "" : (block.alt ?? "")}
      aria-hidden={image.missing || undefined}
      width={block.width}
      height={block.height}
      onError={image.missing ? undefined : image.fail}
      className={
        block.canonical
          ? "mx-auto max-w-full object-contain"
          : "w-full rounded-card object-contain"
      }
      style={{ maxHeight }}
    />
  );
  return (
    <div
      className={
        block.canonical
          ? "relative mx-auto w-fit max-w-full"
          : "relative w-full"
      }
    >
      {!image.missing && sourceLink ? (
        <ReaderContentLink link={block}>{rendered}</ReaderContentLink>
      ) : (
        rendered
      )}
      {image.missing && !measurement && (
        <ReaderImageFailure
          alt={block.alt}
          loading={image.loading}
          compact={(block.width ?? 320) < 140 || (block.height ?? 200) < 80}
          retry={image.canRetry ? image.retry : undefined}
        />
      )}
    </div>
  );
}
