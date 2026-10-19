"use client";
import type { ReactNode } from "react";
import { useOwnedCoverUrl } from "@/features/offline/buckets/book";
export function OwnedCoverSource({
  src,
  libraryItemId,
  children,
}: {
  src: string;
  libraryItemId: string | null;
  children: (src: string | null) => ReactNode;
}) {
  return children(useOwnedCoverUrl(libraryItemId, src));
}
