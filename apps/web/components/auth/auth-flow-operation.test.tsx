import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Use the repository's injected-hook scheduler: real flow and controller,
// real JSX handlers/props, and effects committed after each controlled render.
const hooks = vi.hoisted(() => ({
  stateCursor: 0,
  effectCursor: 0,
  states: [] as unknown[],
  effects: [] as { deps: readonly unknown[]; cleanup?: () => void }[],
  pending: [] as (() => void)[],
}));
const sdk = vi.hoisted(() => ({
  create: vi.fn(),
  send: vi.fn(),
  verify: vi.fn(),
  sso: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("react", async (original) => {
  const useEffect = (
    effect: () => (() => void) | void,
    deps: readonly unknown[],
  ) => {
    const index = hooks.effectCursor++,
      old = hooks.effects[index];
    if (
      old &&
      deps.length === old.deps.length &&
      deps.every((dep, i) => Object.is(dep, old.deps[i]))
    )
      return;
    hooks.pending.push(() => {
      old?.cleanup?.();
      hooks.effects[index] = { deps, cleanup: effect() || undefined };
    });
  };
  return {
    ...(await original<typeof import("react")>()),
    useState: (initial: unknown) => {
      const index = hooks.stateCursor++;
      if (!(index in hooks.states))
        hooks.states[index] =
          typeof initial === "function" ? initial() : initial;
      return [
        hooks.states[index],
        (next: unknown) => {
          hooks.states[index] =
            typeof next === "function" ? next(hooks.states[index]) : next;
        },
      ];
    },
    useEffect,
    useLayoutEffect: useEffect,
  };
});
vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({
    client: { signIn: { authenticateWithRedirect: sdk.sso } },
  }),
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: false,
    userId: null,
    sessionId: null,
  }),
  useSignIn: () => ({
    signIn: {
      create: sdk.create,
      sso: sdk.sso,
      emailCode: { sendCode: sdk.send, verifyCode: sdk.verify },
      status: "needs_first_factor",
    },
    fetchStatus: "idle",
    errors: { fields: {}, global: [] },
  }),
  useSignUp: () => ({
    signUp: {
      create: sdk.create,
      sso: sdk.sso,
      verifications: { sendEmailCode: sdk.send, verifyEmailCode: sdk.verify },
      status: "missing_requirements",
    },
    fetchStatus: "idle",
    errors: { fields: {}, global: [] },
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: sdk.replace }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/auth/local-sign-out", () => ({
  isLocallySignedOut: () => false,
}));
import { SignInFlow } from "./sign-in-flow";
import { SignUpFlow } from "./sign-up-flow";
import { EmailCodePanel } from "./email-code-panel";
import { ProviderList } from "./provider-list";
import { AuthReadinessNotice } from "./auth-readiness-notice";
import { AUTH_TIMEOUT_MS } from "@/features/auth/with-deadline";

type Panel = ComponentProps<typeof EmailCodePanel>;
type Providers = ComponentProps<typeof ProviderList>;
type Notice = ComponentProps<typeof AuthReadinessNotice>;
function find<T>(node: ReactNode, type: unknown): T | undefined {
  if (Array.isArray(node))
    return node.map((child) => find<T>(child, type)).find(Boolean);
  if (!isValidElement<T & { children?: ReactNode }>(node)) return;
  return node.type === type ? node.props : find<T>(node.props.children, type);
}
function render(Flow: (props: { initialNotice?: string }) => ReactNode) {
  hooks.stateCursor = hooks.effectCursor = 0;
  const tree = Flow({});
  hooks.pending.splice(0).forEach((commit) => commit());
  if (!isValidElement<{ footer?: ReactNode }>(tree))
    throw new Error("missing flow shell");
  return {
    providers: find<Providers>(tree, ProviderList)!,
    panel: find<Panel>(tree, EmailCodePanel),
    notice: find<Notice>(tree, AuthReadinessNotice)!,
    footer: tree.props.footer,
  };
}
function deferred() {
  let resolve!: (value: { error: null }) => void;
  const promise = new Promise<{ error: null }>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  hooks.states = [];
  hooks.effects = [];
  hooks.pending = [];
  sdk.send.mockResolvedValue({ error: null });
  sdk.verify.mockResolvedValue({ error: null });
});
afterEach(() => {
  hooks.effects.forEach((effect) => effect.cleanup?.());
  vi.useRealTimers();
});

