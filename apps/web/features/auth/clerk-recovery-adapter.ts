import type {
  ClerkRecoverySource,
  RecoverableClerk,
} from "./clerk-recovery-types";

export function clerkRecoveryAdapter<T extends ClerkRecoverySource>(
  clerk: T,
): RecoverableClerk | null {
  const options: unknown = Reflect.get(clerk, "options");
  if (
    !options ||
    typeof options !== "object" ||
    typeof Reflect.get(clerk, "getEntryChunks") !== "function" ||
    typeof Reflect.get(clerk, "getClerkUIEntryChunk") !== "function"
  )
    return null;
  const key: unknown =
    Reflect.get(clerk, "publishableKey") ??
    Reflect.get(options, "publishableKey");
  if (typeof key !== "string" || !key) return null;
  // This is the sole SDK cast; internal helpers require the checked capabilities.
  return clerk as unknown as RecoverableClerk;
}
