import { pcmToWav } from './pcm-to-wav';

it('preserves all speech samples and adds exactly 400 ms of silence', () => {
  const pcm = Buffer.from([0, 0, 255, 127, 0, 128]);
  const wav = pcmToWav(pcm, 'audio/pcm;rate=24000;channels=1');
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
  expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
  expect(wav.toString('ascii', 8, 16)).toBe('WAVEfmt ');
  expect(wav.readUInt16LE(20)).toBe(1);
  expect(wav.readUInt16LE(22)).toBe(1);
  expect(wav.readUInt32LE(24)).toBe(24000);
  expect(wav.readUInt32LE(28)).toBe(48000);
  expect(wav.readUInt16LE(32)).toBe(2);
  expect(wav.readUInt16LE(34)).toBe(16);
  expect(wav.toString('ascii', 36, 40)).toBe('data');
  expect(wav.readUInt32LE(40)).toBe(pcm.length + 19_200);
  expect(wav.subarray(44, 44 + pcm.length)).toEqual(pcm);
  const pause = wav.subarray(44 + pcm.length);
  expect(pause).toEqual(Buffer.alloc(19_200));
  expect(pause.length / 2 / 24000).toBe(0.4);
});

it.each([
  [Buffer.alloc(0), 'audio/pcm'],
  [Buffer.from([1]), 'audio/pcm'],
  [Buffer.alloc(2), 'audio/mpeg'],
  [Buffer.alloc(2), 'audio/pcm;rate=16000'],
  [Buffer.alloc(2), 'audio/pcm;channels=2'],
])('rejects incompatible audio instead of labeling it as WAV', (pcm, mime) => {
  expect(() => pcmToWav(pcm, mime)).toThrow('Invalid speech PCM');
});
