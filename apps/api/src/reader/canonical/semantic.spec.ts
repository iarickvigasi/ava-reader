import { ServiceUnavailableException } from '@nestjs/common';
import { pythonSemanticValidator } from '../../pdf-conversion/contracts/python-semantic-validator';
import { readerSemanticValidator } from './semantic';
import { installedReaderValidatorIdentity } from './validator-identity';
jest.mock('./validator-identity');

jest.mock('../../pdf-conversion/contracts/python-semantic-validator', () => ({
  pythonSemanticValidator: jest.fn(),
}));

describe('reader semantic concurrency and refusal contract', () => {
  beforeEach(() => jest.mocked(pythonSemanticValidator).mockReset());
  it('keeps two active slots, busy503 and releases both true/false results', async () => {
    let finishFirst!: (valid: boolean) => void;
    let finishSecond!: (valid: boolean) => void;
    const first = new Promise<boolean>((resolve) => {
      finishFirst = resolve;
    });
    const second = new Promise<boolean>((resolve) => {
      finishSecond = resolve;
    });
    jest
      .mocked(pythonSemanticValidator)
      .mockReturnValueOnce(() => first)
      .mockReturnValueOnce(() => second);
    const pendingFirst = readerSemanticValidator('ava-reader-3', null, '{}');
    const pendingSecond = readerSemanticValidator('ava-reader-3', null, '{}');
    const busy = readerSemanticValidator('ava-reader-3', null, '{}');
    await expect(busy).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(busy).rejects.toMatchObject({
      message: 'Reader validation is busy.',
      status: 503,
    });
    expect(pythonSemanticValidator).toHaveBeenCalledTimes(2);
    finishFirst(true);
    finishSecond(false);
    await expect(pendingFirst).resolves.toBe(true);
    await expect(pendingSecond).resolves.toBe(false);
    jest
      .mocked(pythonSemanticValidator)
      .mockReturnValue(() => Promise.resolve(false));
    await expect(
      readerSemanticValidator('ava-reader-3', null, '{}'),
    ).resolves.toBe(false);
  });
  it('retains unavailable503 and releases active slots after async and sync failures', async () => {
    jest
      .mocked(pythonSemanticValidator)
      .mockReturnValueOnce(() => Promise.reject(new Error('PRIVATE_ERROR')))
      .mockImplementationOnce(() => {
        throw new Error('PRIVATE_FACTORY');
      });
    for (let i = 0; i < 2; i++)
      await expect(
        readerSemanticValidator('ava-reader-3', null, '{}'),
      ).rejects.toMatchObject({
        message: 'Reader validation is unavailable.',
        status: 503,
      });
    jest
      .mocked(pythonSemanticValidator)
      .mockReturnValue(() => Promise.resolve(true));
    await expect(
      readerSemanticValidator('ava-reader-3', null, '{}'),
    ).resolves.toBe(true);
  });
});

it('changes reader validation identity when the trusted interpreter configuration changes', async () => {
  jest
    .mocked(installedReaderValidatorIdentity)
    .mockImplementation((path) => Promise.resolve(path));
  const before = process.env.AVA_PDF_CONTRACT_PYTHON;
  try {
    process.env.AVA_PDF_CONTRACT_PYTHON = '/trusted/version-one/python';
    const first = await readerSemanticValidator.validationIdentity!();
    process.env.AVA_PDF_CONTRACT_PYTHON = '/trusted/version-two/python';
    expect(await readerSemanticValidator.validationIdentity!()).not.toBe(first);
  } finally {
    if (before === undefined) delete process.env.AVA_PDF_CONTRACT_PYTHON;
    else process.env.AVA_PDF_CONTRACT_PYTHON = before;
  }
});

it('discards a fingerprint if interpreter configuration changes while discovery is pending', async () => {
  const before = process.env.AVA_PDF_CONTRACT_PYTHON;
  let finish!: (identity: string) => void;
  jest.mocked(installedReaderValidatorIdentity).mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  try {
    process.env.AVA_PDF_CONTRACT_PYTHON = '/trusted/one/bin/python';
    const pending = readerSemanticValidator.validationIdentity!();
    process.env.AVA_PDF_CONTRACT_PYTHON = '/trusted/two/bin/python';
    finish('version-one');
    expect(await pending).toBeNull();
  } finally {
    if (before === undefined) delete process.env.AVA_PDF_CONTRACT_PYTHON;
    else process.env.AVA_PDF_CONTRACT_PYTHON = before;
  }
});
