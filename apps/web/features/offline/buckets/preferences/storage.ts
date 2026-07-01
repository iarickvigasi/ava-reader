// Dexie I/O for the single-row preferences cache.
//
// The PreferencesRow tracks both `values` (the full payload we believe the
// server has) and `dirtyFields` (field names with local edits that haven't
// been PATCHed yet). On a server snapshot apply, fields listed in
// `dirtyFields` are NOT overwritten — local intent wins until the PATCH
// succeeds.

import { getDb } from "../../db";

export type PreferencesValues = Record<string, unknown>;

export type ReadPreferencesResult = {
  values: PreferencesValues;
  dirtyFields: string[];
  serverUpdatedAt: string | null;
};

const EMPTY: ReadPreferencesResult = {
  values: {},
  dirtyFields: [],
  serverUpdatedAt: null,
};

export async function readPreferences(): Promise<ReadPreferencesResult> {
  const db = getDb();
  const row = await db.preferences.get("me");
  if (!row) {
    return EMPTY;
  }
  return {
    values: row.values,
    dirtyFields: row.dirtyFields,
    serverUpdatedAt: row.serverUpdatedAt,
  };
}

// Replace `values` from a fresh server snapshot — but preserve any field
// the user has changed locally that hasn't synced yet. The dirty list
// itself is carried over untouched.
export async function applyServerPreferences(
  serverValues: PreferencesValues,
): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.preferences, async () => {
    const existing = await db.preferences.get("me");
    const dirty = existing?.dirtyFields ?? [];
    // For each non-dirty field, take the server value. Dirty fields stay
    // at whatever the user just set.
    const merged: PreferencesValues = { ...serverValues };
    for (const field of dirty) {
      if (existing && field in existing.values) {
        merged[field] = existing.values[field];
      }
    }
    await db.preferences.put({
      id: "me",
      values: merged,
      dirtyFields: dirty,
      serverUpdatedAt: new Date().toISOString(),
    });
  });
}

// Stamp a single field with the user's new local value and add it to the
// dirty list. Idempotent: re-stamping a field that's already dirty just
// updates its value.
export async function markFieldDirty(
  field: string,
  value: unknown,
): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.preferences, async () => {
    const existing =
      (await db.preferences.get("me")) ?? {
        id: "me" as const,
        values: {},
        dirtyFields: [],
        serverUpdatedAt: null,
      };
    const nextValues = { ...existing.values, [field]: value };
    const nextDirty = existing.dirtyFields.includes(field)
      ? existing.dirtyFields
      : [...existing.dirtyFields, field];
    await db.preferences.put({
      ...existing,
      values: nextValues,
      dirtyFields: nextDirty,
    });
  });
}

// Mark fields as clean after a successful PATCH. The PATCH may have
// touched a subset of the dirty list; only those are removed.
export async function markFieldsClean(fields: string[]): Promise<void> {
  if (fields.length === 0) {
    return;
  }
  const db = getDb();
  await db.transaction("rw", db.preferences, async () => {
    const existing = await db.preferences.get("me");
    if (!existing) {
      return;
    }
    const remaining = existing.dirtyFields.filter((f) => !fields.includes(f));
    await db.preferences.put({ ...existing, dirtyFields: remaining });
  });
}

export async function clearPreferences(): Promise<void> {
  const db = getDb();
  await db.preferences.clear();
}
