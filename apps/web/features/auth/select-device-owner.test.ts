import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  owner: "a",
  finish: () => {},
  adopts: [] as string[],
}));
vi.mock("@/features/offline/db", () => ({
  getActiveUserId: () => state.owner,
}));
vi.mock("@/features/offline/lifecycle/clear-all-user-data", () => ({
  adoptUser: async (userId: string) => {
    state.adopts.push(userId);
    state.owner = userId;
    await new Promise<void>((resolve) => {
      state.finish = resolve;
    });
  },
}));
import { selectDeviceOwner } from "./select-device-owner";
it("waits for adoption cleanup even if the active marker already changed", async () => {
  const first = selectDeviceOwner("b");
  await vi.waitFor(() => expect(state.owner).toBe("b"));
  const ready = vi.fn();
  const second = selectDeviceOwner("b").then(ready);
  await Promise.resolve();
  expect(ready).not.toHaveBeenCalled();
  state.finish();
  await Promise.all([first, second]);
  expect(state.adopts).toEqual(["b"]);
  expect(ready).toHaveBeenCalledOnce();
});
it("session expiry keeps the last local owner", async () => {
  await selectDeviceOwner(null);
  expect(state.owner).toBe("b");
  expect(state.adopts).toEqual(["b"]);
});
