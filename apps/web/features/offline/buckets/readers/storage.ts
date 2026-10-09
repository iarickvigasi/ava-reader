import type { PublishedReader } from "@/lib/api-types/published-reader";
import { getDb } from "../../db";

const KEY = "connect:readers";

export async function readReadersSnapshot(): Promise<PublishedReader[] | null> {
  const row = await getDb().meta.get(KEY);
  return (row?.value as PublishedReader[] | undefined) ?? null;
}

export async function writeReadersSnapshot(
  readers: PublishedReader[],
): Promise<void> {
  await getDb().meta.put({
    key: KEY,
    value: readers,
    updatedAt: new Date().toISOString(),
  });
}
