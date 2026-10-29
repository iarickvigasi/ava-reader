import { beforeEach, expect, it, vi } from "vitest";
import { getDb } from "../../../db";
import { clearCatalogLinkRuntime, hydrateLinks, linkRuntime } from "./bucket";
import { setCatalogLink } from "./mutations";
import { flushCatalogLinks } from "./sync";
import { selectedCatalogLink } from "./selectors";
import { writeLink, readLinks } from "./storage";
import { token, link, request } from "./link-test-fixture";
const network = vi.hoisted(() => ({ online: false }));
vi.mock("../../../net/net-state", () => ({
  isOnline: () => network.online,
  subscribeToNetworkState: () => () => {},
}));
beforeEach(() => {
  network.online = false;
});
it("coalesces offline link/unlink intent, survives runtime restart, and preserves unrelated reading data", async () => {
  await getDb().meta.put({
    key: "progress-proof",
    value: { locator: "unchanged" },
    updatedAt: "",
  });
  await setCatalogLink("copy", link, token);
  await setCatalogLink("copy", null, token);
  await linkRuntime(token).pendingPersist;
  clearCatalogLinkRuntime();
  const runtime = linkRuntime(token);
  await hydrateLinks(runtime);
  expect(selectedCatalogLink(runtime.records.get("copy")!)).toBeNull();
  expect(runtime.records.get("copy")!.pending).not.toBeNull();
  expect(await readLinks(getDb())).toHaveLength(1);
  expect((await getDb().meta.get("progress-proof"))?.value).toEqual({
    locator: "unchanged",
  });
  expect(request).not.toHaveBeenCalled();
});
it("restores the previous accepted link and records an error after permanent rejection", async () => {
  await writeLink(getDb(), "copy", {
    snapshot: link,
    pending: null,
    error: "",
  });
  await setCatalogLink("copy", null, token);
  await linkRuntime(token).pendingPersist;
  request.mockResolvedValue(new Response("{}", { status: 400 }));
  network.online = true;
  await flushCatalogLinks(token);
  const state = linkRuntime(token).records.get("copy")!;
  expect(selectedCatalogLink(state)).toEqual(link);
  expect(state.pending).toBeNull();
  expect(state.error).toContain("previous link");
});
it("retains a pending intent after transient server failure", async () => {
  await setCatalogLink("copy", link, token);
  await linkRuntime(token).pendingPersist;
  request.mockResolvedValue(new Response("{}", { status: 503 }));
  network.online = true;
  await flushCatalogLinks(token);
  expect(linkRuntime(token).records.get("copy")!.pending).not.toBeNull();
});
