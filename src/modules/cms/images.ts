export interface ImageInfo {
  type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  ext: string;
  width: number | null;
  height: number | null;
}

function jpegSize(b: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1]!;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

function webpSize(b: Buffer): { width: number; height: number } | null {
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X' && b.length >= 30) return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8 ' && b.length >= 30) return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L' && b.length >= 25) {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

export function inspectImage(b: Buffer): ImageInfo | null {
  if (b.length < 16) return null;
  if (b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a) {
    return { type: 'image/png', ext: 'png', width: b.length >= 24 ? b.readUInt32BE(16) : null, height: b.length >= 24 ? b.readUInt32BE(20) : null };
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    const s = jpegSize(b);
    return { type: 'image/jpeg', ext: 'jpg', width: s?.width ?? null, height: s?.height ?? null };
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const s = webpSize(b);
    return { type: 'image/webp', ext: 'webp', width: s?.width ?? null, height: s?.height ?? null };
  }
  const gif = b.toString('ascii', 0, 6);
  if (gif === 'GIF87a' || gif === 'GIF89a') return { type: 'image/gif', ext: 'gif', width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  return null;
}
