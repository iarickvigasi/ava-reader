import type { LoadClerkUIScriptOptions } from "@clerk/shared/loadClerkJsScript";
export type ClerkRecoverySource = { loaded: boolean; status?: string };

// Validated internal seams of @clerk/react 6. Review the adapter on SDK upgrades.
export type RecoverableClerk = ClerkRecoverySource & {
  publishableKey?: string;
  options: Partial<LoadClerkUIScriptOptions>;
  getEntryChunks: () => Promise<void>;
  getClerkUIEntryChunk: () => Promise<unknown>;
};
