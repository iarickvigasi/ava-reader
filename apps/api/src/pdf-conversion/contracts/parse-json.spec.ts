import { parseContractJson, MAX_CONTRACT_BYTES } from './parse-json';

describe('contract byte boundary', () => {
  it('rejects malformed JSON without returning raw input', () => {
    expect(() => parseContractJson(Buffer.from('secret broken'))).toThrow(
      'INVALID_CONTRACT',
    );
  });
  it('rejects invalid UTF-8 instead of replacing canonical characters', () => {
    expect(() => parseContractJson(Buffer.from([0x22, 0xc0, 0x22]))).toThrow(
      'INVALID_CONTRACT',
    );
  });
  it('refuses oversized payloads before parsing', () => {
    expect(() =>
      parseContractJson(Buffer.alloc(MAX_CONTRACT_BYTES + 1)),
    ).toThrow('INVALID_CONTRACT');
  });
  it('preserves deliberate whitespace, combining text and supplementary characters', () => {
    const data = { text: ' A😀B e\u0301 ﬁ\n  ' };
    expect(parseContractJson(Buffer.from(JSON.stringify(data)))).toEqual(data);
  });
});
