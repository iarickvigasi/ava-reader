import { getDb, type AvaReaderDB } from "../../db";
import { PROFILE_KEY, type ProfileMutation, type ProfilePatch } from "./types";

export async function readProfileMutation(
  db = getDb(),
): Promise<ProfileMutation | null> {
  return (
    ((await db.meta.get(PROFILE_KEY))?.value as ProfileMutation | null) ?? null
  );
}

export async function persistProfilePatch(patch: ProfilePatch): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.meta, async () => {
    const pending = await readProfileMutation(db);
    await db.meta.put({
      key: PROFILE_KEY,
      value: {
        patch: { ...(pending?.error ? {} : pending?.patch), ...patch },
        revision: crypto.randomUUID(),
      },
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function settleProfileMutation(
  db: AvaReaderDB,
  revision: string,
  error = false,
) {
  await db.transaction("rw", db.meta, async () => {
    const current = await readProfileMutation(db);
    if (current?.revision !== revision) return;
    if (!error) await db.meta.delete(PROFILE_KEY);
    else
      await db.meta.put({
        key: PROFILE_KEY,
        value: { ...current, error: true },
        updatedAt: new Date().toISOString(),
      });
  });
}
