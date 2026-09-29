import { processNextCandidate } from './process-next';
import { processCandidate } from './process-candidate';
jest.mock('./process-candidate');
const candidate = jest.mocked(processCandidate);
const args = [{}, {}, {}] as Parameters<typeof processNextCandidate>;
describe('candidate scheduling fairness', () => {
  beforeEach(() => candidate.mockReset());
  it('continues past a waiting reader to independent work', async () => {
    candidate
      .mockResolvedValueOnce({ kind: 'waiting_reader', operationId: 'one' })
      .mockResolvedValueOnce({
        kind: 'ready',
        operationId: 'two',
        finalContentId: 'content-two',
      });
    await expect(processNextCandidate(...args)).resolves.toMatchObject({
      kind: 'ready',
      operationId: 'two',
    });
    expect(candidate.mock.calls[1][3]).toEqual(['one']);
  });
  it('returns a bounded waiting outcome once no other work exists', async () => {
    candidate
      .mockResolvedValueOnce({ kind: 'waiting_reader', operationId: 'one' })
      .mockResolvedValueOnce({ kind: 'idle' });
    await expect(processNextCandidate(...args)).resolves.toMatchObject({
      kind: 'waiting_reader',
    });
    expect(candidate).toHaveBeenCalledTimes(2);
  });
});
