import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  owner: "a",
  wipe: vi.fn(async () => {}),
  mark: vi.fn(),
}));
vi.mock("@/features/offline/db", () => ({
  getActiveUserId: () => state.owner,
}));
vi.mock("@/features/offline/lifecycle/clear-all-user-data", () => ({
  wipeUserData: state.wipe,
}));
vi.mock("./local-sign-out", () => ({
  readSignOutIntent: () => ({ userId: "a", sessionId: "old" }),
  isLocallySignedOut: (user: string, session: string) =>
    user === "a" && (!session || session === "old"),
  markSignedOut: state.mark,
}));
import { finishDeviceSignOut } from "./finish-device-sign-out";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("navigator", { onLine: true });
});
function clerk(session: string, user = "a") {
  return {
    loaded: true,
    user: { id: user },
    session: { id: session },
    signOut: vi.fn(async () => {}),
  };
}
it("retained sign-out intent never wipes a newly authenticated same-account session", async () => {
  const current = clerk("new");
  await finishDeviceSignOut(
    current as unknown as Parameters<typeof finishDeviceSignOut>[0],
  );
  expect(state.wipe).not.toHaveBeenCalled();
  expect(current.signOut).not.toHaveBeenCalled();
});
it("clears local access offline without attempting server revocation", async () => {
  vi.stubGlobal("navigator", { onLine: false });
  const current = clerk("old");
  await finishDeviceSignOut(
    current as unknown as Parameters<typeof finishDeviceSignOut>[0],
  );
  expect(state.wipe).toHaveBeenCalledWith("a");
  expect(current.signOut).not.toHaveBeenCalled();
});
it("revokes only the targeted session when connectivity returns", async () => {
  const current = clerk("old");
  await finishDeviceSignOut(
    current as unknown as Parameters<typeof finishDeviceSignOut>[0],
  );
  expect(current.signOut).toHaveBeenCalledWith({ sessionId: "old" });
});
it("does not sign out an account activated during local cleanup", async () => {
  const current = clerk("old");
  state.wipe.mockImplementationOnce(async () => {
    current.user.id = "b";
    current.session.id = "new";
  });
  await finishDeviceSignOut(
    current as unknown as Parameters<typeof finishDeviceSignOut>[0],
  );
  expect(current.signOut).not.toHaveBeenCalled();
});
