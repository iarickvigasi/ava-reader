import type { PublishedReader } from "@/lib/api-types/published-reader";
import { readCurrentReadingBook } from "../me/read-current-reading-book";
import { readCurrentUser } from "../me/storage";
import { readReadersSnapshot } from "./storage";

export async function readReaderDiscovery(): Promise<PublishedReader[] | null> {
  const [snapshot, user, book] = await Promise.all([
    readReadersSnapshot(),
    readCurrentUser(),
    readCurrentReadingBook(),
  ]);
  if (!user) return snapshot;
  const otherReaders = (snapshot ?? []).filter(
    (reader) => reader.id !== user.id,
  );
  if (!user.profilePublished) return otherReaders;
  return [
    {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      introduction: user.introduction ?? "",
      currentBook:
        user.shareCurrentBook && book
          ? { title: book.title, authors: book.authors ?? [] }
          : null,
    },
    ...otherReaders,
  ];
}
