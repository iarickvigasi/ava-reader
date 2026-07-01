// Asks the active service worker to precache a set of route shells (doc + RSC)
// and waits for its completion ack, so the caller can tell whether offline
// browsing is genuinely ready (see [[14-route-precaching]]). The SW owns the
// fetching + cache keys; this is just the client-side hand-off + confirmation.

export type PrecacheRoutesMessage = {
  type: "PRECACHE_ROUTES";
  routes: string[];
};

export type RoutePrecacheResult = {
  // True when every requested route's shell is cached — offline browsing is
  // ready. (`null`, not this type, is returned when we couldn't ask the SW.)
  complete: boolean;
};

// Safety valve: the SW always replies, but if it somehow doesn't (killed
// mid-pass), resolve unconfirmed so the runner retries on the next reconnect
// rather than hanging forever.
const ACK_TIMEOUT_MS = 15_000;

export async function requestRoutePrecache(
  routes: string[],
): Promise<RoutePrecacheResult | null> {
  if (routes.length === 0) {
    return { complete: true };
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  const registration = await navigator.serviceWorker.ready;
  const active = registration.active;
  if (!active) {
    return null;
  }
  return new Promise<RoutePrecacheResult | null>((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (result: RoutePrecacheResult | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      channel.port1.close();
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), ACK_TIMEOUT_MS);
    channel.port1.onmessage = (event) => {
      const cached = Array.isArray(event.data?.cached)
        ? (event.data.cached as string[])
        : [];
      finish({ complete: routes.every((route) => cached.includes(route)) });
    };
    active.postMessage(
      { type: "PRECACHE_ROUTES", routes } satisfies PrecacheRoutesMessage,
      [channel.port2],
    );
  });
}
