import type { ReaderLocator } from "@/lib/api-types/reader";
import type { RestoreIntent } from "../navigation";

export type ReaderModeRestoreInput = {
  isBilingual: boolean;
  libraryItemId: string;
  activeChapterId: string;
  restoreIntent: RestoreIntent | null;
  visibleLocator: ReaderLocator | null;
};

export type ReaderModeRestoreState = {
  isBilingual: boolean;
  libraryItemId: string;
  activeChapterId: string;
  parentRestoreKey: string | null;
  parentRestoreChapterId: string | null;
  cycle: number;
  latestLocator: ReaderLocator | null;
  override: RestoreIntent | null;
};
