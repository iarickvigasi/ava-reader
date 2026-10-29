export function checkZipDirectory(bytes: Buffer) {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > bytes.length || bytes.length - end > 65_557)
    throw new Error('Missing ZIP directory');
  const entries = bytes.readUInt16LE(end + 10);
  if (
    entries > 10_000 ||
    bytes.readUInt16LE(end + 8) !== entries ||
    bytes.readUInt16LE(end + 4) !== 0 ||
    bytes.readUInt16LE(end + 6) !== 0 ||
    bytes.readUInt32LE(end + 16) + bytes.readUInt32LE(end + 12) > end
  )
    throw new Error('Oversized, ZIP64, or multi-disk archive');
}
