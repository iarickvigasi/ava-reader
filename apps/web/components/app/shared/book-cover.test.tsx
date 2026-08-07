import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookCover } from "./book-cover";

describe("BookCover", () => {
  it("contains the image inside the frame instead of cropping it to fill", () => {
    const markup = renderToStaticMarkup(
      <BookCover alt="Matrescence cover" src="/covers/a.jpg" title="Matrescence" />,
    );

    expect(markup).toContain("object-contain");
    expect(markup).not.toContain("object-cover");
  });

  it("owns the ratio so call sites cannot introduce a cropping box", () => {
    const book = renderToStaticMarkup(
      <BookCover alt="cover" className="w-28" src="/covers/a.jpg" title="A" />,
    );
    const square = renderToStaticMarkup(
      <BookCover alt="cover" ratio="square" src="/covers/a.jpg" title="A" />,
    );

    expect(book).toContain("aspect-2/3");
    expect(book).toContain("w-28");
    expect(square).toContain("aspect-square");
  });

  it("keeps the frame ratio when falling back to the placeholder", () => {
    const markup = renderToStaticMarkup(
      <BookCover alt="cover" src={null} title="Matrescence" />,
    );

    expect(markup).toContain("aspect-2/3");
    expect(markup).toContain("Matrescence");
    expect(markup).not.toContain("<img");
  });
});
