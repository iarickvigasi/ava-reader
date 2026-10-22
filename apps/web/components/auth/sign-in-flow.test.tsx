import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({
  online: true,
  message: "Please try again.",
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("./auth-shell", () => ({
  AuthShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("./provider-list", () => ({
  ProviderList: () => <button>Google</button>,
}));
vi.mock("@/features/auth/use-sign-in-flow", () => ({
  useSignInFlow: () => ({ ...state, phase: "idle", signedIn: false }),
}));
import { SignInFlow } from "./sign-in-flow";
it("shows login errors on the initial provider screen", () => {
  const html = renderToStaticMarkup(<SignInFlow />);
  expect(html).toContain('role="alert"');
  expect(html).toContain("Please try again.");
});
it("shows connection guidance offline", () => {
  state.online = false;
  expect(renderToStaticMarkup(<SignInFlow />)).toContain("offline");
  state.online = true;
});
