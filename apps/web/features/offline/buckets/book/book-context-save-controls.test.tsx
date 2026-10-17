import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { effectHost } from "./book-context-effect-host";
import {
  bookFixture,
  closeFixture,
  flushFixture,
  resetFixture,
} from "./book-context-test-fixture";
import { BookContextProvider } from "./context";
import { deferred } from "@/features/reader/canonical/resource-recovery-fixture";
beforeEach(resetFixture);
afterEach(closeFixture);
async function render() {
  effectHost.render(() =>
    BookContextProvider({ libraryItemId: "fixture-book", children: null }),
  );
  await flushFixture();
}
it("does not dispatch before an owner exists and starts once when the owner becomes available", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  bookFixture.ownerId = "";
  await render();
  await render();
  expect(fetcher).not.toHaveBeenCalled();
  bookFixture.ownerId = "fixture-owner";
  await render();
  await render();
  await render();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("effect replay and changing closures cannot duplicate an actual pending image/save request", async () => {
  const response = deferred<Response>(),
    dispatched = deferred<void>();
  const fetcher = vi.fn(() => {
    dispatched.resolve();
    return response.promise;
  });
  vi.stubGlobal("fetch", fetcher);
  await render();
  const first = render();
  await dispatched.promise;
  effectHost.replayMount();
  effectHost.render(() =>
    BookContextProvider({ libraryItemId: "fixture-book", children: null }),
  );
  effectHost.flush();
  expect(fetcher).toHaveBeenCalledTimes(1);
  response.resolve(new Response(null, { status: 503 }));
  await first;
  await flushFixture();
  await render();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(bookFixture.kinds).toEqual(["auto"]);
});
