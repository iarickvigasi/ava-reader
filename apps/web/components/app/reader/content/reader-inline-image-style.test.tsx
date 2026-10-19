import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ReaderInlineContent } from "./reader-inline-content";

it("retains the approved image-own style tokens and explicit zero resets without adding source text", () => {
  const html = renderToStaticMarkup(
    <ReaderInlineContent
      inlines={[
        {
          kind: "image",
          src: "data:image/png;base64,AA==",
          alt: "Source diagram",
          presentation: {
            id: "image-own",
            block_indent_em: 0,
            space_before_em: 0.2,
            space_after_em: 0,
            italic: false,
          },
        },
      ]}
    />,
  );
  expect(html).toContain('alt="Source diagram"');
  expect(html).toContain("margin-inline-start:0em");
  expect(html).toContain("margin-top:0.2em");
  expect(html).toContain("margin-bottom:0em");
  expect(html).toContain("font-style:normal");
  expect(html).not.toContain("<span>Source diagram");
});
