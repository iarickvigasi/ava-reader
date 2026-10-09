import { getDb, type AvaReaderDB } from "../../db";
import {
  CONNECT_DRAFT_KEY,
  type ConnectDraft,
  type ProfilePatch,
} from "./types";

export async function readConnectDraft(): Promise<ConnectDraft | null> {
  return (
    ((await getDb().meta.get(CONNECT_DRAFT_KEY))?.value as ConnectDraft) ?? null
  );
}

export async function persistConnectDraft(draft: ConnectDraft): Promise<void> {
  await getDb().meta.put({
    key: CONNECT_DRAFT_KEY,
    value: draft,
    updatedAt: new Date().toISOString(),
  });
}

export async function settleConnectDraft(db: AvaReaderDB, patch: ProfilePatch) {
  if (patch.introduction === undefined || patch.shareCurrentBook === undefined)
    return;
  await db.transaction("rw", db.meta, async () => {
    const draft = (await db.meta.get(CONNECT_DRAFT_KEY))?.value as
      | ConnectDraft
      | undefined;
    if (
      draft &&
      draft.introduction.trim() === patch.introduction &&
      draft.shareCurrentBook === patch.shareCurrentBook
    )
      await db.meta.delete(CONNECT_DRAFT_KEY);
  });
}
