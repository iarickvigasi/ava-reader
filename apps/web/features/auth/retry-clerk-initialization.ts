import { clerkUIScriptUrl } from "@clerk/shared/loadClerkJsScript";
import type { RecoverableClerk } from "./clerk-recovery-types";

const UI_LOAD_ERROR = "failed_to_load_clerk_ui";
const RECOVERY_QUERY = "ava_clerk_retry";

export async function retryClerkInitialization(clerk: RecoverableClerk) {
  await recoverUiScript(clerk);
  await clerk.getEntryChunks();
}

async function recoverUiScript(clerk: RecoverableClerk) {
  try {
    await clerk.getClerkUIEntryChunk();
  } catch (error) {
    if (!isUiLoadError(error)) throw error;
    await retryFreshUiScript(clerk);
  }
}

async function retryFreshUiScript(clerk: RecoverableClerk) {
  const options = clerk.options;
  const publishableKey = clerk.publishableKey ?? options.publishableKey;
  if (!publishableKey)
    throw new Error("Clerk recovery requires a publishable key");
  const original = options.__internal_clerkUIUrl;
  // Let Clerk select the host, proxy path and UI version; never pin a runtime asset.
  const url = new URL(
    clerkUIScriptUrl({ ...options, publishableKey }),
    window.location.href,
  );
  url.searchParams.set(RECOVERY_QUERY, String(Date.now()));
  options.__internal_clerkUIUrl = url.href;
  try {
    await clerk.getClerkUIEntryChunk();
  } finally {
    if (original === undefined) delete options.__internal_clerkUIUrl;
    else options.__internal_clerkUIUrl = original;
  }
}

function isUiLoadError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === UI_LOAD_ERROR
  );
}
