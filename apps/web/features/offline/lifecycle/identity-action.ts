// Pure decision for the offline identity reconciler (adr/5, spec 4.7): given the
// device's last active user and the user Clerk currently reports, decide what
// should happen to the offline data.

export type IdentityAction =
  | { kind: "none" }
  | { kind: "adopt"; userId: string };

export function decideIdentityAction(
  previousUserId: string | null,
  currentUserId: string | null,
): IdentityAction {
  if (!currentUserId) {
    // Expiry/revocation pauses sync; only explicit sign-out wipes local data.
    return { kind: "none" };
  }
  if (previousUserId === currentUserId) {
    // Same user reload — nothing to do.
    return { kind: "none" };
  }
  // Account switch (A→B) or a cold start with no / a different marker. We can't
  // tell a first-ever login from "B opened the app after A never signed out",
  // so the safe action is to adopt B and purge everyone else.
  return { kind: "adopt", userId: currentUserId };
}
