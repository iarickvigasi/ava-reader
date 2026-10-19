import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';

export function fakeDocker(holdWrites = false) {
  const callbacks: ((error?: Error | null) => void)[] = [],
    writes: Buffer[] = [];
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdin: new Writable({
      highWaterMark: 1,
      write(chunk: Buffer, _encoding, done) {
        writes.push(Buffer.from(chunk));
        if (holdWrites) callbacks.push(done);
        else done();
      },
    }),
    kill: jest.fn(),
  });
  return { child, writes, release: () => callbacks.shift()?.() };
}
export const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
