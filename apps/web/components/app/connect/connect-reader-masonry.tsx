"use client";

import type { PublishedReader } from "@/lib/api-types/published-reader";
import { useReaderMasonry } from "@/features/connect/use-reader-masonry";
import { ConnectReaderCard } from "./connect-reader-card";

export function ConnectReaderMasonry({
  readers,
}: {
  readers: PublishedReader[];
}) {
  const ref = useReaderMasonry(readers);
  return (
    <div
      ref={ref}
      className="relative grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-start gap-4"
    >
      {readers.map((reader) => (
        <ConnectReaderCard key={reader.id} reader={reader} />
      ))}
    </div>
  );
}
