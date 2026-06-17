import type { OfflineState } from "@/features/offline/buckets/book";

// Which variant of the save-for-offline card to show. The whole point is that
// "queued" derives from the durable `offlineRequested` intent (+ no content
// cached yet), NOT from transient component state — so a request made offline
// still reads as queued after the user leaves the page and comes back.
export type OfflineCardKind =
  | "aborting" // tearing down a cancelled in-flight save
  | "downloading" // save in progress
  | "saved" // explicit save that began as an auto-save → release keeps content
  | "remove" // explicit save downloaded from scratch → delete frees space
  | "queued" // requested (intent) but not downloaded yet
  | "keep" // auto-cached, evictable → offer to make it sticky
  | "idle"; // nothing cached/requested, or still resolving

// First match wins — order matters (e.g. an in-flight download outranks a
// lingering queued intent; aborting outranks everything).
export function resolveOfflineCard(i: {
  aborting: boolean;
  isDownloading: boolean;
  offlineState: OfflineState | "loading";
  fromAutoSave: boolean;
  offlineRequested: boolean;
}): OfflineCardKind {
  if (i.aborting) {
    return "aborting";
  }
  if (i.isDownloading) {
    return "downloading";
  }
  if (i.offlineState === "explicit") {
    return i.fromAutoSave ? "saved" : "remove";
  }
  if (i.offlineRequested && i.offlineState === "absent") {
    return "queued";
  }
  if (i.offlineState === "auto") {
    return "keep";
  }
  return "idle";
}
