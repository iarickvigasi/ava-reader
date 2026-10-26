import { getActiveUserId } from "@/features/offline/db";
import type { readReaderCover } from "@/features/offline/buckets/library";

type Cover = NonNullable<Awaited<ReturnType<typeof readReaderCover>>>;
type Opening = {
  href: string;
  source: string;
  cover: Cover;
  owner: string | null;
};
let opening: Opening | null = null;
const listeners = new Set<() => void>();

export function beginReaderOpeningCover(
  href: string,
  cover: Cover | null | undefined,
) {
  if (!cover) return;
  opening = {
    href,
    cover,
    source: window.location.pathname,
    owner: getActiveUserId(),
  };
  listeners.forEach((notify) => notify());
}

export function finishReaderOpeningCover() {
  if (!opening) return;
  opening = null;
  listeners.forEach((notify) => notify());
}

export function getReaderOpeningCover() {
  return opening?.owner === getActiveUserId() ? opening : null;
}

export function subscribeReaderOpeningCover(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}
