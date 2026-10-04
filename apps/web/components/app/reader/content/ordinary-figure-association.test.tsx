import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ReaderBlockView } from "./reader-block-view";

it("associates an ordinary extracted illustration with its actual caption and credit IDs", () => {
  const html = renderToStaticMarkup(
    <>
      <ReaderBlockView
        chapterId="body"
        pageHeight={700}
        block={{
          kind: "image",
          id: "figure",
          text: "",
          src: "data:image/png;base64,AA==",
          alt: "Window",
          captionId: "caption",
          creditId: "credit",
        }}
      />
      <ReaderBlockView
        chapterId="body"
        pageHeight={700}
        block={{
          kind: "caption",
          id: "caption",
          anchorId: "source-caption",
          text: "Blue window.",
          inlines: [{ kind: "text", text: "Blue window." }],
        }}
      />
      <ReaderBlockView
        chapterId="body"
        pageHeight={700}
        block={{
          kind: "credit",
          id: "credit",
          text: "AVA Studio",
          inlines: [{ kind: "text", text: "AVA Studio" }],
        }}
      />
    </>,
  );
  expect(html).toContain(
    'aria-describedby="reader-body-caption reader-body-credit"',
  );
  expect(html).toContain('id="reader-body-caption"');
  expect(html).toContain('id="reader-body-credit"');
});
