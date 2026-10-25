import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { CatalogStatus } from "./catalog-status";
import { CatalogFeedFooter } from "./catalog-feed-footer";

it("keeps loading in the footer and shows Retry once in the error card", () => {
  const props = {
    hasNext: true,
    hasItems: true,
    stale: false,
    loadMore: () => undefined,
  };
  const loading = renderToStaticMarkup(
    withIntl(<CatalogFeedFooter {...props} busy error={false} />),
  );
  expect(loading).toContain("Loading books");
  expect(loading).not.toContain("Load more");
  const failed = renderToStaticMarkup(
    withIntl(
      <>
        <CatalogStatus
          error
          stale={false}
          loading={false}
          retry={() => undefined}
        />
        <CatalogFeedFooter {...props} busy={false} error />
      </>,
    ),
  );
  expect(failed.match(/>Retry</g)).toHaveLength(1);
  expect(failed).toContain('role="alert"');
  expect(failed).toContain("Catalog unavailable");
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
        />,
      ),
    );
    expect(markup.includes("reached the end")).toBe(hasItems);
  },
);
