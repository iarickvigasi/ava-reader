import { expect, it, vi } from "vitest";
import { clerkRecoveryAdapter } from "./clerk-recovery-adapter";

it("rejects unsupported SDK capabilities instead of silently skipping initialization", () => {
  const base = {
    loaded: false,
    options: { publishableKey: "key" },
    getEntryChunks: vi.fn(),
    getClerkUIEntryChunk: vi.fn(),
  };
  expect(clerkRecoveryAdapter(base)).toBe(base);
  expect(
    clerkRecoveryAdapter({ ...base, getEntryChunks: undefined }),
  ).toBeNull();
  expect(
    clerkRecoveryAdapter({ ...base, getClerkUIEntryChunk: undefined }),
  ).toBeNull();
  expect(clerkRecoveryAdapter({ ...base, options: undefined })).toBeNull();
  expect(clerkRecoveryAdapter({ ...base, options: {} })).toBeNull();
});
