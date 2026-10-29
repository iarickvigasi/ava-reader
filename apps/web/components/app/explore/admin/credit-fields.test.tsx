import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { CreditFields } from "./credit-fields";
import { MetadataRows } from "./metadata-rows";
vi.mock("@/features/explore/admin/use-author-search", () => ({
  useAuthorSearch: () => ({ authors: [], error: "", loading: false }),
}));
const person = {
  authorId: "austen",
  authorName: "Jane Austen",
  role: "AUTHOR",
  creditedAs: null,
};
it("shows the selected person without an empty search field or single-person reorder controls", () => {
  const html = renderToStaticMarkup(
    withIntl(<CreditFields rows={[person]} change={vi.fn()} />),
  );
  expect(html).toContain("Jane Austen");
  expect(html).toContain(">Change</button>");
  expect(html).not.toContain("Search by name");
  expect(html).not.toContain("Move up");
  expect(html).not.toContain("Move down");
  expect(html).not.toContain("Name printed in the book");
  expect(html).not.toContain("Leave empty to use the selected name.");
  expect(html).not.toContain("bg-surface");
});
it("opens person search for new rows and uses readable role labels", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <CreditFields
        rows={[{ ...person, authorId: "", authorName: "" }]}
        change={vi.fn()}
      />,
    ),
  );
  expect(html).toContain("Search by name");
  expect(html).toContain("Type at least two characters");
  expect(html).toContain(">Translator</option>");
  expect(html).not.toContain(">TRANSLATOR</option>");
});
it("offers compact reordering for multiple contributors", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <CreditFields
        rows={[person, { ...person, authorId: "other", authorName: "Other" }]}
        change={vi.fn()}
      />,
    ),
  );
  expect(html).toContain('aria-label="Move up"');
  expect(html).toContain('aria-label="Move down"');
});
it("uses unboxed repeatable rows for other metadata forms too", () => {
  const html = renderToStaticMarkup(
    withIntl(
      <MetadataRows
        title="Identifiers"
        rows={[{ value: "123" }]}
        columns={[{ key: "value", label: "Value" }]}
        change={vi.fn()}
      />,
    ),
  );
  expect(html).not.toContain("bg-surface");
  expect(html).not.toContain("rounded-card");
});
