// Gemini speech PCM is 24 kHz, mono, signed 16-bit little-endian.
export function pcmToWav(pcm: Buffer, contentType: string) {
  const [mime, ...parameters] = contentType.toLowerCase().split(';');
  const options = new Map(
    parameters.map((part) => {
      const [name, value] = part.trim().split('=');
      return [name, value] as const;
    }),
  );
  if (
    mime.trim() !== 'audio/pcm' ||
    (options.has('rate') && options.get('rate') !== '24000') ||
    (options.has('channels') && options.get('channels') !== '1') ||
    !pcm.length ||
    pcm.length % 2
  )
    throw new Error('Invalid speech PCM response');
  // 400 ms at 24 kHz / mono / 16-bit; retain every generated speech sample.
  const endPause = Buffer.alloc(19_200);
  const dataLength = pcm.length + endPause.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24);
  header.writeUInt32LE(48000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return Buffer.concat([header, pcm, endPause]);
}
