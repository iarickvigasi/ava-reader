import type { ComponentProps } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { ProfileAdminVisibilityControl } from "./profile-admin-visibility-control";
import type { Button } from "@/components/ui/button";

const state = vi.hoisted(() => ({ hidden: false, roles: [] as string[] }));
vi.mock("@/features/offline/buckets/me", () => ({
  useCurrentUserCached: () => ({ roles: state.roles }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: keyof typeof en.profile) => en.profile[key],
}));
vi.mock("@/features/explore/admin/catalog-admin-visibility-context", () => ({
  useCatalogAdminVisibility: () => ({
    hidden: state.hidden,
    setHidden: (hidden: boolean) => (state.hidden = hidden),
  }),
}));

beforeEach(() => Object.assign(state, { hidden: false, roles: [] }));

it.each([{ roles: [] }, { roles: ["DEVELOPER"] }])(
  "omits the action for roles $roles",
  ({ roles }) => {
    state.roles = roles;
    expect(ProfileAdminVisibilityControl()).toBeNull();
  },
);

it("changes visibility immediately without submitting the profile form", () => {
  state.roles = ["ADMIN"];
  const hide = ProfileAdminVisibilityControl()!.props as ComponentProps<
    typeof Button
  >;
  expect(hide.children).toBe("Hide admin controls");
  expect(hide.type).toBe("button");
  hide.onClick!(undefined!);
  const show = ProfileAdminVisibilityControl()!.props as typeof hide;
  expect(show.children).toBe("Show admin controls");
  expect(show.type).toBe("button");
  show.onClick!(undefined!);
  expect(ProfileAdminVisibilityControl()!.props.children).toBe(
    "Hide admin controls",
  );
});
