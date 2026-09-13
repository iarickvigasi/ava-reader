import { describe, expect, it } from "vitest";

import { descriptionText } from "./fixtures/description-text";
import { parseBookDescription } from "./parse-book-description";

describe("description content boundaries", () => {
  it("drops executable and embedded content while keeping text from ordinary wrappers and links", () => {
    const blocks = parseBookDescription('<div class="publisher" style="color:red" onclick="bad()">' +
      '<script>alert("secret script")</script><style>.secret-style{display:none}</style>' +
      '<iframe src="https://example.com">secret iframe</iframe>' +
      '<object data="x">secret object</object><embed src="x">' +
      '<img src="x" onerror="bad()" alt="secret image">' +
      '<a href="javascript:bad()" target="_blank">Read <em>this</em></a>' +
      "<span> book.</span><!--secret comment--></div>");
    expect(descriptionText(blocks)).toBe("Read this book.");
    expect(JSON.stringify(blocks)).not.toMatch(/secret|bad\(|publisher|color:red|href|onclick|src/);
    expect(blocks[0]).toMatchObject({ type: "paragraph", children: expect.arrayContaining([
      expect.objectContaining({ type: "text", text: "this", italic: true }),
    ]) });
  });

  it("returns the empty fallback signal for descriptions containing only unsafe content", () => {
    expect(parseBookDescription("<script>bad()</script><style>body{color:red}</style><img src=x>"))
      .toEqual([]);
  });

  it("accepts one encoded HTML layer for an entirely encoded description", () => {
    const blocks = parseBookDescription(
      "&lt;div&gt;&lt;p&gt;The &lt;i&gt;title&lt;/i&gt; &amp;amp; story.&lt;/p&gt;&lt;/div&gt;",
    );
    expect(descriptionText(blocks)).toBe("The title & story.");
    expect(blocks[0]).toMatchObject({ type: "paragraph", children: expect.arrayContaining([
      expect.objectContaining({ type: "text", text: "title", italic: true }),
    ]) });
  });

  it("keeps escaped tags within ordinary prose as literal text", () => {
    const blocks = parseBookDescription("Use &lt;b&gt;bold&lt;/b&gt; tags &amp; enjoy.");
    expect(descriptionText(blocks)).toBe("Use <b>bold</b> tags & enjoy.");
    expect(blocks[0]).toMatchObject({ children: expect.arrayContaining([
      expect.objectContaining({ type: "text", bold: false, italic: false }),
    ]) });
  });

  it("does not repeatedly decode deeply encoded markup or ampersands", () => {
    expect(descriptionText(parseBookDescription("&amp;lt;p&amp;gt;Literal&amp;lt;/p&amp;gt;")))
      .toBe("&lt;p&gt;Literal&lt;/p&gt;");
    expect(descriptionText(parseBookDescription("Fish &amp;amp; chips"))).toBe("Fish &amp; chips");
  });
});
