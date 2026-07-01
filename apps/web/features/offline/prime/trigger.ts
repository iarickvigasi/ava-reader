// Pure decision for the background primer's kick-off. The primer must run on
// the first online render AND again on every offline→online transition — a save
// requested while disconnected has to download once the connection returns,
// even though that happens long after the initial page load. Both cases reduce
// to "we just became online": `wasOnline` starts false, so the first online
// render is itself treated as a transition.
export function shouldKickPrimer(s: {
  isLoaded: boolean;
  // Clerk reports `boolean | undefined` (undefined while auth is resolving);
  // an unresolved state is treated as "not ready", same as signed-out.
  isSignedIn: boolean | undefined;
  wasOnline: boolean;
  online: boolean;
}): boolean {
  return s.isLoaded && s.isSignedIn === true && s.online && !s.wasOnline;
}

type KickInputs = {
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  online: boolean;
};

// Pure reducer wrapping the `wasOnline` edge so the primer island doesn't have
// to manage the ref by hand. The subtlety it encodes: the edge (`lastOnline`)
// only advances once auth is READY. Clerk's `isLoaded` is false on the first
// render(s); if those pre-auth renders advanced the edge to `true`, the very
// first online transition would be consumed before the auth gate ever passes,
// and the cold-load kick would be lost — priming would then run only on a later
// reconnect. (That was the bug behind book-info details never caching offline.)
// While not ready, we return the edge unchanged and never kick.
export function reduceKick(
  lastOnline: boolean,
  s: KickInputs,
): { lastOnline: boolean; kick: boolean } {
  const ready = s.isLoaded && s.isSignedIn === true;
  if (!ready) {
    return { lastOnline, kick: false };
  }
  const kick = shouldKickPrimer({ ...s, wasOnline: lastOnline });
  return { lastOnline: s.online, kick };
}
