import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DB_NAME, __resetDbForTests } from "../../db";
import {
  applyServerPreferences,
  clearPreferences,
  markFieldDirty,
  markFieldsClean,
  readPreferences,
} from "./storage";

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

describe("preferences storage", () => {
  it("returns empty defaults when no row exists", async () => {
    const out = await readPreferences();
    expect(out.values).toEqual({});
    expect(out.dirtyFields).toEqual([]);
    expect(out.serverUpdatedAt).toBeNull();
  });

  it("markFieldDirty adds the field to dirtyFields and stamps the value", async () => {
    await markFieldDirty("theme", "dark");
    const out = await readPreferences();
    expect(out.values).toEqual({ theme: "dark" });
    expect(out.dirtyFields).toEqual(["theme"]);
  });

  it("markFieldDirty is idempotent — same field listed at most once", async () => {
    await markFieldDirty("theme", "dark");
    await markFieldDirty("theme", "sepia");
    const out = await readPreferences();
    expect(out.values).toEqual({ theme: "sepia" });
    expect(out.dirtyFields).toEqual(["theme"]);
  });

  it("applyServerPreferences preserves locally-dirty fields", async () => {
    await markFieldDirty("theme", "dark");
    await applyServerPreferences({ theme: "light", fontScale: 1.2 });
    const out = await readPreferences();
    expect(out.values.theme).toBe("dark"); // dirty local value wins
    expect(out.values.fontScale).toBe(1.2); // server value applied
    expect(out.dirtyFields).toEqual(["theme"]);
  });

  it("markFieldsClean strips synced fields from the dirty list", async () => {
    await markFieldDirty("theme", "dark");
    await markFieldDirty("fontScale", 1.2);
    await markFieldsClean(["theme"]);
    const out = await readPreferences();
    expect(out.dirtyFields).toEqual(["fontScale"]);
    // Values stay intact.
    expect(out.values.theme).toBe("dark");
    expect(out.values.fontScale).toBe(1.2);
  });

  it("markFieldsClean is a no-op when fields list is empty", async () => {
    await markFieldDirty("theme", "dark");
    await markFieldsClean([]);
    const out = await readPreferences();
    expect(out.dirtyFields).toEqual(["theme"]);
  });

  it("clearPreferences wipes the row", async () => {
    await markFieldDirty("theme", "dark");
    await clearPreferences();
    const out = await readPreferences();
    expect(out.values).toEqual({});
    expect(out.dirtyFields).toEqual([]);
  });

  it("applyServerPreferences stamps serverUpdatedAt", async () => {
    await applyServerPreferences({ theme: "light" });
    const out = await readPreferences();
    expect(out.serverUpdatedAt).not.toBeNull();
    // ISO timestamp shape.
    expect(typeof out.serverUpdatedAt).toBe("string");
    expect(out.serverUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("end-to-end: dirty → server snapshot → flush → clean state", async () => {
    // User changes theme locally.
    await markFieldDirty("theme", "dark");
    // Server snapshot arrives via a background GET (theme = "light").
    await applyServerPreferences({ theme: "light", fontScale: 1.0 });
    const mid = await readPreferences();
    // Server's theme is rejected because theme is dirty.
    expect(mid.values.theme).toBe("dark");
    expect(mid.values.fontScale).toBe(1.0);
    expect(mid.dirtyFields).toEqual(["theme"]);
    // Sync runner PATCHes theme=dark → server accepts → cleanse local dirty.
    await markFieldsClean(["theme"]);
    const out = await readPreferences();
    expect(out.dirtyFields).toEqual([]);
    expect(out.values.theme).toBe("dark");
  });
});
