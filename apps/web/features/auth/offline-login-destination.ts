export function offlineLoginDestination(input: {
  online: boolean;
  owner: string | null;
  signedOut: boolean;
}) {
  return !input.online && input.owner && !input.signedOut ? "/app" : null;
}
