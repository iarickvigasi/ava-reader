import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { BookDescription } from "./description";

describe("BookDescription", () => {
  it("renders source emphasis with app typography and removes publisher markup", () => {
    const description = [
      '<div class="publisher-layout" style="text-align:justify" onclick="alert(1)">',
      '<font face="MS Shell Dlg 2"><span style="font-size:12px">',
      'A <b>bold</b> and <i>italic</i> introduction. <b><i>Both</i></b>',
      '</span></font><a href="https://example.com">Link label</a>',
      '<script>alert(1)</script><img src="https://example.com/image.jpg">',
      '<iframe src="https://example.com"></iframe></div>',
    ].join("");
    const markup = renderToStaticMarkup(withIntl(
      <BookDescription description={description} />,
    ));

    expect(markup).toContain("About this book");
    expect(markup).toMatch(/<strong[^>]*>bold<\/strong>/);
    expect(markup).toContain("<em>italic</em>");
    expect(markup).toMatch(/<strong[^>]*><em>Both<\/em><\/strong>/);
    expect(markup).toContain("Link label");
    expect(markup).not.toMatch(/<font|<script|<img|<iframe|<a\s|style=|onclick=|publisher-/);
  });

  it("renders semantic quotes and nested ordered and unordered lists", () => {
    const description = [
      '<blockquote><p>A thought.</p><p>Another thought.</p></blockquote>',
      '<ol><li>First<ul><li>Nested</li></ul></li><li>Second</li></ol>',
    ].join("");
    const markup = renderToStaticMarkup(withIntl(
      <BookDescription description={description} />,
    ));

    expect(markup).toMatch(/<blockquote[^>]*><p>A thought\.<\/p><p>Another thought\.<\/p>/);
    expect(markup).toContain("<ol ");
    expect(markup).toContain("<ul ");
    expect(markup.match(/<li /g)).toHaveLength(3);
    expect(markup).toContain("<p>Nested</p>");
  });

  it("keeps single line breaks and separates paragraphs at repeated breaks", () => {
    const markup = renderToStaticMarkup(withIntl(
      <BookDescription description="<p>A<br>B<br><br>C</p>" />,
    ));

    expect(markup).toContain("<p>A<br/>B</p><p>C</p>");
  });

  it.each([null, "", "<div><p>&nbsp;</p><br></div>", "<script>hidden()</script>"])(
    "shows the translated fallback when %s has no readable content",
    (description) => {
      const markup = renderToStaticMarkup(withIntl(
        <BookDescription description={description} />,
      ));

      expect(markup).toContain("Detailed editorial notes are not available yet for this edition.");
    },
  );

  it("retains repeated paragraphs", () => {
    const markup = renderToStaticMarkup(withIntl(
      <BookDescription description="<p>Repeated.</p><p>Repeated.</p>" />,
    ));

    expect(markup.match(/<p>Repeated\.<\/p>/g)).toHaveLength(2);
  });

  it("normalizes encoded markup during server rendering without a DOM", () => {
    const markup = renderToString(withIntl(
      <BookDescription description="&lt;p&gt;A &amp;amp; B&lt;/p&gt;" />,
    ));

    expect(markup).toContain("<p>A &amp; B</p>");
    expect(markup).not.toContain("&lt;p&gt;");
  });
});
