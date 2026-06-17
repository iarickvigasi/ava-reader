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
