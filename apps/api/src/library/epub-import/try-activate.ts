import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SemanticValidator } from '../../pdf-conversion/contracts/types';
import { activateCanonicalEpub } from './activate';
const logger = new Logger('EpubActivation');
export async function tryActivateCanonicalEpub(
  prisma: PrismaService,
  semantic: SemanticValidator,
) {
  try {
    return await activateCanonicalEpub(prisma, semantic);
  } catch {
    logger.warn('EPUB_ACTIVATION_SCAN_UNAVAILABLE');
    return false;
  }
}
