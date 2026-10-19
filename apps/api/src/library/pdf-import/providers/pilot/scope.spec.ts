import { requirePilotOperator } from './scope';
import { registerAuthoredPilotWorker } from './register';
import { claimAuthoredPilotJob } from './claim';
import { importAuthoredPilot } from './import';
import type { PrismaService } from '../../../../prisma/prisma.service';
const valid = {
  NODE_ENV: 'test',
  AVA_PDF_TEST_HOOKS: '1',
  AVA_PDF_AUTHORED_PILOT: '1',
  DATABASE_URL:
    'postgresql://synthetic:synthetic@127.0.0.1:50755/ava_pdf_authored_pilot?schema=public',
};
describe('operator-only authored fixture boundary', () => {
  it('accepts only explicit local disposable scope', () =>
    expect(() => requirePilotOperator(valid)).not.toThrow());
  it.each([
    { NODE_ENV: 'production' },
    { AVA_PDF_TEST_HOOKS: '0' },
    { AVA_PDF_AUTHORED_PILOT: undefined },
    {
      DATABASE_URL:
        'postgresql://synthetic@external.invalid/ava_pdf_authored_pilot',
    },
    { DATABASE_URL: 'postgresql://synthetic@127.0.0.1/ava_reader' },
    { DATABASE_URL: 'invalid' },
  ])('rejects disabled/wrong environment %j', (change) => {
    expect(() => requirePilotOperator({ ...valid, ...change })).toThrow(
      'PDF_PILOT_DISABLED',
    );
  });
  it('all dormant entry points refuse before touching DB', async () => {
    const old = process.env.AVA_PDF_AUTHORED_PILOT;
    delete process.env.AVA_PDF_AUTHORED_PILOT;
    const prisma = new Proxy(
      {},
      {
        get() {
          throw Error('Database must not be touched');
        },
      },
    ) as PrismaService;
    try {
      await expect(
        registerAuthoredPilotWorker(prisma, 'route', 'token'),
      ).rejects.toThrow('PDF_PILOT_DISABLED');
      await expect(
        claimAuthoredPilotJob(
          prisma,
          { principalId: 'p', token: 't' },
          'route',
        ),
      ).rejects.toThrow('PDF_PILOT_DISABLED');
      await expect(
        importAuthoredPilot({
          prisma,
          routeId: 'r',
          userId: 'u',
          operationId: 'o',
          file: {} as Express.Multer.File,
        }),
      ).rejects.toThrow('PDF_PILOT_DISABLED');
    } finally {
      if (old === undefined) delete process.env.AVA_PDF_AUTHORED_PILOT;
      else process.env.AVA_PDF_AUTHORED_PILOT = old;
    }
  });
});
