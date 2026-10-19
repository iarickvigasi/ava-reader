import { selectAcceptedPdfReader } from './select-accepted-reader';
import { selectionFixture } from './selection-fixture';
import { selectionRefusals } from './selection-refusals';
import type { SelectionAuthority } from './selection-authority';

const semantic = () => Promise.resolve(true);
const setup = () => {
  const fixture = selectionFixture();
  return {
    ...fixture,
    semantic,
    loadOwnedArtifact: jest.fn(() => Promise.resolve(fixture.artifact)),
  };
};
describe('source-independent accepted reader selection', () => {
  it('selects a verified derived package while source remains PDF', async () => {
    const input = setup();
    const result = await selectAcceptedPdfReader(input);
    expect(result.contentId).toBe(input.authority.operation.finalContentId);
    expect(result.reader.version).toBe(3);
    expect(input.loadOwnedArtifact).toHaveBeenCalledWith(input.artifact.id);
  });
  it.each(['FAILED', 'QUEUED', 'WAITING', 'STOPPED'])(
    'refuses %s before any reader lookup',
    async (status) => {
      const input = setup();
      input.authority.operation.status = status;
      await expect(selectAcceptedPdfReader(input)).rejects.toThrow();
      expect(input.loadOwnedArtifact).not.toHaveBeenCalled();
    },
  );
  it.each(selectionRefusals)(
    'refuses mismatched authority or missing qualification',
    async (change) => {
      const input = setup();
      change(input.authority);
      await expect(selectAcceptedPdfReader(input)).rejects.toThrow();
      expect(input.loadOwnedArtifact).not.toHaveBeenCalled();
    },
  );
  it('refuses absent stored authority and modified accepted bytes', async () => {
    const input = setup();
    input.authority = undefined as unknown as SelectionAuthority;
    await expect(selectAcceptedPdfReader(input)).rejects.toThrow();
    const changed = setup();
    changed.acceptedBytes[0] = 0;
    await expect(selectAcceptedPdfReader(changed)).rejects.toThrow();
  });
  it.each(['wrong-owner', 'candidate', 'corrupt-bytes'])(
    'refuses %s artifact',
    async (change) => {
      const input = setup();
      if (change === 'wrong-owner') input.artifact.ownerId = 'other';
      if (change === 'candidate') input.artifact.retention = 'OPERATION';
      if (change === 'corrupt-bytes') input.artifact.bytes[0] = 0;
      await expect(selectAcceptedPdfReader(input)).rejects.toThrow();
    },
  );
  it('requires semantic validation and every reader capability', async () => {
    await expect(
      selectAcceptedPdfReader({
        ...setup(),
        semantic: () => Promise.resolve(false),
      }),
    ).rejects.toThrow();
    const input = setup();
    input.authority.capability.capabilities = [];
    await expect(selectAcceptedPdfReader(input)).rejects.toThrow();
  });
});
