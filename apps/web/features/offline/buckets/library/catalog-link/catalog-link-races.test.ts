import { beforeEach, expect, it, vi } from "vitest";
import { getDb, setActiveUser } from "../../../db";
import { clearCatalogLinkRuntime, linkRuntime } from "./bucket";
import { setCatalogLink } from "./mutations";
import { flushCatalogLinks } from "./sync";
import { readLinks } from "./storage";
import { token, link, request } from "./link-test-fixture";
const network = vi.hoisted(() => ({ online: false }));
vi.mock("../../../net/net-state", () => ({
  isOnline: () => network.online,
  subscribeToNetworkState: () => () => {},
}));
beforeEach(() => {
  network.online = false;
});
it("does not let an earlier acknowledgment erase an unlink made while sending", async () => {
  await setCatalogLink("copy", link, token);
  await linkRuntime(token).pendingPersist;
  let resolve!: (response: Response) => void;
  let started!: () => void;
  const sending = new Promise<void>((done) => {
    started = done;
  });
  request
    .mockImplementationOnce(() => {
      started();
      return new Promise<Response>((done) => {
        resolve = done;
      });
    })
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ link: null, version: 2 })),
    );
  network.online = true;
  const flush = flushCatalogLinks(token);
  await sending;
  await setCatalogLink("copy", null, token);
  await linkRuntime(token).pendingPersist;
  resolve(new Response(JSON.stringify({ link, version: 1 })));
  await flush;
  expect(request).toHaveBeenCalledTimes(2);
  const second = request.mock.calls[1] as [string, { body: string }];
  expect(JSON.parse(second[1].body)).toMatchObject({
    version: 1,
    workId: null,
  });
  expect(linkRuntime(token).records.get("copy")).toMatchObject({
    snapshot: null,
    pending: null,
  });
});
it("ignores responses arriving after an account switch", async () => {
  await setCatalogLink("copy", link, token);
  await linkRuntime(token).pendingPersist;
  let resolve!: (response: Response) => void;
  let started!: () => void;
  const sending = new Promise<void>((done) => {
    started = done;
  });
  request.mockImplementationOnce(() => {
    started();
    return new Promise<Response>((done) => {
      resolve = done;
    });
  });
  network.online = true;
  const flush = flushCatalogLinks(token);
  await sending;
  clearCatalogLinkRuntime();
  setActiveUser("other");
  resolve(new Response(JSON.stringify({ link, version: 1 })));
  await flush;
  expect(await readLinks(getDb())).toEqual([]);
  setActiveUser("anonymous");
});
