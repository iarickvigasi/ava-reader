import { selectAcceptedPdfReader } from './select-accepted-reader';
import { ReaderValidationCache } from './reader-validation-cache';
import { selectionFixture } from './selection-fixture';
import { selectionRefusals } from './selection-refusals';

function setup() {
  const fixture = selectionFixture();
  return {
    ...fixture,
    semantic: Object.assign(
      jest.fn(() => Promise.resolve(true)),
      { validationIdentity: () => 'test-version-one' },
    ),
    validationCache: new ReaderValidationCache(),
    loadOwnedArtifact: jest.fn(() => Promise.resolve(fixture.artifact)),
  };
}

it('avoids Python-equivalent calls on warm selection while returning independent parsed graphs', async () => {
  const input = setup();
  const first = await selectAcceptedPdfReader(input);
  const original = structuredClone(first.reader);
  first.reader.book.chapters[0].title = 'caller changed title';
  first.reader.required_capabilities.length = 0;
  const next = await selectAcceptedPdfReader(input);
  expect(next.reader).toEqual(original);
  expect(next.reader).not.toBe(first.reader);
  expect(input.semantic).toHaveBeenCalledTimes(2);
  expect(input.loadOwnedArtifact).toHaveBeenCalledTimes(2);
});
it('coalesces simultaneous cold selection of accepted and reader contracts', async () => {
  const input = setup();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => selectAcceptedPdfReader(input)),
  );
  expect(input.semantic).toHaveBeenCalledTimes(2);
  expect(
    results.every((result) => result.contentId === results[0].contentId),
  ).toBe(true);
  expect(results[0].reader).not.toBe(results[1].reader);
});
it.each(['accepted', 'reader'])(
  'refuses corrupted actual %s bytes behind unchanged stored digests on a warm hit',
  async (target) => {
    const input = setup();
    await selectAcceptedPdfReader(input);
    if (target === 'accepted') input.acceptedBytes[0] = 0;
    else input.artifact.bytes[0] = 0;
    await expect(selectAcceptedPdfReader(input)).rejects.toThrow('unavailable');
    expect(input.semantic).toHaveBeenCalledTimes(2);
  },
);
it.each(selectionRefusals)(
  'rechecks every selection authority on a warm hit',
  async (change) => {
    const input = setup();
    await selectAcceptedPdfReader(input);
    input.loadOwnedArtifact.mockClear();
    change(input.authority);
    await expect(selectAcceptedPdfReader(input)).rejects.toThrow('unavailable');
    expect(input.loadOwnedArtifact).not.toHaveBeenCalled();
  },
);
it('rechecks retained artifact metadata even when the validation result is warm', async () => {
  const input = setup();
  await selectAcceptedPdfReader(input);
  input.artifact.retention = 'OPERATION';
  await expect(selectAcceptedPdfReader(input)).rejects.toThrow('unavailable');
});
