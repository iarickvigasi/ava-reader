export type SignedOutRedirectInput = {
  hasLocalAccount?: boolean;
  online: boolean;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
};

export function shouldRedirectToSignIn({
  hasLocalAccount = false,
  online,
  isLoaded,
  isSignedIn,
}: SignedOutRedirectInput): boolean {
  return !hasLocalAccount && online && isLoaded && isSignedIn === false;
}
