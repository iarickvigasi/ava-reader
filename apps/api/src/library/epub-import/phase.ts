import type { PrismaService } from '../../prisma/prisma.service';
import {
  startConversionWork,
  workEventTiming,
  workEventDetails,
} from '../pdf-import/reports/work-timing';
import { recordEpubEvent } from './diagnostics';
import { epubFailureCode } from './failure-code';
export type EpubPhase = <T>(
  stage: string,
  work: () => Promise<T>,
) => Promise<T>;
export function epubPhases(
  prisma: PrismaService,
  runId: string,
  fence: number,
  activation = false,
): EpubPhase {
  return async (stage, work) => {
    await recordEpubEvent(prisma, runId, {
      kind: 'STAGE_STARTED',
      stage,
      severity: 'INFO',
      attemptFence: fence,
      details: {},
      observedAt: new Date().toISOString(),
    });
    const finish = startConversionWork();
    try {
      const result = await work();
      const timing = finish();
      await recordEpubEvent(prisma, runId, {
        kind: 'STAGE_ENDED',
        stage,
        severity: 'INFO',
        attemptFence: fence,
        ...workEventTiming(timing),
        details: { ...workEventDetails(timing), outcome: 'COMPLETED' },
      });
      return result;
    } catch (error) {
      const timing = finish(),
        code = epubFailureCode(error, activation);
      await recordEpubEvent(prisma, runId, {
        kind: 'STAGE_ENDED',
        stage,
        severity: 'WARN',
        attemptFence: fence,
        code,
        ...workEventTiming(timing),
        details: {
          ...workEventDetails(timing),
          outcome: 'FAILED',
          failureCode: code,
        },
      });
      throw error;
    }
  };
}
