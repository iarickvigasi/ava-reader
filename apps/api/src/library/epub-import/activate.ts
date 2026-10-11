import type { PrismaService } from '../../prisma/prisma.service';
import type { SemanticValidator } from '../../pdf-conversion/contracts/types';
import { validateContract } from '../../pdf-conversion/contracts/validate-contract';
import { checksumBuffer } from '../../shared/blob-utils';
import { requireReaderQualification } from '../pdf-import/publication/qualification';
import { activateImportedRecord } from './activate-record';
import { epubFailureCode, permanentEpubFailure } from './failure-code';
import { epubPhases } from './phase';
import { recordEpubEvent } from './diagnostics';
import { refusePreparedEpub } from './refuse-prepared';
import {
  activationCandidates,
  advanceActivationCursor,
} from './activation-candidates';
export async function activateCanonicalEpub(
  prisma: PrismaService,
  semantic: SemanticValidator,
  qualificationId = process.env.AVA_EPUB_READER_QUALIFICATION_ID ??
    process.env.AVA_PDF_READER_QUALIFICATION_ID,
) {
  for (const candidate of await activationCandidates(prisma)) {
    advanceActivationCursor(prisma, candidate);
    const record = await prisma.canonicalEpubImport
      .findUniqueOrThrow({
        where: { id: candidate.id },
        include: { readerFile: { include: { blob: true } } },
      })
      .catch(async () => {
        await recordEpubEvent(prisma, candidate.runId, {
          kind: 'STAGE_ENDED',
          stage: 'EPUB_ACTIVATION',
          severity: 'WARN',
          code: 'PREPARED_RECORD_UNAVAILABLE',
          attemptFence: candidate.fence,
          details: { outcome: 'UNOBSERVED' },
        });
        return null;
      });
    if (!record) continue;
    try {
      const activated = await epubPhases(
        prisma,
        candidate.runId,
        candidate.fence,
        true,
      )('EPUB_ACTIVATION', async () => {
        if (!qualificationId) throw new Error('EPUB_ACTIVATION_NOT_CONFIGURED');
        await requireReaderQualification(prisma, qualificationId, []);
        const bytes = Buffer.from(record.readerFile.blob.bytes);
        if (checksumBuffer(bytes) !== record.readerSha256)
          throw new Error('EPUB_IMPORT_CONTENT_CHANGED');
        const reader = await validateContract('ava-reader-3', bytes, semantic);
        await requireReaderQualification(
          prisma,
          qualificationId,
          reader.required_capabilities,
        );
        return activateImportedRecord(prisma, record, reader, qualificationId);
      });
      if (activated) {
        await recordEpubEvent(prisma, candidate.runId, {
          kind: 'PUBLISHED',
          attemptFence: candidate.fence,
          stage: 'EPUB_ACTIVATION',
          severity: 'INFO',
          details: { finalContentId: record.finalContentId },
        });
        return true;
      }
    } catch (error) {
      const code = epubFailureCode(error, true);
      const expired =
        !['READER_NOT_QUALIFIED', 'ACTIVATION_NOT_CONFIGURED'].includes(code) &&
        Boolean(
          candidate.deadlineAt && candidate.deadlineAt <= candidate.observedAt,
        );
      if (permanentEpubFailure(error) || expired) {
        const refused = await refusePreparedEpub(
          prisma,
          record,
          candidate.runId,
          candidate.fence,
          expired && !permanentEpubFailure(error),
        ).catch(() => false);
        if (refused)
          await recordEpubEvent(prisma, candidate.runId, {
            kind: 'FAILED',
            stage: 'EPUB_ACTIVATION',
            severity: 'ERROR',
            code: permanentEpubFailure(error)
              ? code
              : 'ACTIVE_DEADLINE_EXPIRED',
            attemptFence: candidate.fence,
            details: { outcome: 'FAILED' },
          });
      }
    }
  }
  return false;
}
