import { executeOne } from './execute-one';
import { claimPdfJob } from '../../library/pdf-import/jobs';
import type { PrismaService } from '../../prisma/prisma.service';
import { testConfig } from './config-fixture';
jest.mock('../../library/pdf-import/jobs', () => ({
  ...jest.requireActual<typeof import('../../library/pdf-import/jobs')>(
    '../../library/pdf-import/jobs',
  ),
  claimPdfJob: jest.fn(),
}));
it('refuses legacy fault canaries before claiming or mutating a real job', async () => {
  const prisma = {} as PrismaService;
  const semantic = jest.fn();
  await expect(
    executeOne(
      prisma,
      { principalId: 'worker', token: 'secret' },
      {
        ...testConfig,
        mode: 'development',
        fault: 'deadline',
        faultAcknowledgement: 'AVA_PDF_RUNTIME_FAULTS_V1',
      },
      semantic,
    ),
  ).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(claimPdfJob).not.toHaveBeenCalled();
  expect(semantic).not.toHaveBeenCalled();
});
