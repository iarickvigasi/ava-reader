import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ReaderController } from './reader.controller';

describe('ReaderController', () => {
  const readerService = {
    getReaderPayload: jest.fn(),
    heartbeatSession: jest.fn(),
    markReaderOpened: jest.fn(),
    startSession: jest.fn(),
    stopSession: jest.fn(),
    updateProgress: jest.fn(),
  };
  let readerController: ReaderController;

  beforeEach(() => {
    readerService.getReaderPayload.mockReset();
    readerService.heartbeatSession.mockReset();
    readerService.markReaderOpened.mockReset();
    readerService.startSession.mockReset();
    readerService.stopSession.mockReset();
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

  it('delegates session start using the authenticated user id', async () => {
    const request = {
      auth: {
        clerkUserId: 'clerk_1',
      },
    } as AuthenticatedRequest;
    readerService.startSession.mockResolvedValue({
      durationSeconds: 0,
      endedAt: null,
      lastTrackedAt: '2026-04-12T10:00:00.000Z',
      sessionId: 'session-1',
      startedAt: '2026-04-12T10:00:00.000Z',
    });

    await readerController.startSession(request, 'library-1', {
      clientInstanceId: 'client-a',
    });

    expect(readerService.startSession).toHaveBeenCalledWith(
      'clerk_1',
      'library-1',
      'client-a',
    );
  });

  it('delegates session heartbeat using the authenticated user id', async () => {
    const request = {
      auth: {
        clerkUserId: 'clerk_1',
      },
    } as AuthenticatedRequest;
    readerService.heartbeatSession.mockResolvedValue({
      durationSeconds: 30,
      endedAt: null,
      lastTrackedAt: '2026-04-12T10:00:30.000Z',
      sessionId: 'session-1',
      startedAt: '2026-04-12T10:00:00.000Z',
    });

    await readerController.heartbeatSession(request, 'library-1', {
      clientInstanceId: 'client-a',
      sessionId: 'session-1',
    });

    expect(readerService.heartbeatSession).toHaveBeenCalledWith(
      'clerk_1',
      'library-1',
      'session-1',
      'client-a',
    );
  });

  it('delegates session stop using the authenticated user id', async () => {
    const request = {
      auth: {
        clerkUserId: 'clerk_1',
      },
    } as AuthenticatedRequest;
    readerService.stopSession.mockResolvedValue({
      durationSeconds: 30,
      endedAt: '2026-04-12T10:00:30.000Z',
      lastTrackedAt: '2026-04-12T10:00:30.000Z',
      sessionId: 'session-1',
      startedAt: '2026-04-12T10:00:00.000Z',
    });

    await readerController.stopSession(request, 'library-1', {
      clientInstanceId: 'client-a',
      sessionId: 'session-1',
    });

    expect(readerService.stopSession).toHaveBeenCalledWith(
      'clerk_1',
      'library-1',
      'session-1',
      'client-a',
    );
  });
});
