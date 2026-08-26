import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CollectionsPanel } from "./collections-panel";
import type { HomePayload } from "@/lib/api-types";
import { withIntl } from "@/lib/test-utils/intl";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

type Collection = HomePayload["collections"]["items"][number];

describe("home collections panel", () => {
  it("links each row to its collection page and the header to the library", () => {
    const markup = renderToStaticMarkup(
      withIntl(<CollectionsPanel collections={[createCollection()]} />),
    );

    expect(markup).toContain(
      'href="/app/library/collections/stoic-philosophy"',
    );
    expect(markup).toContain('href="/app/library"');
    expect(markup).toContain("Stoic Philosophy");
  });

  // Home payloads cached in Dexie before the slug field existed keep rendering
  // until revalidation replaces them; those rows degrade to the library link.
  it("falls back to the library link when a cached payload has no slug", () => {
    const legacy = createCollection({ slug: undefined as unknown as string });

    const markup = renderToStaticMarkup(
      withIntl(<CollectionsPanel collections={[legacy]} />),
    );

    expect(markup).not.toContain("/app/library/collections/");
    expect(markup).toContain('href="/app/library"');
  });
});

function createCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    description: null,
    id: "collection-1",
    itemCount: 3,
    kind: "CUSTOM",
    name: "Stoic Philosophy",
    slug: "stoic-philosophy",
    smartKey: null,
    unreadCount: 2,
    ...overrides,
  };
}
