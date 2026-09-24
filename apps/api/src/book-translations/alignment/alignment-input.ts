import type { rowsFor } from './alignment-storage';
import type { AlignmentToken } from './alignment-tokens';

export type AlignmentInput = Awaited<ReturnType<typeof rowsFor>>[number] & {
  source: AlignmentToken[];
  translation: AlignmentToken[];
};
