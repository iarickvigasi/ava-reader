import { Fragment } from "react";
import { splitAtBreakOpportunities } from "@/features/reader/break-opportunities";

// Renders a text run with a <wbr> at every break opportunity, so a bare URL
// folds after a slash instead of wherever the column edge happens to fall.
// <wbr> is a soft opportunity — invisible unless the line needs it — and an
// element rather than a character, so locator textOffsets are untouched.
export function ReaderBreakableText({ text }: { text: string }) {
  const parts = splitAtBreakOpportunities(text);

  if (parts.length === 1) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 ? <wbr /> : null}
        </Fragment>
      ))}
    </>
  );
}
