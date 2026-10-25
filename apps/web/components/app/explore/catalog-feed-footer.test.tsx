import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { CatalogFeedFooter } from "./catalog-feed-footer";

it("keeps next-batch loading and retry controls at the feed footer", () => {
  const props = {
    hasNext: true,
    hasItems: true,
    stale: false,
    loadMore: () => undefined,
    retry: () => undefined,
  };
  const loading = renderToStaticMarkup(
    withIntl(<CatalogFeedFooter {...props} busy error={false} />),
  );
  expect(loading).toContain("Loading books");
  expect(loading).not.toContain("Load more");
  const failed = renderToStaticMarkup(
    withIntl(<CatalogFeedFooter {...props} busy={false} error />),
  );
  expect(failed).toContain("Retry");
  expect(failed).not.toContain("reached the end");
});

it.each([false, true])(
  "shows the end message only for nonempty results: %s",
  (hasItems) => {
    const markup = renderToStaticMarkup(
      withIntl(
        <CatalogFeedFooter
          hasItems={hasItems}
          hasNext={false}
          busy={false}
          error={false}
          stale={false}
          loadMore={() => undefined}
          retry={() => undefined}
        />,
      ),
    );
    expect(markup.includes("reached the end")).toBe(hasItems);
  },
);
