import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ReaderInlineContent } from "./reader-inline-content";

it.each([
  [600, true],
  [500, false],
  [400, true],
  [700, false],
] as const)(
  "retains explicit numeric weight %s over semantic bold %s",
  (fontWeight, bold) => {
    const html = renderToStaticMarkup(
      <ReaderInlineContent
        inlines={[
          {
            kind: "text",
            text: "A😀B",
            fontWeight,
            bold,
            presentation: { id: "source", bold },
          },
        ]}
      />,
    );
    expect(html).toContain(`font-weight:${fontWeight}`);
    expect(html).toContain("A😀B");
  },
);
it("retains canonical boolean weight when the explicit numeric field is absent", () => {
  for (const bold of [false, true]) {
    const html = renderToStaticMarkup(
      <ReaderInlineContent
        inlines={[
          { kind: "text", text: "Text", presentation: { id: "source", bold } },
        ]}
      />,
    );
    expect(html).toContain(`font-weight:${bold ? 700 : 400}`);
  }
});
