// The decision for the client-side signed-out guard (10-auth spec, Behaviour
// 4). Redirect only when the signal is trustworthy: the device is online AND
// clerk-js has fully loaded AND it reports signed-out. Offline (or while
// Clerk is still loading / unreachable) we must keep serving the cached
// shell — the user cannot complete a login without a connection.

export type SignedOutRedirectInput = {
  online: boolean;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
};

export function shouldRedirectToSignIn({
  online,
  isLoaded,
  isSignedIn,
}: SignedOutRedirectInput): boolean {
  return online && isLoaded && isSignedIn === false;
}
