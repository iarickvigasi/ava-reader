import type { LoadClerkUIScriptOptions } from "@clerk/shared/loadClerkJsScript";

// Internal seams of @clerk/react 6, reached through useClerk(). Review on upgrades.
export type RecoverableClerk = {
  loaded: boolean;
  status?: string;
  publishableKey?: string;
  options?: Partial<LoadClerkUIScriptOptions>;
  getEntryChunks?: () => Promise<void>;
  getClerkUIEntryChunk?: () => Promise<unknown>;
};
