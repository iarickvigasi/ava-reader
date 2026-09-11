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
import { getDb } from "../../db";
import { membershipGeneration } from "./membership/bucket";

import {
  hydrateBookInfo,
  hydrateCollection,
  hydrateFromPayload,
} from "./bucket";

type GetToken = () => Promise<string | null>;

async function fetchJson<T>(
  path: string,
  getToken: GetToken,
  onNotFound?: () => void,
): Promise<T | null> {
  const db = getDb();
  const generation = membershipGeneration();
  const token = await getToken();
  if (!token) {
    return null;
  }
  try {
    const response = await fetch(`${getPublicApiBaseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      // A cache miss alone cannot distinguish an unknown URL from offline.
      // Only a current, explicit API 404 confirms that the resource is absent.
      if (
        response.status === 404 &&
        db === getDb() &&
        generation === membershipGeneration()
      ) {
        onNotFound?.();
      }
      return null;
    }
    const payload = (await response.json()) as T;
    return db === getDb() && generation === membershipGeneration() ? payload : null;
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
  onNotFound?: () => void,
): Promise<void> {
  const payload = await fetchJson<LibraryCollectionPayload>(
    `/api/library/collections/${encodeURIComponent(slug)}`,
    getToken,
    onNotFound,
  );
  if (!payload) {
    return;
  }
  await hydrateCollection(payload.collection);
}

export async function revalidateBookInfo(
  slug: string,
  getToken: GetToken,
  onNotFound?: () => void,
): Promise<void> {
  const payload = await fetchJson<LibraryBookInfoPayload>(
    `/api/library/${encodeURIComponent(slug)}`,
    getToken,
    onNotFound,
  );
  if (!payload) {
    return;
  }
  await hydrateBookInfo(payload.book);
}
