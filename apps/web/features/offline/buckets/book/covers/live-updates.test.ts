import "fake-indexeddb/auto";
import { liveQuery } from "dexie";
import { afterEach, expect, it } from "vitest";
import { getDb } from "../../../db";
import { attachCoverBlob } from "./attach";
import { readCoverBlob } from "./read";
import { rememberCover, readWarmCover } from "../warm-cover";
import { cleanCoverTest, seedCoverItems } from "./testing";

afterEach(cleanCoverTest);

it("notifies mounted cover reads when a legacy cover is repaired", async () => {
  await seedCoverItems();
  await attachCoverBlob("lib-1", new Blob(["legacy"]));
  await getDb().bookCovers.update("lib-1", { verified: false });
  let first!: () => void;
  let repaired!: (text: string) => void;
  const ready = new Promise<void>((resolve) => {
    first = resolve;
  });
  const replacement = new Promise<string>((resolve) => {
    repaired = resolve;
  });
  const subscription = liveQuery(() => readCoverBlob("lib-1")).subscribe(
    (blob) => {
      void blob
        ?.text()
        .then((text) => (text === "legacy" ? first() : repaired(text)));
    },
  );
  try {
    await ready;
    await attachCoverBlob("lib-1", new Blob(["fresh"]));
    expect(await replacement).toBe("fresh");
  } finally {
    subscription.unsubscribe();
  }
});

it("invalidates warm artwork even when repair restores the original checksum", async () => {
  await seedCoverItems();
  await attachCoverBlob("lib-1", new Blob(["right"]));
  await getDb().bookCovers.update("lib-1", {
    bytes: new TextEncoder().encode("wrong").buffer,
  });
  rememberCover(
    "lib-1",
    { naturalWidth: 2, naturalHeight: 3 } as HTMLImageElement,
    "blob:wrong",
  );
  await attachCoverBlob("lib-1", new Blob(["right"]));
  expect(readWarmCover("lib-1")).toBeNull();
  expect(await (await readCoverBlob("lib-1"))!.text()).toBe("right");
});
