// Bound entry allocation before handing a ZIP directory to JSZip. No entry is inflated.
// ZIP64 and split archives are outside this <=50MiB, <=24k-entry import profile.
export function boundEpubDirectory(bytes: Buffer) {
  const fail = () => {
    throw new Error('EPUB_DIRECTORY_INVALID');
  };
  let end = -1;
  for (
    let at = bytes.length - 22;
    at >= Math.max(0, bytes.length - 65557);
    at--
  ) {
    if (
      bytes.readUInt32LE(at) === 0x06054b50 &&
      at + 22 + bytes.readUInt16LE(at + 20) === bytes.length
    ) {
      end = at;
      break;
    }
  }
  if (end < 0) return fail();
  const entries = bytes.readUInt16LE(end + 10),
    size = bytes.readUInt32LE(end + 12),
    offset = bytes.readUInt32LE(end + 16);
  if (
    bytes.readUInt16LE(end + 4) ||
    bytes.readUInt16LE(end + 6) ||
    bytes.readUInt16LE(end + 8) !== entries ||
    entries > 24000 ||
    size === 0xffffffff ||
    offset === 0xffffffff ||
    offset + size !== end ||
    (end >= 20 && bytes.readUInt32LE(end - 20) === 0x07064b50)
  )
    return fail();
  let cursor = offset,
    count = 0;
  while (cursor < end) {
    if (
      ++count > 24000 ||
      cursor + 46 > end ||
      bytes.readUInt32LE(cursor) !== 0x02014b50
    )
      return fail();
    const length =
      46 +
      bytes.readUInt16LE(cursor + 28) +
      bytes.readUInt16LE(cursor + 30) +
      bytes.readUInt16LE(cursor + 32);
    if (
      bytes.readUInt16LE(cursor + 34) ||
      cursor + length > end ||
      [20, 24, 42].some(
        (field) => bytes.readUInt32LE(cursor + field) === 0xffffffff,
      )
    )
      return fail();
    cursor += length;
  }
  if (count !== entries || cursor !== end) return fail();
}
