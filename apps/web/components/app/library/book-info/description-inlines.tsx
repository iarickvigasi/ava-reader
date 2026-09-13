import { Fragment, type ReactNode } from "react";
import type { DescriptionInline } from "@/features/library/book-description/types";

export function DescriptionInlines({
  inlines,
}: {
  inlines: DescriptionInline[];
}) {
  return (
    <>
      {inlines.map((inline, index) => {
        if (inline.type === "break") {
          return <br key={index} />;
        }

        let content: ReactNode = inline.text;
        if (inline.italic) {
          content = <em>{content}</em>;
        }
        if (inline.bold) {
          content = <strong className="font-bold text-copy-strong">{content}</strong>;
        }
        return <Fragment key={index}>{content}</Fragment>;
      })}
    </>
  );
}
