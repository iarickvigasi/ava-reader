import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ values: [] as unknown[] }));
vi.mock("react", () => ({
  useState: (value: unknown) => {
    const index = state.values.length;
    state.values.push(value);
    return [
      value,
      (next: unknown) => {
        state.values[index] = next;
      },
    ];
  },
}));
import { useEmailSignIn as readEmailSignIn } from "./use-email-sign-in";
beforeEach(() => {
  state.values = [];
});
function setup() {
  const signIn = {
    status: "complete",
    firstFactorVerification: { status: "expired" },
    reset: vi.fn(async () => ({ error: null })),
    create: vi.fn(async () => ({ error: null })),
    emailCode: {
      sendCode: vi.fn(async () => ({ error: null as unknown })),
      verifyCode: vi.fn(async () => ({ error: null as unknown })),
    },
  };
  const finalize = vi.fn(async () => {});
  const flow = readEmailSignIn(
    signIn as unknown as Parameters<typeof readEmailSignIn>[0],
    finalize,
  );
  return { signIn, finalize, flow };
}
it("resends by restarting an expired attempt and clearing old input", async () => {
  const { signIn, flow } = setup();
  await flow.resend();
  expect(signIn.reset).toHaveBeenCalledOnce();
  expect(signIn.create).toHaveBeenCalledOnce();
  expect(signIn.emailCode.sendCode).toHaveBeenCalledOnce();
  expect(state.values).toEqual(["code", "", ""]);
});
it("propagates email failures without advancing to the next screen", async () => {
  const { signIn, flow } = setup();
  signIn.emailCode.sendCode.mockResolvedValueOnce({ error: new Error("send") });
  await expect(flow.request()).rejects.toThrow("send");
  expect(state.values[0]).toBe("idle");
});
it("does not finalize unsuccessful verification", async () => {
  const { signIn, finalize, flow } = setup();
  signIn.emailCode.verifyCode.mockResolvedValueOnce({
    error: new Error("numbers"),
  });
  await expect(flow.verify()).rejects.toThrow("numbers");
  expect(finalize).not.toHaveBeenCalled();
});
it("finalizes verified sign-in and surfaces finishing failures", async () => {
  const { finalize, flow } = setup();
  finalize.mockRejectedValueOnce(new Error("finishFailed"));
  await expect(flow.verify()).rejects.toThrow("finishFailed");
});
