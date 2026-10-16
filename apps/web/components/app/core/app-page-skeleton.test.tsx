import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AppPageSkeleton } from "./app-page-skeleton";

const route = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/components/app/library/library-screen", () => ({
  LibraryScreenSkeleton: () => <div>Library skeleton</div>,
}));
vi.mock(
  "@/components/app/library/collection/collection-placeholder-page",
  () => ({
    LibraryCollectionPlaceholderPage: () => <div>Collection skeleton</div>,
  }),
);

it.each([
  "/app",
  "/app/connect",
  "/app/explore",
  "/app/insights",
  "/app/admin/catalog",
  "/app/read/book",
  "/app/library/books/book",
])(
  "renders a full-page skeleton for %s without account providers",
  (pathname) => {
    route.pathname = pathname;
    const html = renderToStaticMarkup(<AppPageSkeleton />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("animate-pulse");
    expect(html).not.toContain("Opening your library");
  },
);

it.each([
  ["/app/library", "Library skeleton"],
  ["/app/library/collections/shelf", "Collection skeleton"],
])("reuses the existing skeleton for %s", (pathname, expected) => {
  route.pathname = pathname;
  expect(renderToStaticMarkup(<AppPageSkeleton />)).toContain(expected);
});