describe.each([
  ["sign in", SignInFlow, { identifier: "first@example.test" }],
  ["sign up", SignUpFlow, { emailAddress: "first@example.test" }],
] as const)("%s real flow composition", (_, Flow, expectedCreate) => {
  function begin() {
    let view = render(Flow);
    view.providers.onEmail();
    view = render(Flow);
    view.panel!.onEmailChange("first@example.test");
    view = render(Flow);
    view.panel!.onSubmitIdentifier();
    view.panel!.onSubmitIdentifier();
    attemptEdits(view); // Old rendered handlers must see the immediate lock too.
    return render(Flow);
  }
  function attemptEdits(view: ReturnType<typeof render>) {
    view.panel!.onEmailChange("second@example.test");
    view.panel!.onCodeChange("999999");
    view.panel!.onBack();
    view.providers.onEmail();
    view.providers.onGoogle();
  }
  function expectLocked(
    view: ReturnType<typeof render>,
    state: "pending" | "timed-out",
  ) {
    expect(view.panel).toMatchObject({
      email: "first@example.test",
      disabled: true,
      interactionLocked: true,
    });
    expect(view.providers).toMatchObject({
      emailDisabled: true,
      googleDisabled: true,
    });
    expect(view.footer).toBeNull();
    expect(view.notice.operation).toBe(state);
  }
  it("freezes actual email/code/Back/provider handlers and dispatches once, then shows the original identifier's code phase", async () => {
    const create = deferred();
    sdk.create.mockReturnValue(create.promise);
    let view = begin();
    expectLocked(view, "pending");
    attemptEdits(view);
    view.panel!.onSubmitIdentifier();
    view = render(Flow);
    expect(view.panel).toMatchObject({
      stage: "identifier",
      email: "first@example.test",
      code: "",
    });
    expect(sdk.create.mock.calls).toEqual([[expectedCreate]]);
    expect(sdk.send).not.toHaveBeenCalled();
    expect(sdk.sso).not.toHaveBeenCalled();
    create.resolve({ error: null });
    await settle();
    view = render(Flow);
    expect(sdk.send).toHaveBeenCalledTimes(1);
    expect(view.panel).toMatchObject({
      stage: "code",
      email: "first@example.test",
      code: "",
      disabled: false,
      interactionLocked: false,
    });
    expect(view.providers.emailDisabled).toBe(false);
    expect(view.footer).not.toBeNull();
  });
  it("holds Reload-only recovery after expiry and ignores late create completion before sending code or changing phase", async () => {
    const create = deferred();
    sdk.create.mockReturnValue(create.promise);
    begin();
    vi.advanceTimersByTime(AUTH_TIMEOUT_MS);
    let view = render(Flow);
    expectLocked(view, "timed-out");
    attemptEdits(view);
    view.panel!.onSubmitIdentifier();
    create.resolve({ error: null });
    await settle();
    view = render(Flow);
    expectLocked(view, "timed-out");
    expect(view.panel).toMatchObject({
      stage: "identifier",
      email: "first@example.test",
      code: "",
    });
    expect(sdk.create.mock.calls).toEqual([[expectedCreate]]);
    expect(sdk.send).not.toHaveBeenCalled();
    expect(sdk.sso).not.toHaveBeenCalled();
    const notice = renderToStaticMarkup(
      <AuthReadinessNotice {...view.notice} />,
    );
    expect(notice).toContain('data-auth-readiness="timed-out"');
    expect(notice).toMatch(/<button[^>]*>reload<\/button>/);
  });
  it("keeps the actual code and identifier fixed during verification and refuses repeated verification", async () => {
    sdk.create.mockResolvedValue({ error: null });
    begin();
    await settle();
    let view = render(Flow);
    view.panel!.onCodeChange("123456");
    view = render(Flow);
    const verify = deferred();
    sdk.verify.mockReturnValue(verify.promise);
    view.panel!.onSubmitCode();
    view.panel!.onSubmitCode();
    attemptEdits(view);
    view = render(Flow);
    expectLocked(view, "pending");
    attemptEdits(view);
    view = render(Flow);
    expect(view.panel).toMatchObject({
      stage: "code",
      email: "first@example.test",
      code: "123456",
    });
    expect(sdk.verify.mock.calls).toEqual([[{ code: "123456" }]]);
    verify.resolve({ error: null });
    await settle();
    view = render(Flow);
    expect(view.panel).toMatchObject({
      stage: "code",
      email: "first@example.test",
      code: "123456",
      interactionLocked: false,
    });
    expect(sdk.send).toHaveBeenCalledTimes(1);
    expect(sdk.replace).not.toHaveBeenCalled();
  });
});
