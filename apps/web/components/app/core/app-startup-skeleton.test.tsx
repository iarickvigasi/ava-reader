import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AppStartupSkeleton } from "./app-startup-skeleton";

const route = vi.hoisted(() => ({ pathname: "/app/explore" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("./app-navigation", () => ({
  AppNavigation: ({
    currentUser,
    startup,
  }: {
    currentUser: unknown;
    startup: boolean;
  }) => {
    expect(currentUser).toBeNull();
    expect(startup).toBe(true);
    return (
      <header>
        <a href="/app/explore">Explore</a>
      </header>
    );
  },
}));
vi.mock("./app-page-skeleton", () => ({
  AppPageSkeleton: () => <div aria-busy="true">Page skeleton</div>,
}));

it.each([
  "/app/explore",
  "/app/explore/books/work",
  "/app/explore/authors/author",
])("keeps navigation above the startup skeleton for %s", (pathname) => {
  route.pathname = pathname;
  const html = renderToStaticMarkup(<AppStartupSkeleton />);
  expect(html).toContain('href="/app/explore"');
  expect(html.indexOf("</header>")).toBeLessThan(
    html.indexOf('aria-busy="true"'),
  );
});
it("retains dedicated reader startup without mounting reader navigation outside its provider", () => {
  route.pathname = "/app/read/book";
  const html = renderToStaticMarkup(<AppStartupSkeleton />);
  expect(html).not.toContain("<header");
  expect(html).toContain('aria-busy="true"');
});
