// Asks the active service worker to precache a set of route shells (doc + RSC)
// so they load offline on hard reload / direct URL (see [[14-route-precaching]]).
// The SW owns the fetching + cache keys; this is just the client-side hand-off.

export type PrecacheRoutesMessage = {
  type: "PRECACHE_ROUTES";
  routes: string[];
};

export async function requestRoutePrecache(routes: string[]): Promise<void> {
  if (routes.length === 0) {
    return;
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({
    type: "PRECACHE_ROUTES",
    routes,
  } satisfies PrecacheRoutesMessage);
}
