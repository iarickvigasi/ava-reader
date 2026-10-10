import { vi } from "vitest";
import type { SignInResource } from "@clerk/nextjs/types";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { authHooks } from "./auth-readiness-test-hooks";
import { ProviderList } from "./provider-list";
import { EmailCodePanel } from "./email-code-panel";
import { AuthReadinessNotice } from "./auth-readiness-notice";

const authSdk = vi.hoisted(() => ({
  loaded: true,
  sso: vi.fn(),
  redirect: vi.fn(),
  client: undefined as
    | {
        signIn: Pick<SignInResource, "authenticateWithRedirect"> &
          Partial<Pick<SignInResource, "id">>;
      }
    | undefined,
  create: vi.fn(),
  send: vi.fn(),
}));
export { authSdk };
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  ...(await import("./auth-readiness-test-hooks")).authMockHooks,
}));
vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({
    get client() {
      return authSdk.client;
    },
  }),
  useAuth: () => ({
    isLoaded: authSdk.loaded,
    isSignedIn: false,
    userId: null,
    sessionId: null,
  }),
  useSignIn: () => ({
    signIn: {
      sso: authSdk.sso,
      create: authSdk.create,
      emailCode: { sendCode: authSdk.send },
      status: "needs_first_factor",
    },
    fetchStatus: "idle",
    errors: { fields: {}, global: [] },
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/auth/local-sign-out", () => ({
  isLocallySignedOut: () => false,
}));

type Flow = (props: { initialNotice?: string }) => ReactNode;
function propsFor<T>(node: ReactNode, type: unknown): T | undefined {
  if (Array.isArray(node))
    return node.map((child) => propsFor<T>(child, type)).find(Boolean);
  if (!isValidElement<T & { children?: ReactNode }>(node)) return;
  return node.type === type
    ? node.props
    : propsFor<T>(node.props.children, type);
}

// Layout effects belong to the visible commit; passive effects may still be pending when clicked.
export function renderAuthFlow(Flow: Flow, commitPassive = true) {
  authHooks.stateCursor = authHooks.effectCursor = 0;
  const tree = Flow({});
  authHooks.layout.splice(0).forEach((commit) => commit());
  if (commitPassive) authHooks.passive.splice(0).forEach((commit) => commit());
  return {
    providers: propsFor<ComponentProps<typeof ProviderList>>(
      tree,
      ProviderList,
    )!,
    panel: propsFor<ComponentProps<typeof EmailCodePanel>>(
      tree,
      EmailCodePanel,
    ),
    notice: propsFor<ComponentProps<typeof AuthReadinessNotice>>(
      tree,
      AuthReadinessNotice,
    )!,
  };
}
export async function settleAuth() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
