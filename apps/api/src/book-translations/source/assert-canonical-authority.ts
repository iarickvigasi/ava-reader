import { ConflictException } from '@nestjs/common';
import type { EpubAuthorityStore } from '../../library/epub-import/authority';
import type { TranslationContext } from '../types';
import { assertCanonicalContentAuthority } from '../../reader/canonical/content-authority';
export async function assertCanonicalTranslationAuthority(
  tx: EpubAuthorityStore,
  context: TranslationContext,
) {
  const authority = context.canonicalAuthority;
  if (!authority) return;
  if (authority.finalContentId !== context.contentRevision)
    throw new ConflictException('Translation source changed.');
  await assertCanonicalContentAuthority(
    tx,
    context.userId,
    context.libraryItemId,
    authority,
    authority,
  );
}
