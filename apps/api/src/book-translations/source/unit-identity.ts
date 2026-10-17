import { createHash } from 'node:crypto';
import type { BilingualUnit } from '../types';
export function identifyTranslationUnit(
  unit: Omit<BilingualUnit, 'id'>,
  chapterId: string,
  revision: string,
): BilingualUnit {
  const id = createHash('sha256')
    .update(JSON.stringify([revision, chapterId, unit]))
    .digest('hex');
  return { id, ...unit };
}
