import { geometryTask, geometryAnswer } from './cell-geometry-fixture';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import { localExchangeFixture } from './local-cell-geometry-state-fixture';
import { localPeer } from './local-cell-geometry-fixture';

it('acknowledges real geometry wire semantics and consumes the parent after local acceptance', async () => {
  const q = localExchangeFixture();
  await q.prepare();
  const reply = JSON.parse(
    (await q.send('geometry', geometryTask)).toString(),
  ) as ExchangeEnvelope;
  expect(reply.payload).toEqual([geometryAnswer]);
  expect(q.local).toHaveBeenCalledTimes(1);
  expect(q.dispatch).toHaveBeenCalledTimes(1); // Initial recognition only; local repair is unbilled.
  await expect(q.send('geometry', geometryTask)).rejects.toThrow(
    'INVALID_RESULT',
  );
  expect(q.local).toHaveBeenCalledTimes(1);
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
it('shares the same parent when NO_PROOF uses the existing provider fallback', async () => {
  const q = localExchangeFixture();
  q.local.mockResolvedValue(localPeer(false));
  await q.prepare();
  await q.send('geometry', geometryTask);
  expect(q.dispatch).toHaveBeenCalledTimes(2);
  await expect(q.send('geometry', geometryTask)).rejects.toThrow(
    'INVALID_RESULT',
  );
  expect(q.local).toHaveBeenCalledTimes(1);
  expect(q.dispatch).toHaveBeenCalledTimes(2);
});
it('never dispatches a fallback when concurrency invalidates an in-flight local command', async () => {
  const q = localExchangeFixture();
  await q.prepare();
  let resolve!: (value: ReturnType<typeof localPeer>) => void;
  let began!: () => void;
  const started = new Promise<void>((r) => {
    began = r;
  });
  q.local.mockImplementation(() => {
    began();
    return new Promise((r) => {
      resolve = r;
    });
  });
  const pending = q.send('geometry', geometryTask);
  await started;
  await expect(q.send('geometry', geometryTask)).rejects.toThrow(
    'INVALID_RESULT',
  );
  resolve(localPeer());
  await expect(pending).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
