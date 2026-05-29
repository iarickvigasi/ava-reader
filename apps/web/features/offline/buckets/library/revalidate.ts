// Client-side revalidation of the library / a single collection. Used by the
// client islands on /app/library and /app/library/collections/[slug] to
// refresh the offline cache once the page has hydrated, and on every
// transition back to online.

import type {
  LibraryBookInfoPayload,
  LibraryCollectionPayload,
  LibraryPayload,
} from "@/lib/api-types/library";

import { getPublicApiBaseUrl } from "@/lib/api";

import {
  hydrateBookInfo,
  hydrateCollection,
  hydrateFromPayload,
} from "./bucket";

type GetToken = () => Promise<string | null>;

async function fetchJson<T>(
  path: string,
  getToken: GetToken,
): Promise<T | null> {
  const token = await getToken();
  if (!token) {
    return null;
  }
  try {
    const response = await fetch(`${getPublicApiBaseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    // Network blip → caller already has whatever Dexie cached. The next
    // online/visibility tick will try again.
    return null;
  }
}

export async function revalidateLibrary(getToken: GetToken): Promise<void> {
  const payload = await fetchJson<LibraryPayload>("/api/library", getToken);
  if (!payload) {
    return;
  }
  await hydrateFromPayload(payload);
}

export async function revalidateCollection(
  slug: string,
  getToken: GetToken,
): Promise<void> {
  const payload = await fetchJson<LibraryCollectionPayload>(
    `/api/library/collections/${encodeURIComponent(slug)}`,
    getToken,
  );
  if (!payload) {
    return;
  }
  await hydrateCollection(payload.collection);
}

export async function revalidateBookInfo(
  slug: string,
  getToken: GetToken,
): Promise<void> {
  // Always use the full payload endpoint here — the details-delta endpoint
  // assumes we already have card hints from the originating list. A
  // background revalidation doesn't have that context.
  const payload = await fetchJson<LibraryBookInfoPayload>(
    `/api/library/${encodeURIComponent(slug)}`,
    getToken,
  );
  if (!payload) {
    return;
  }
  await hydrateBookInfo(payload.book);
}
