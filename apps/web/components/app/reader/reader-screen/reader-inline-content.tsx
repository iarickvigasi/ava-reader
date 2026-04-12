import type { ReaderInline } from "@/lib/api-types";
import { cn } from "@/lib/cn";

const READER_INLINE_KIND_IMAGE = "image";

export function ReaderInlineContent({ inlines }: { inlines: ReaderInline[] }) {
  return (
    <>
      {inlines.map((inline, index) => {
        const key = `${inline.kind}-${index}`;

        if (inline.kind === READER_INLINE_KIND_IMAGE) {
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={inline.alt ?? ""}
              className="mx-1 inline-block max-h-8 max-w-32 align-middle"
              src={inline.src}
            />
          );

          return inline.href ? (
            <a
              key={key}
              href={inline.href}
              className="underline decoration-line/60 underline-offset-4"
            >
              {image}
            </a>
          ) : (
            <span key={key}>{image}</span>
          );
        }

        const content = (
          <span
            className={cn(
              inline.bold && "font-bold",
              inline.italic && "italic",
            )}
          >
            {inline.text}
          </span>
        );

        return inline.href ? (
          <a
            key={key}
            href={inline.href}
            className="underline decoration-line/60 underline-offset-4 hover:text-title"
          >
            {content}
          </a>
        ) : (
          <span key={key}>{content}</span>
        );
      })}
    </>
  );
}
