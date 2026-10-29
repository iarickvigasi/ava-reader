import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { FeaturedDescription } from "./featured-description";

it.each([
  "<p><i>Emma</i> &amp; friends.</p>",
  "&lt;p&gt;&lt;i&gt;Emma&lt;/i&gt; &amp;amp; friends.&lt;/p&gt;",
])(
  "decodes publisher descriptions using book-info formatting (%s)",
  (description) => {
    const html = renderToStaticMarkup(
      withIntl(<FeaturedDescription description={description} />),
    );
    expect(html).toContain("<em>Emma</em> &amp; friends.");
    expect(html).not.toContain("&lt;p&gt;");
    expect(html).toContain("line-clamp-4");
  },
);

it("omits unsafe markup and link destinations", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <FeaturedDescription description='<p>A <a href="https://example.com">novel</a>.</p><script>alert(1)</script>' />,
    ),
  );
  expect(html).toContain("A novel.");
  expect(html).not.toContain("script");
  expect(html).not.toContain("https://example.com");
});
