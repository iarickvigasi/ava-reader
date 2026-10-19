'use strict';
const {
  assert,
  load,
  client,
  providers,
  report,
  externalFetches,
} = require('./shared.cjs');
const db = client();
async function work(message) {
  if (message.action === 'crash') {
    await providers.dispatchPdfProvider(db, message.input, async () => {
      // The real dispatch-intent transaction has committed. No receipt is returned.
      process.exit(42);
    });
    throw new Error('CRASH_POINT_NOT_REACHED');
  }
  if (message.action === 'retry') {
    let sends = 0,
      code;
    try {
      await providers.dispatchPdfProvider(db, message.input, async () => {
        sends++;
        throw new Error('MUST_NOT_SEND');
      });
    } catch (error) {
      code = error.code;
    }
    assert.equal(sends, 0);
    return { code, sends };
  }
  if (message.action === 'reserve') {
    try {
      const result = await load(
        'library/pdf-import/providers/reserve',
      ).reservePdfProvider(db, message.input.authority, message.input.task);
      return {
        state: 'RESERVED',
        callId: result.call.id,
        maximumNano: result.prepared.maximumNano.toString(),
      };
    } catch (error) {
      return { state: 'REFUSED', code: error.code };
    }
  }
  if (message.action === 'report') {
    try {
      return {
        state: 'READ',
        value: await report(db, message.operationId, message.actorClerkId),
      };
    } catch (error) {
      return {
        state: 'REFUSED',
        status: error.getStatus?.(),
        code: error.code,
      };
    }
  }
  throw new Error('UNKNOWN_CHILD_ACTION');
}
(async () => {
  await db.$connect();
  process.send({ ready: true, pid: process.pid });
  process.once('message', async (message) => {
    try {
      const result = await work(message);
      assert.equal(externalFetches(), 0);
      process.send({ result, pid: process.pid });
    } catch (error) {
      process.send({ failure: error.code || error.message, pid: process.pid });
      process.exitCode = 1;
    } finally {
      await db.$disconnect();
      process.disconnect();
    }
  });
})().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exitCode = 1;
  process.disconnect?.();
});
