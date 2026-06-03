import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { HomePayload } from "@/lib/api-types/home";

import { DB_NAME, __resetDbForTests } from "../../db";
import { applyHome, clearHome, readHome } from "./storage";

// The storage layer treats the payload as opaque (it stores/reads it as-is),
// so a minimal stand-in is enough to exercise the round-trip. Cast keeps the
// test decoupled from the full, evolving HomePayload shape.
const home = {
  state: "EMPTY",
  featuredCatalog: { entries: [] },
} as unknown as HomePayload;

beforeEach(() => {
  __resetDbForTests();
});

afterEach(async () => {
  __resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe("home bucket storage", () => {
  it("returns null before any payload is cached", async () => {
    expect(await readHome()).toBeNull();
  });

  it("round-trips the home payload", async () => {
    await applyHome(home);
    expect(await readHome()).toEqual(home);
  });

  it("overwrites the single row on re-apply", async () => {
    await applyHome(home);
    const next = { ...home, state: "POPULATED" } as unknown as HomePayload;
    await applyHome(next);
    expect(await readHome()).toEqual(next);
  });

  it("clears the cached payload", async () => {
    await applyHome(home);
    await clearHome();
    expect(await readHome()).toBeNull();
  });
});
