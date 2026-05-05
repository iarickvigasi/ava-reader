// Reads intrinsic width/height from raster image bytes by inspecting
// the format header — does not decode the image. Returns null for
// formats we don't recognize (e.g. SVG), which the caller treats as
// "unknown size" and leaves inline.
export function readImageDimensions(
  bytes: Buffer,
): { width: number; height: number } | null {
  if (bytes.length < 4) {
    return null;
  }

  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return readJpegDimensions(bytes);
  }

  if (
    bytes.length >= 10 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46
  ) {
    return {
      width: bytes.readUInt16LE(6),
      height: bytes.readUInt16LE(8),
    };
  }

  return null;
}

function readJpegDimensions(
  bytes: Buffer,
): { width: number; height: number } | null {
  let offset = 2;

  while (offset < bytes.length - 8) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];

    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    if (marker === 0xd8 || marker === 0xd9) {
      return null;
    }

    if (isJpegStartOfFrameMarker(marker)) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }

    const segmentLength = bytes.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }

  return null;
}

function isJpegStartOfFrameMarker(marker: number): boolean {
  if (marker < 0xc0 || marker > 0xcf) {
    return false;
  }
  // 0xC4, 0xC8, 0xCC are not Start-Of-Frame markers (DHT, JPG, DAC).
  return marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}
