import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ReaderController } from './reader.controller';

describe('ReaderController', () => {
  const readerService = {
    getReaderPayload: jest.fn(),
    markReaderOpened: jest.fn(),
    updateProgress: jest.fn(),
  };
  let readerController: ReaderController;

  beforeEach(() => {
    readerService.getReaderPayload.mockReset();
    readerService.markReaderOpened.mockReset();
    readerService.updateProgress.mockReset();
    readerController = new ReaderController(readerService as never);
  });

  it('delegates reader payload requests using the authenticated user id', async () => {
    const request = {
      auth: {
        clerkUserId: 'clerk_1',
      },
    } as AuthenticatedRequest;
    readerService.getReaderPayload.mockResolvedValue({
      message: 'Preparing this EPUB for the reader.',
      status: 'PROCESSING',
    });

    await readerController.getReader(request, 'library-1', 'chapter-2');

    expect(readerService.getReaderPayload).toHaveBeenCalledWith(
      'clerk_1',
      'library-1',
      'chapter-2',
    );
  });

  it('delegates reader open events using the authenticated user id', async () => {
    const request = {
      auth: {
        clerkUserId: 'clerk_1',
      },
    } as AuthenticatedRequest;
    readerService.markReaderOpened.mockResolvedValue(undefined);

    await expect(
      readerController.markReaderOpened(request, 'library-1'),
    ).resolves.toBeUndefined();

    expect(readerService.markReaderOpened).toHaveBeenCalledWith(
      'clerk_1',
      'library-1',
    );
  });
});
