import { vi } from "vitest";
import type { useCollectionPicker } from "@/features/library/collection-picker/use-collection-picker";

export function createPicker(overrides: Partial<ReturnType<typeof useCollectionPicker>> = {}) {
  return {
    collections: [], loading: false, unavailable: false, online: true,
    retry: vi.fn(), close: vi.fn(), toggle: vi.fn(), save: vi.fn(),
    pending: false, error: null, selectedIds: new Set<string>(), dirty: false,
    selectedCount: 0, ...overrides,
  } satisfies ReturnType<typeof useCollectionPicker>;
}
