import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { CatalogVirtualGrid } from "./catalog-virtual-grid";

it("renders only a viewport and overscan from 10,000 works", () => {
  const items = Array.from({ length: 10_000 }, (_, index) => ({
    id: String(index),
    originalTitle: `Book ${index}`,
    originalLanguage: null,
    texts: [],
    credits: [],
  }));
  const html = renderToStaticMarkup(
    withIntl(
      <CatalogVirtualGrid
        items={items}
        gridRef={createRef()}
        label="Books"
        focusedId={null}
        focusedHref={null}
        setAnchor={vi.fn()}
        restoreRef={createRef()}
        onFocus={vi.fn()}
        onBlur={vi.fn()}
        loading={false}
        busy={false}
      />,
    ),
  );
  expect(html.match(/data-catalog-work=/g)).toHaveLength(8);
  expect(html).not.toContain("Book 9999");
});
