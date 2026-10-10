import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReaderInlineContent } from "./reader-inline-content";
import { ReaderBlockView } from "./reader-block-view";
import { ReaderMeasurementContext } from "./reader-measurement-context";
import { ReaderTextBlockView } from "./reader-text-block";

const target = { chapterId: "notes", blockId: "cell", textOffset: 3 };
const image = {
  kind: "image" as const,
  src: "data:image/png;base64,AA==",
  alt: "Diagram",
  href: "notes.xhtml#cell",
  target,
  sourceOffset: 4,
};
describe("reader image references", () => {
  it("routes linked inline and promoted images through internal reader destinations", () => {
    const renderings = [
      <ReaderInlineContent key="inline" inlines={[image]} />,
      <ReaderBlockView
        key="figure"
        block={{ ...image, id: "figure", text: "", sourceOffset: 0 }}
        chapterId="body"
        pageHeight={700}
      />,
    ];
    for (const rendering of renderings) {
      const html = renderToStaticMarkup(rendering);
      expect(html).toContain('href="#reader-notes-cell"');
      expect(html).not.toContain('href="notes.xhtml#cell"');
      expect(html).toContain('alt="Diagram"');
    }
  });
  it("leaves external image URLs intact and suppresses measurement destinations", () => {
    expect(
      renderToStaticMarkup(
        <ReaderInlineContent
          inlines={[
            {
              ...image,
              target: undefined,
              href: "https://example.org/diagram",
            },
          ]}
        />,
      ),
    ).toContain('href="https://example.org/diagram"');
    const html = renderToStaticMarkup(
      <ReaderMeasurementContext value={true}>
        <ReaderInlineContent inlines={[image]} />
      </ReaderMeasurementContext>,
    );
    expect(html).not.toContain("href=");
    expect(html).not.toContain("onclick=");
  });
  it("preserves whitespace on an ordinary index paragraph without changing its kind", () => {
    const html = renderToStaticMarkup(
      <ReaderTextBlockView
        block={{
          kind: "paragraph",
          id: "index",
          text: "A  1\nB  2",
          preserveWhitespace: true,
          inlines: [{ kind: "text", text: "A  1\nB  2" }],
        }}
        chapterId="body"
      />,
    );
    expect(html).toContain("<p");
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).toContain("A  1\nB  2");
    expect(html).not.toContain("<pre");
  });
});
