export type OnlineAuthState =
  | "restoring"
  | "authenticated"
  | "unavailable"
  | "sign-in-required";

export function resolveAuthState(input: {
  online: boolean;
  loaded: boolean;
  status?: string;
  signedIn: boolean | undefined;
}): OnlineAuthState {
  if (!input.online || input.status === "error" || input.status === "degraded")
    return "unavailable";
  if (!input.loaded || input.signedIn === undefined) return "restoring";
  return input.signedIn ? "authenticated" : "sign-in-required";
}
