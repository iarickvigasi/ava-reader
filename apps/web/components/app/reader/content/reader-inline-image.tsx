import type { ReaderInline } from "@/lib/api-types";

type ImageInline = Extract<ReaderInline, { kind: "image" }>;

export function ReaderInlineImage({ inline }: { inline: ImageInline }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={inline.alt ?? ""}
      // max-w-full: an inline image wider than the column would
      // overflow into the next page exactly as a long word does.
      className="mx-1 inline-block max-h-32 max-w-full align-middle"
      src={inline.src}
    />
  );
}
