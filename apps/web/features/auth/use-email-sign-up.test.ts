import { beforeEach, expect, it, vi } from "vitest";
const values = vi.hoisted(() => [] as unknown[]);
vi.mock("react", () => ({
  useState(value: unknown) {
    const index = values.length;
    values.push(value);
    return [
      value,
      (next: unknown) => {
        values[index] = next;
      },
    ];
  },
}));
import { useEmailSignUp } from "./use-email-sign-up";
beforeEach(() => {
  values.length = 0;
});

function account(status = "complete") {
  return {
    status,
    create: vi.fn(async () => ({ error: null as unknown })),
    verifications: {
      sendEmailCode: vi.fn(async () => ({ error: null })),
      verifyEmailCode: vi.fn(async () => ({ error: null })),
    },
  };
}

it("advances to verification only after the identifier and code request succeed", async () => {
  const signUp = account();
  const flow = useEmailSignUp(
    signUp as unknown as Parameters<typeof useEmailSignUp>[0],
    vi.fn(),
    vi.fn(),
  );
  await flow.request();
  expect(signUp.create).toHaveBeenCalledWith({ emailAddress: "" });
  expect(signUp.verifications.sendEmailCode).toHaveBeenCalledOnce();
  expect(values[0]).toBe("code");
});

it("keeps the email step when account creation fails", async () => {
  const signUp = account();
  signUp.create.mockResolvedValue({ error: new Error("invalid identifier") });
  const flow = useEmailSignUp(
    signUp as unknown as Parameters<typeof useEmailSignUp>[0],
    vi.fn(),
    vi.fn(),
  );
  await flow.request();
  expect(signUp.verifications.sendEmailCode).not.toHaveBeenCalled();
  expect(values[0]).toBe("idle");
});

it.each(["complete", "missing_requirements"])(
  "handles %s after code verification",
  async (status) => {
    const signUp = account(status);
    const finalize = vi.fn();
    const incomplete = vi.fn();
    const flow = useEmailSignUp(
      signUp as unknown as Parameters<typeof useEmailSignUp>[0],
      finalize,
      incomplete,
    );
    await flow.verify();
    expect(finalize).toHaveBeenCalledTimes(status === "complete" ? 1 : 0);
    expect(incomplete).toHaveBeenCalledTimes(status === "complete" ? 0 : 1);
  },
);
