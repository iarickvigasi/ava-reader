import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import {
  CatalogAdminVisibilityProvider,
  useShowCatalogAdmin,
} from "./catalog-admin-visibility-context";
import { useIsCatalogAdmin } from "./use-is-catalog-admin";

const state = vi.hoisted(() => ({
  hidden: undefined as boolean | undefined,
  roles: [] as string[],
}));
vi.mock("@/features/offline/buckets/me", () => ({
  useCurrentUserCached: () => ({ roles: state.roles }),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: boolean) => [
    (state.hidden ??= initial),
    (hidden: boolean) => (state.hidden = hidden),
  ],
}));

function Visibility() {
  return (
    <output>
      {String(useIsCatalogAdmin())}:{String(useShowCatalogAdmin())}
    </output>
  );
}

function renderVisibility() {
  return renderToStaticMarkup(
    <CatalogAdminVisibilityProvider>
      <Visibility />
    </CatalogAdminVisibilityProvider>,
  );
}

beforeEach(() => Object.assign(state, { hidden: undefined, roles: [] }));

it.each([{ roles: [] }, { roles: ["DEVELOPER"] }])(
  "keeps roles $roles in the reader view",
  ({ roles }) => {
    state.roles = roles;
    expect(renderVisibility()).toContain("false:false");
    state.hidden = true;
    expect(renderVisibility()).toContain("false:false");
  },
);

it("hides and restores controls without changing ADMIN membership", () => {
  state.roles = ["ADMIN"];
  expect(renderVisibility()).toContain("true:true");
  state.hidden = true;
  expect(renderVisibility()).toContain("true:false");
  state.hidden = false;
  expect(renderVisibility()).toContain("true:true");
});

it("applies refreshed membership while controls are visible", () => {
  state.roles = ["ADMIN", "DEVELOPER"];
  expect(renderVisibility()).toContain("true:true");
  state.roles = ["DEVELOPER"];
  expect(renderVisibility()).toContain("false:false");
});

it("requires a shell visibility owner", () => {
  expect(() => renderToStaticMarkup(<Visibility />)).toThrow(
    "CatalogAdminVisibilityProvider",
  );
});
