import {
  ServiceUnavailableException,
  type ExecutionContext,
} from '@nestjs/common';
import { firstValueFrom, of, Subject } from 'rxjs';
import { PdfIntakeCapacityInterceptor } from './intake-capacity.interceptor';

const context = {} as ExecutionContext;
const interceptor = new PdfIntakeCapacityInterceptor();
const accept = (handle = () => of('accepted')) =>
  firstValueFrom(interceptor.intercept(context, { handle }));

describe('PDF intake admission before multipart parsing', () => {
  it('refuses the third intake without calling its parser, then frees completed slots', async () => {
    const streams = [new Subject<string>(), new Subject<string>()];
    const pending = streams.map((stream) => accept(() => stream));
    const parser = jest.fn(() => of('unexpected'));
    await expect(accept(parser)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(parser).not.toHaveBeenCalled();
    streams.forEach((stream) => stream.next('accepted'));
    await expect(Promise.all(pending)).resolves.toEqual([
      'accepted',
      'accepted',
    ]);
    await expect(accept()).resolves.toBe('accepted');
  });

  it('releases capacity after parser errors and synchronous failures', async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      await expect(
        accept(() => {
          throw new Error('parser failed');
        }),
      ).rejects.toThrow('parser failed');
    }
    await expect(accept()).resolves.toBe('accepted');
  });

  it('releases a cancelled subscription and shares the process bound across instances', async () => {
    const second = new PdfIntakeCapacityInterceptor();
    const stream = new Subject<string>();
    const subscriptions = [interceptor, second].map((gate) =>
      gate.intercept(context, { handle: () => stream }).subscribe(),
    );
    await expect(accept()).rejects.toBeInstanceOf(ServiceUnavailableException);
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    await expect(accept()).resolves.toBe('accepted');
  });
});
